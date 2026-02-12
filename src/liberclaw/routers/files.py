"""File proxy — download files from agent VMs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.encryption import decrypt
from baal_core.proxy import download_agent_file
from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import User
from liberclaw.database.session import get_db
from liberclaw.services.agent_manager import get_agent

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{agent_id}/{path:path}")
async def proxy_file(
    agent_id: uuid.UUID,
    path: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a file from an agent VM."""
    settings = get_settings()

    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.vm_url:
        raise HTTPException(status_code=400, detail="Agent has no VM")

    auth_token = decrypt(agent.auth_token, settings.encryption_key)
    result = await download_agent_file(agent.vm_url, auth_token, path)

    if not result:
        raise HTTPException(status_code=404, detail="File not found")

    data, filename, is_photo = result
    content_type = "image/png" if is_photo else "application/octet-stream"
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
