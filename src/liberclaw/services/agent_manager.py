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
    Updates the in-memory progress store for real-time frontend tracking.
    """
    from baal_core.encryption import decrypt
    from baal_core.proxy import health_check

    from liberclaw.services.deployment_progress import (
        add_log,
        clear_progress,
        init_progress,
        set_step,
    )

    deploy_start = time.monotonic()
    init_progress(agent_id)

    def on_deploy_progress(step_key: str, status: str, detail: str) -> None:
        """Callback from deployer.deploy_agent() for sub-step updates."""
        set_step(agent_id, step_key, status, detail)
        level = "success" if status == "done" else "error" if status == "failed" else "info"
        add_log(agent_id, level, detail)

    async with db_factory() as db:
        result = await db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent:
            logger.error(f"Agent {agent_id} not found for deployment")
            clear_progress(agent_id)
            return

        agent.deployment_status = "deploying"
        await db.commit()

        try:
            agent_secret = decrypt(agent.auth_token, encryption_key)

            # ── Step 1: Infrastructure Provisioning ────────────────────
            set_step(agent_id, "provisioning", "active")
            add_log(agent_id, "info", "Discovering compute nodes...")

            create_result = await deployer.create_instance(agent.name)

            if create_result.get("status") != "success":
                error = create_result.get("error", "Unknown error")
                set_step(agent_id, "provisioning", "failed", error)
                add_log(agent_id, "error", f"Provisioning failed: {error}")
                agent.deployment_status = "failed"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="create_instance", error_message=error,
                ))
                await db.commit()
                return

            instance_hash = create_result["instance_hash"]
            crn_url = create_result["crn_url"]
            agent.instance_hash = instance_hash
            agent.crn_url = crn_url
            await db.commit()

            set_step(agent_id, "provisioning", "done",
                     f"VM created (instance: {instance_hash[:12]}...)")
            add_log(agent_id, "success",
                    f"Instance {instance_hash[:12]}... created on CRN")

            # ── Step 2: Network Allocation ─────────────────────────────
            set_step(agent_id, "allocation", "active",
                     "Waiting for VM to come online...")
            add_log(agent_id, "info", "Polling for VM allocation...")

            alloc = await deployer.wait_for_allocation(instance_hash, crn_url)

            if not alloc:
                set_step(agent_id, "allocation", "failed",
                         "Allocation timed out after 120s")
                add_log(agent_id, "error", "VM allocation timed out")
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

            set_step(agent_id, "allocation", "done",
                     f"VM online at {vm_ip}:{ssh_port}")
            add_log(agent_id, "success",
                    f"VM allocated: {vm_ip}:{ssh_port}")

            # ── Steps 3-5: Deploy agent (SSH → environment → service) ──
            # The deployer calls on_deploy_progress for sub-step updates
            add_log(agent_id, "info", "Starting agent deployment...")

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
                on_progress=on_deploy_progress,
            )

            if deploy_result.get("status") != "success":
                error = deploy_result.get("error", "Unknown error")
                add_log(agent_id, "error", f"Deployment failed: {error}")
                agent.deployment_status = "failed"
                duration = int(time.monotonic() - deploy_start)
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="deploy_agent", error_message=error,
                    duration_seconds=duration,
                ))
                await db.commit()
                return

            vm_url = deploy_result["vm_url"]

            # ── Step 6: Health Check ───────────────────────────────────
            set_step(agent_id, "health", "active",
                     "Verifying agent is responding...")
            add_log(agent_id, "info", f"Checking health at {vm_url}/health...")

            # Give the agent time to start + Caddy time to obtain TLS cert
            healthy = False
            for attempt in range(12):  # 12 attempts × 10s = 120s max
                await asyncio.sleep(10)
                healthy = await health_check(vm_url)
                if healthy:
                    break
                if attempt < 11:
                    add_log(agent_id, "info",
                            f"Waiting for agent startup ({(attempt + 1) * 10}s)...")

            duration = int(time.monotonic() - deploy_start)

            if healthy:
                set_step(agent_id, "health", "done",
                         f"Agent responding on {vm_url}")
                add_log(agent_id, "success",
                        f"Health check passed. Deployment complete in {duration}s.")
                agent.vm_url = vm_url
                agent.deployment_status = "running"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="success",
                    step="complete", duration_seconds=duration,
                ))
            else:
                set_step(agent_id, "health", "failed",
                         "Agent is not responding after deployment")
                add_log(agent_id, "error",
                        "Health check failed — agent deployed but not responding. Use Repair to retry.")
                agent.vm_url = vm_url
                agent.deployment_status = "failed"
                db.add(DeploymentHistory(
                    agent_id=agent_id, status="failed",
                    step="health_check",
                    error_message="Agent not responding after 120s",
                    duration_seconds=duration,
                ))

            await db.commit()

        except Exception as e:
            logger.error(f"Deployment failed for agent {agent_id}: {e}", exc_info=True)
            add_log(agent_id, "error", f"Unexpected error: {e}")
            agent.deployment_status = "failed"
            db.add(DeploymentHistory(
                agent_id=agent_id, status="failed",
                step="unexpected_error", error_message=str(e),
            ))
            await db.commit()
        finally:
            # Keep progress in store briefly so the final poll can see the result
            # (the frontend will stop polling once it sees "running" or "failed")
            await asyncio.sleep(10)
            clear_progress(agent_id)
