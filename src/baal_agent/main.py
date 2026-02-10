"""FastAPI application deployed to each agent VM."""

import json
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from baal_agent.config import AgentSettings
from baal_agent.database import AgentDatabase
from baal_agent.inference import InferenceClient
from baal_agent.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

settings = AgentSettings()
db = AgentDatabase(db_path=settings.db_path)
inference = InferenceClient(api_key=settings.libertai_api_key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.initialize()
    yield
    await db.close()


app = FastAPI(title=f"Baal Agent: {settings.agent_name}", lifespan=lifespan)


@app.middleware("http")
async def verify_auth(request: Request, call_next):
    """Reject requests without a valid Bearer token (except /health)."""
    if request.url.path == "/health":
        return await call_next(request)
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token or not secrets.compare_digest(token, settings.agent_secret):
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    return await call_next(request)


class ChatRequest(BaseModel):
    message: str
    chat_id: str


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/chat")
async def chat(req: ChatRequest):
    """Handle a proxied chat message with SSE streaming and tool use."""

    async def event_stream():
        # Store the incoming user message
        await db.add_message(req.chat_id, "user", req.message)

        # Build conversation with system prompt + history
        history = await db.get_history(req.chat_id, limit=settings.max_history)
        messages = [{"role": "system", "content": settings.system_prompt}]
        messages.extend(history)

        for _iteration in range(settings.max_tool_iterations):
            # Call LLM with tools
            assistant_msg = await inference.chat(
                messages=messages, model=settings.model, tools=TOOL_DEFINITIONS
            )

            # Extract text content
            text_content = assistant_msg.content

            # Extract tool calls
            tool_calls = assistant_msg.tool_calls

            # Build the serializable tool_calls for DB storage
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

            # Store assistant message
            await db.add_message(
                req.chat_id, "assistant", text_content, tool_calls=tc_for_db
            )

            # Append assistant message to conversation for next iteration
            assistant_dict: dict = {"role": "assistant"}
            if text_content:
                assistant_dict["content"] = text_content
            if tc_for_db:
                assistant_dict["tool_calls"] = tc_for_db
            messages.append(assistant_dict)

            # Yield text if present
            if text_content:
                yield _sse_event({"type": "text", "content": text_content})

            # If no tool calls, we're done
            if not tool_calls:
                yield _sse_event({"type": "done"})
                return

            # Execute each tool call and yield events
            for tc in tool_calls:
                name = tc.function.name
                arguments = tc.function.arguments
                yield _sse_event({"type": "tool_use", "name": name, "input": arguments})

                result = await execute_tool(name, arguments)

                # Store tool result
                await db.add_message(
                    req.chat_id, "tool", result, tool_call_id=tc.id
                )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

            # Loop continues — LLM gets tool results and decides next step

        # Hit max iterations — send final message
        yield _sse_event({"type": "text", "content": "(Reached maximum tool iterations)"})
        yield _sse_event({"type": "done"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/health")
async def health():
    return {"status": "ok", "agent_name": settings.agent_name}
