"""FastAPI application deployed to each agent VM."""

import asyncio
import json
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from baal_agent.config import AgentSettings
from baal_agent.context import build_system_prompt
from baal_agent.database import AgentDatabase
from baal_agent.inference import InferenceClient
from baal_agent.tools import execute_tool, get_tool_definitions

logger = logging.getLogger(__name__)

settings = AgentSettings()
db = AgentDatabase(db_path=settings.db_path)
inference = InferenceClient(api_key=settings.libertai_api_key)

_heartbeat_task: asyncio.Task | None = None


# ── Lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _heartbeat_task
    await db.initialize()

    # Ensure workspace directories exist
    workspace = Path(settings.workspace_path)
    (workspace / "memory").mkdir(parents=True, exist_ok=True)
    (workspace / "skills").mkdir(parents=True, exist_ok=True)

    # Start heartbeat if configured
    if settings.heartbeat_interval > 0:
        _heartbeat_task = asyncio.create_task(_heartbeat_loop())

    yield

    if _heartbeat_task and not _heartbeat_task.done():
        _heartbeat_task.cancel()
        try:
            await _heartbeat_task
        except asyncio.CancelledError:
            pass
    await db.close()


app = FastAPI(title=f"Baal Agent: {settings.agent_name}", lifespan=lifespan)


# ── Auth middleware ────────────────────────────────────────────────────

@app.middleware("http")
async def verify_auth(request: Request, call_next):
    """Reject requests without a valid Bearer token (except /health)."""
    if request.url.path == "/health":
        return await call_next(request)
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token or not secrets.compare_digest(token, settings.agent_secret):
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    return await call_next(request)


# ── Core agentic loop ─────────────────────────────────────────────────

async def _run_agent_turn(
    message: str,
    chat_id: str,
    *,
    restricted: bool = False,
    max_iterations: int | None = None,
    store_history: bool = True,
) -> str | None:
    """Run a single agentic turn (message -> tool loop -> response).

    Args:
        message: The user/system message to process.
        chat_id: Conversation identifier for history.
        restricted: If True, use restricted tool set (no spawn).
        max_iterations: Override max tool iterations.
        store_history: Whether to persist messages to DB.

    Returns:
        The final text response, or None if no text was generated.
    """
    iterations = max_iterations or settings.max_tool_iterations
    tools = get_tool_definitions(include_spawn=not restricted)
    tool_names = [t["function"]["name"] for t in tools]

    if store_history:
        await db.add_message(chat_id, "user", message)

    history = await db.get_history(chat_id, limit=settings.max_history) if store_history else []

    system_prompt = build_system_prompt(
        settings.system_prompt,
        settings.agent_name,
        settings.workspace_path,
        tool_names=tool_names,
    )
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    # If history didn't include the message we just stored, add it
    if not store_history:
        messages.append({"role": "user", "content": message})

    final_text = None

    for _iteration in range(iterations):
        assistant_msg = await inference.chat(
            messages=messages, model=settings.model, tools=tools
        )

        text_content = assistant_msg.content
        tool_calls = assistant_msg.tool_calls

        tc_for_db = None
        if tool_calls:
            tc_for_db = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ]

        if store_history:
            await db.add_message(chat_id, "assistant", text_content, tool_calls=tc_for_db)

        assistant_dict: dict = {"role": "assistant"}
        if text_content:
            assistant_dict["content"] = text_content
        if tc_for_db:
            assistant_dict["tool_calls"] = tc_for_db
        messages.append(assistant_dict)

        if text_content:
            final_text = text_content

        if not tool_calls:
            return final_text

        for tc in tool_calls:
            name = tc.function.name
            arguments = tc.function.arguments

            # Handle spawn tool specially
            if name == "spawn" and not restricted:
                result = await _handle_spawn(arguments, chat_id)
            else:
                result = await execute_tool(name, arguments)

            if store_history:
                await db.add_message(chat_id, "tool", result, tool_call_id=tc.id)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    return final_text


# ── Spawn / subagent ──────────────────────────────────────────────────

async def _handle_spawn(arguments: str | dict, origin_chat_id: str) -> str:
    """Handle the spawn tool call — start a background subagent."""
    import json as _json
    if isinstance(arguments, str):
        arguments = _json.loads(arguments)
    task = arguments["task"]
    label = arguments.get("label", task[:50])
    asyncio.create_task(_run_subagent(task, label, origin_chat_id))
    return f"Subagent spawned for: {label}"


async def _run_subagent(task: str, label: str, origin_chat_id: str):
    """Run a subagent in the background with restricted tools."""
    try:
        result = await _run_agent_turn(
            task,
            chat_id="__subagent__",
            restricted=True,
            max_iterations=15,
            store_history=False,
        )
        await db.add_pending(
            origin_chat_id,
            f"[Task: {label}] {result or '(no output)'}",
            source="subagent",
        )
    except Exception as e:
        logger.error(f"Subagent failed: {e}")
        await db.add_pending(
            origin_chat_id,
            f"[Task: {label}] Error: {e}",
            source="subagent",
        )


# ── Heartbeat ─────────────────────────────────────────────────────────

def _is_heartbeat_empty(content: str) -> bool:
    """Check if heartbeat file has no actionable content."""
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("<!--") and stripped.endswith("-->"):
            continue
        # Unchecked checkbox counts as actionable
        if stripped.startswith("- [ ]"):
            return False
        # Any non-header, non-comment text is actionable
        return False
    return True


async def _heartbeat_loop():
    """Periodic heartbeat — check HEARTBEAT.md and run tasks."""
    while True:
        await asyncio.sleep(settings.heartbeat_interval)
        try:
            heartbeat_file = Path(settings.workspace_path) / "HEARTBEAT.md"
            if not heartbeat_file.exists():
                continue
            content = heartbeat_file.read_text()
            if _is_heartbeat_empty(content):
                continue

            result = await _run_agent_turn(
                "Read HEARTBEAT.md and follow any instructions or tasks listed there. "
                "If nothing needs attention, reply with just: HEARTBEAT_OK",
                chat_id="__heartbeat__",
                store_history=False,
            )

            if result and "HEARTBEAT_OK" not in result.upper().replace("_", ""):
                if settings.owner_chat_id:
                    await db.add_pending(
                        settings.owner_chat_id,
                        f"[Heartbeat] {result}",
                        source="heartbeat",
                    )
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")


# ── SSE helpers ───────────────────────────────────────────────────────

def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    chat_id: str


@app.post("/chat")
async def chat(req: ChatRequest):
    """Handle a proxied chat message with SSE streaming and tool use."""

    async def event_stream():
        try:
            tools = get_tool_definitions(include_spawn=True)
            tool_names = [t["function"]["name"] for t in tools]

            await db.add_message(req.chat_id, "user", req.message)

            history = await db.get_history(req.chat_id, limit=settings.max_history)
            system_prompt = build_system_prompt(
                settings.system_prompt,
                settings.agent_name,
                settings.workspace_path,
                tool_names=tool_names,
            )
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history)

            for _iteration in range(settings.max_tool_iterations):
                assistant_msg = await inference.chat(
                    messages=messages, model=settings.model, tools=tools
                )

                text_content = assistant_msg.content
                tool_calls = assistant_msg.tool_calls

                tc_for_db = None
                if tool_calls:
                    tc_for_db = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ]

                await db.add_message(
                    req.chat_id, "assistant", text_content, tool_calls=tc_for_db
                )

                assistant_dict: dict = {"role": "assistant"}
                if text_content:
                    assistant_dict["content"] = text_content
                if tc_for_db:
                    assistant_dict["tool_calls"] = tc_for_db
                messages.append(assistant_dict)

                if text_content:
                    yield _sse_event({"type": "text", "content": text_content})

                if not tool_calls:
                    yield _sse_event({"type": "done"})
                    return

                for tc in tool_calls:
                    name = tc.function.name
                    arguments = tc.function.arguments
                    yield _sse_event({"type": "tool_use", "name": name, "input": arguments})

                    # Handle spawn tool specially
                    if name == "spawn":
                        result = await _handle_spawn(arguments, req.chat_id)
                    else:
                        result = await execute_tool(name, arguments)

                    await db.add_message(
                        req.chat_id, "tool", result, tool_call_id=tc.id
                    )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })

            yield _sse_event({"type": "text", "content": "(Reached maximum tool iterations)"})
            yield _sse_event({"type": "done"})

        except Exception as e:
            logger.error(f"Chat stream error: {e}", exc_info=True)
            yield _sse_event({"type": "error", "content": str(e)})
            yield _sse_event({"type": "done"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Clear conversation history for a chat."""
    count = await db.clear_history(chat_id)
    return {"status": "ok", "deleted": count}


@app.get("/pending")
async def get_pending():
    """Return pending proactive messages and clear them."""
    messages = await db.get_and_clear_pending()
    return {"messages": messages}


@app.get("/health")
async def health():
    return {"status": "ok", "agent_name": settings.agent_name}
