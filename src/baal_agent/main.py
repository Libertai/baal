"""FastAPI application deployed to each agent VM."""

import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from baal_agent.config import AgentSettings
from baal_agent.database import AgentDatabase
from baal_agent.inference import InferenceClient

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


class ChatResponse(BaseModel):
    response: str


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Handle a proxied chat message."""
    # Store the incoming user message
    await db.add_message(req.chat_id, "user", req.message)

    # Build conversation with system prompt + history
    history = await db.get_history(req.chat_id, limit=settings.max_history)
    messages = [{"role": "system", "content": settings.system_prompt}]
    messages.extend(history)

    # Generate response
    reply = await inference.chat(messages=messages, model=settings.model)

    # Store and return
    await db.add_message(req.chat_id, "assistant", reply)
    return ChatResponse(response=reply)


@app.get("/health")
async def health():
    return {"status": "ok", "agent_name": settings.agent_name}
