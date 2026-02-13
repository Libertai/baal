"""LiberClaw API server — FastAPI app with lifespan, CORS, router mounting."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select, update

from liberclaw.auth.dependencies import set_settings
from liberclaw.config import LiberClawSettings
from liberclaw.database.session import close_engine, get_session_factory, init_engine
from liberclaw.routers import activity, agents, auth, chat, files, health, network, templates, usage, users

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    settings: LiberClawSettings = app.state.settings

    # Initialize database
    init_engine(settings)
    logger.info("Database engine initialized")

    # Store settings for auth dependencies
    set_settings(settings)

    # Reset agents stuck in "deploying" (killed mid-deploy by process restart)
    from liberclaw.database.models import Agent

    async with get_session_factory()() as db:
        result = await db.execute(
            select(Agent.id, Agent.name).where(Agent.deployment_status == "deploying")
        )
        stuck = result.all()
        if stuck:
            await db.execute(
                update(Agent)
                .where(Agent.deployment_status == "deploying")
                .values(deployment_status="failed")
            )
            await db.commit()
            for agent_id, name in stuck:
                logger.warning(f"Reset stuck agent '{name}' ({agent_id}) from deploying → failed")

    yield

    # Shutdown
    await close_engine()
    logger.info("Database engine closed")


def create_app(settings: LiberClawSettings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    if settings is None:
        settings = LiberClawSettings()

    app = FastAPI(
        title="LiberClaw API",
        description="AI agent management platform on Aleph Cloud",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount routers under /api/v1
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(agents.router, prefix="/api/v1")
    app.include_router(templates.router, prefix="/api/v1")
    app.include_router(templates.skills_router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(files.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(usage.router, prefix="/api/v1")
    app.include_router(network.router, prefix="/api/v1")
    app.include_router(activity.router, prefix="/api/v1")

    return app


# Default app instance for `uvicorn liberclaw.main:app`
app = create_app()
