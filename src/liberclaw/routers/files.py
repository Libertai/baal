"""File proxy — download, upload, and browse files on agent VMs."""

from __future__ import annotations

import uuid

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.encryption import decrypt
from baal_core.proxy import download_agent_file
from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import User
from liberclaw.database.session import get_db
from liberclaw.services.agent_manager import get_agent

router = APIRouter(prefix="/files", tags=["files"])

_PROXY_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0)


async def _get_agent_auth(db, agent_id, user_id):
    """Fetch agent + decrypt auth token, or raise HTTP error."""
    settings = get_settings()
    agent = await get_agent(db, agent_id, user_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.vm_url:
        raise HTTPException(status_code=400, detail="Agent has no VM")
    auth_token = decrypt(agent.auth_token, settings.encryption_key)
    return agent, auth_token


@router.get("/{agent_id}/tree")
async def get_workspace_tree(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Proxy workspace tree from agent VM."""
    agent, auth_token = await _get_agent_auth(db, agent_id, user.id)
    try:
        async with httpx.AsyncClient(timeout=_PROXY_TIMEOUT) as client:
            resp = await client.get(
                f"{agent.vm_url}/workspace/tree",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Agent error")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach agent")


@router.post("/{agent_id}/upload")
async def upload_file(
    agent_id: uuid.UUID,
    file: UploadFile = File(...),
    path: str = Form(default="uploads"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Proxy file upload to agent VM."""
    agent, auth_token = await _get_agent_auth(db, agent_id, user.id)
    content = await file.read()
    try:
        async with httpx.AsyncClient(timeout=_PROXY_TIMEOUT) as client:
            resp = await client.post(
                f"{agent.vm_url}/files/upload",
                headers={"Authorization": f"Bearer {auth_token}"},
                files={"file": (file.filename, content, file.content_type or "application/octet-stream")},
                data={"path": path},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Upload failed")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach agent")


@router.get("/{agent_id}/{path:path}")
async def proxy_file(
    agent_id: uuid.UUID,
    path: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a file from an agent VM."""
    agent, auth_token = await _get_agent_auth(db, agent_id, user.id)
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
