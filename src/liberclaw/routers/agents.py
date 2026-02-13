"""Agent CRUD and deployment routes."""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.encryption import decrypt
from baal_core.proxy import health_check
from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import Agent, User
from liberclaw.database.session import get_db, get_session_factory
from liberclaw.schemas.agents import (
    AgentCreate,
    AgentHealthResponse,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
    DeploymentLogEntry,
    DeploymentStatusResponse,
    DeploymentStepResponse,
)
from liberclaw.services.agent_manager import (
    create_agent,
    delete_agent,
    deploy_agent_background,
    get_agent,
    list_agents,
    update_agent,
)
from liberclaw.services.usage_tracker import get_agent_count

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=AgentListResponse)
async def list_user_agents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agents owned by the current user."""
    agents = await list_agents(db, user.id)
    return AgentListResponse(
        agents=[AgentResponse.model_validate(a) for a in agents],
        total=len(agents),
    )


@router.post("/", response_model=AgentResponse, status_code=201)
async def create_user_agent(
    body: AgentCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent and start background deployment."""
    settings = get_settings()

    # Check agent limit
    agent_limit = settings.agent_limit(user.tier)
    count = await get_agent_count(db, user.id)
    if count >= agent_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Agent limit reached ({agent_limit})",
        )

    agent = await create_agent(
        db, user.id, body.name, body.system_prompt, body.model,
        settings.encryption_key,
    )
    await db.commit()

    # Launch background deployment
    from baal_core.deployer import AlephDeployer

    deployer = AlephDeployer(
        private_key=settings.aleph_private_key,
        ssh_pubkey=settings.aleph_ssh_pubkey,
        ssh_privkey_path=settings.aleph_ssh_privkey_path,
    )
    background_tasks.add_task(
        deploy_agent_background,
        agent_id=agent.id,
        deployer=deployer,
        libertai_api_key=settings.libertai_api_key,
        encryption_key=settings.encryption_key,
        db_factory=get_session_factory(),
    )

    return AgentResponse.model_validate(agent)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_user_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get agent details."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_user_agent(
    agent_id: uuid.UUID,
    body: AgentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update agent configuration."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        agent = await update_agent(
            db, agent, name=body.name,
            system_prompt=body.system_prompt, model=body.model,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=204)
async def delete_user_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent and destroy its VM."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    settings = get_settings()
    from baal_core.deployer import AlephDeployer

    deployer = AlephDeployer(
        private_key=settings.aleph_private_key,
        ssh_pubkey=settings.aleph_ssh_pubkey,
        ssh_privkey_path=settings.aleph_ssh_privkey_path,
    )
    await delete_agent(db, agent, deployer)


@router.get("/{agent_id}/health", response_model=AgentHealthResponse)
async def check_agent_health(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if an agent's VM is healthy."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    healthy = False
    if agent.vm_url:
        healthy = await health_check(agent.vm_url)

    return AgentHealthResponse(
        agent_id=agent.id, healthy=healthy, vm_url=agent.vm_url,
    )


@router.get("/{agent_id}/status", response_model=DeploymentStatusResponse)
async def get_deployment_status(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get deployment progress (poll during creation)."""
    from liberclaw.services.deployment_progress import get_progress

    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    progress = get_progress(agent.id)
    steps = []
    logs = []
    if progress:
        steps = [
            DeploymentStepResponse(
                key=s.key, status=s.status, detail=s.detail,
            )
            for s in progress.steps
        ]
        logs = [
            DeploymentLogEntry(
                timestamp=l.timestamp, level=l.level, message=l.message,
            )
            for l in progress.logs
        ]

    return DeploymentStatusResponse(
        agent_id=agent.id,
        deployment_status=agent.deployment_status,
        vm_url=agent.vm_url,
        steps=steps,
        logs=logs,
    )


@router.post("/{agent_id}/repair", response_model=AgentResponse)
async def repair_agent(
    agent_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retry a failed deployment."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.deployment_status not in ("failed", "pending", "running"):
        raise HTTPException(status_code=400, detail="Agent is not in a repairable state")

    agent.deployment_status = "pending"
    await db.commit()

    settings = get_settings()
    from baal_core.deployer import AlephDeployer

    deployer = AlephDeployer(
        private_key=settings.aleph_private_key,
        ssh_pubkey=settings.aleph_ssh_pubkey,
        ssh_privkey_path=settings.aleph_ssh_privkey_path,
    )
    background_tasks.add_task(
        deploy_agent_background,
        agent_id=agent.id,
        deployer=deployer,
        libertai_api_key=settings.libertai_api_key,
        encryption_key=settings.encryption_key,
        db_factory=get_session_factory(),
    )

    return AgentResponse.model_validate(agent)


@router.post("/{agent_id}/redeploy", response_model=AgentResponse)
async def redeploy_agent(
    agent_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Push latest code to a running agent's VM."""
    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.deployment_status != "running":
        raise HTTPException(status_code=400, detail="Agent is not running")

    agent.deployment_status = "deploying"
    await db.commit()

    settings = get_settings()
    from baal_core.deployer import AlephDeployer

    deployer = AlephDeployer(
        private_key=settings.aleph_private_key,
        ssh_pubkey=settings.aleph_ssh_pubkey,
        ssh_privkey_path=settings.aleph_ssh_privkey_path,
    )
    background_tasks.add_task(
        deploy_agent_background,
        agent_id=agent.id,
        deployer=deployer,
        libertai_api_key=settings.libertai_api_key,
        encryption_key=settings.encryption_key,
        db_factory=get_session_factory(),
    )

    return AgentResponse.model_validate(agent)
