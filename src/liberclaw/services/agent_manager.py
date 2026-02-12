"""Agent CRUD and deployment orchestration."""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.deployer import AlephDeployer
from baal_core.encryption import encrypt
from baal_core.models import AVAILABLE_MODELS
from liberclaw.database.models import Agent, DeploymentHistory

logger = logging.getLogger(__name__)


async def create_agent(
    db: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    system_prompt: str,
    model: str,
    encryption_key: str,
) -> Agent:
    """Create a new agent record with an encrypted auth token."""
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model}")

    agent_secret = secrets.token_urlsafe(32)
    encrypted_secret = encrypt(agent_secret, encryption_key)

    agent = Agent(
        owner_id=owner_id,
        name=name,
        system_prompt=system_prompt,
        model=model,
        auth_token=encrypted_secret,
        deployment_status="pending",
        source="web",
    )
    db.add(agent)
    await db.flush()
    return agent


async def list_agents(db: AsyncSession, owner_id: uuid.UUID) -> list[Agent]:
    """List all agents for a user."""
    result = await db.execute(
        select(Agent)
        .where(Agent.owner_id == owner_id)
        .order_by(Agent.created_at.desc())
    )
    return list(result.scalars().all())


async def get_agent(
    db: AsyncSession, agent_id: uuid.UUID, owner_id: uuid.UUID
) -> Agent | None:
    """Get an agent by ID, verifying ownership."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def update_agent(
    db: AsyncSession,
    agent: Agent,
    name: str | None = None,
    system_prompt: str | None = None,
    model: str | None = None,
) -> Agent:
    """Update agent configuration fields."""
    if name is not None:
        agent.name = name
    if system_prompt is not None:
        agent.system_prompt = system_prompt
    if model is not None:
        if model not in AVAILABLE_MODELS:
            raise ValueError(f"Unknown model: {model}")
        agent.model = model
    await db.flush()
    return agent


async def delete_agent(
    db: AsyncSession, agent: Agent, deployer: AlephDeployer
) -> None:
    """Delete an agent and destroy its VM."""
    if agent.instance_hash:
        try:
            await deployer.destroy_instance(agent.instance_hash)
        except Exception as e:
            logger.error(f"Failed to destroy VM for agent {agent.id}: {e}")
    await db.delete(agent)


async def deploy_agent_background(
    agent_id: uuid.UUID,
    deployer: AlephDeployer,
    libertai_api_key: str,
    encryption_key: str,
    db_factory,
) -> None:
    """Background task: deploy an agent to Aleph Cloud.

    Creates its own DB session since this runs outside request lifecycle.
    """
    from baal_core.encryption import decrypt

    deploy_start = time.monotonic()

    async with db_factory() as db:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent:
            logger.error(f"Agent {agent_id} not found for deployment")
            return

        agent.deployment_status = "deploying"
        await db.commit()

        try:
            agent_secret = decrypt(agent.auth_token, encryption_key)

            # Step 1: Create VM instance
            create_result = await deployer.create_instance(agent.name)
            if create_result.get("status") != "success":
                agent.deployment_status = "failed"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="create_instance",
                    error_message=create_result.get("error", "Unknown error"),
                ))
                await db.commit()
                return

            instance_hash = create_result["instance_hash"]
            crn_url = create_result["crn_url"]
            agent.instance_hash = instance_hash
            agent.crn_url = crn_url
            await db.commit()

            # Step 2: Wait for VM allocation
            alloc = await deployer.wait_for_allocation(instance_hash, crn_url)
            if not alloc:
                agent.deployment_status = "failed"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="wait_allocation",
                    error_message="Allocation timed out",
                ))
                await db.commit()
                return

            vm_ip = alloc["vm_ipv4"]
            ssh_port = alloc.get("ssh_port", 22)

            # Step 3: Deploy agent code
            deploy_result = await deployer.deploy_agent(
                vm_ip=vm_ip,
                ssh_port=ssh_port,
                agent_name=agent.name,
                system_prompt=agent.system_prompt,
                model=agent.model,
                libertai_api_key=libertai_api_key,
                agent_secret=agent_secret,
                instance_hash=instance_hash,
                owner_chat_id=str(agent.owner_id),
            )

            duration = int(time.monotonic() - deploy_start)

            if deploy_result.get("status") == "success":
                agent.vm_url = deploy_result["vm_url"]
                agent.deployment_status = "running"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="success",
                    step="complete", duration_seconds=duration,
                ))
            else:
                agent.deployment_status = "failed"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="deploy_agent",
                    error_message=deploy_result.get("error", "Unknown error"),
                    duration_seconds=duration,
                ))

            await db.commit()

        except Exception as e:
            logger.error(f"Deployment failed for agent {agent_id}: {e}", exc_info=True)
            agent.deployment_status = "failed"
            db.add(DeploymentHistory(
                agent_id=agent_id, status="failed",
                step="unexpected_error", error_message=str(e),
            ))
            await db.commit()
