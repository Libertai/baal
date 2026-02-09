"""Aleph Cloud deployer — instance creation, allocation polling, SSH deployment."""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import shlex
import textwrap
from typing import Optional

import httpx

try:
    from aleph.sdk import AuthenticatedAlephHttpClient
    from aleph.sdk.chains.ethereum import ETHAccount
    from aleph.sdk.client.vm_client import VmClient
    from aleph.sdk.conf import settings as aleph_settings
    from aleph.sdk.types import StorageEnum
    from aleph_message.models import Chain
    from aleph_message.models.execution.base import Payment, PaymentType
    from aleph_message.models.execution.environment import HypervisorType

    ALEPH_SDK_AVAILABLE = True
except ImportError:
    ALEPH_SDK_AVAILABLE = False

logger = logging.getLogger(__name__)

ROOTFS_IMAGES = {
    "debian12": "6e30de68c6cedfa6b45240c2b51e52495ac6fb1888c60c6e6c7b5ee3d3a8c47e",
}

GATEWAY_API_URL = "https://api.2n6.me"


def _safe_write_file_command(content: str, filepath: str) -> str:
    """Generate a safe SSH command to write file content via base64 (prevents injection)."""
    encoded = base64.b64encode(content.encode()).decode()
    safe_path = shlex.quote(filepath)
    return f"echo '{encoded}' | base64 -d > {safe_path}"


class AlephDeployer:
    """Creates and manages Aleph Cloud VM instances for agents."""

    def __init__(
        self,
        private_key: str,
        ssh_pubkey: str,
        ssh_privkey_path: str = "~/.ssh/id_rsa",
    ):
        self.ssh_pubkey = ssh_pubkey
        self.ssh_privkey_path = os.path.expanduser(ssh_privkey_path)
        self._account = None

        if ALEPH_SDK_AVAILABLE:
            pk = private_key.removeprefix("0x")
            try:
                self._account = ETHAccount(private_key=bytes.fromhex(pk))
            except Exception as e:
                logger.error(f"Failed to load Aleph account: {e}")

    # ── CRN discovery ──────────────────────────────────────────────────

    async def get_available_crns(self) -> list[dict]:
        """Fetch active CRNs from the scheduler, sorted by score descending."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "https://scheduler.api.aleph.cloud/api/v0/allocation/resource_nodes"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    crns = []
                    for node in data.get("resource_nodes", []):
                        if (
                            node.get("status") == "active"
                            and node.get("payment_receiver_address")
                        ):
                            crns.append(
                                {
                                    "hash": node.get("hash"),
                                    "name": node.get("name"),
                                    "url": node.get("address"),
                                    "payment_address": node.get(
                                        "payment_receiver_address"
                                    ),
                                    "score": node.get("score", 0),
                                }
                            )
                    crns.sort(key=lambda x: x.get("score", 0), reverse=True)
                    return crns
        except Exception as e:
            logger.warning(f"Failed to fetch CRNs: {e}")
        return []

    # ── Instance creation ──────────────────────────────────────────────

    async def create_instance(self, agent_name: str) -> dict:
        """Create an Aleph Cloud VM instance using credits payment.

        Returns dict with 'status', 'instance_hash', 'crn_url', etc.
        """
        if not ALEPH_SDK_AVAILABLE:
            return {"status": "error", "error": "aleph-sdk-python not installed"}
        if not self._account:
            return {"status": "error", "error": "No Aleph account configured"}

        # Auto-select CRN
        crns = await self.get_available_crns()
        if not crns:
            return {"status": "error", "error": "No CRNs available"}

        selected = crns[0]
        crn_url = selected["url"]
        if not crn_url.startswith("http"):
            crn_url = f"https://{crn_url}"
        crn_url = crn_url.rstrip("/")

        payment = Payment(
            chain=Chain.ETH,
            type=PaymentType.credit,
            receiver=selected["payment_address"],
        )

        try:
            async with AuthenticatedAlephHttpClient(
                account=self._account, api_server=aleph_settings.API_HOST
            ) as client:
                message, status = await client.create_instance(
                    rootfs=ROOTFS_IMAGES["debian12"],
                    rootfs_size=20480,
                    payment=payment,
                    vcpus=1,
                    memory=2048,
                    ssh_keys=[self.ssh_pubkey],
                    hypervisor=HypervisorType.qemu,
                    metadata={"name": f"baal-agent-{agent_name}"},
                    channel="BAAL",
                    storage_engine=StorageEnum.storage,
                    sync=True,
                )

                instance_hash = str(message.item_hash)
                logger.info(f"Instance created: {instance_hash}")

                # Notify CRN to start
                await asyncio.sleep(2)
                async with VmClient(self._account, crn_url) as vm_client:
                    start_status, start_result = await vm_client.start_instance(
                        instance_hash
                    )
                    if start_status != 200:
                        logger.warning(
                            f"CRN start returned {start_status}: {start_result}"
                        )

                return {
                    "status": "success",
                    "instance_hash": instance_hash,
                    "crn_url": crn_url,
                }

        except Exception as e:
            logger.error(f"Instance creation failed: {e}")
            return {"status": "error", "error": str(e)}

    # ── Allocation polling ─────────────────────────────────────────────

    async def wait_for_allocation(
        self,
        instance_hash: str,
        crn_url: str,
        retries: int = 12,
        delay: int = 10,
    ) -> dict | None:
        """Poll until the VM is allocated. Returns {vm_ipv4, ssh_port} or None."""
        if not crn_url.startswith("http"):
            crn_url = f"https://{crn_url}"
        crn_url = crn_url.rstrip("/")

        for attempt in range(retries):
            logger.info(
                f"Polling allocation for {instance_hash} (attempt {attempt + 1}/{retries})"
            )
            result = await self._check_allocation(instance_hash, crn_url)
            if result:
                return result
            await asyncio.sleep(delay)

        logger.error(f"Allocation timed out for {instance_hash}")
        return None

    async def _check_allocation(
        self, instance_hash: str, crn_url: str
    ) -> dict | None:
        """Single allocation check — try CRN first, then scheduler."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try CRN execution list
            for api_path in [
                "/v2/about/executions/list",
                "/about/executions/list",
            ]:
                try:
                    resp = await client.get(
                        f"{crn_url}{api_path}", timeout=10.0
                    )
                    if resp.status_code == 200:
                        executions = resp.json()
                        if (
                            isinstance(executions, dict)
                            and instance_hash in executions
                        ):
                            vm_data = executions[instance_hash]
                            net = vm_data.get("networking", {})
                            vm_ipv4 = net.get("host_ipv4")
                            ssh_port = 22
                            mapped = net.get("mapped_ports", {})
                            if "22" in mapped:
                                ssh_port = mapped["22"].get("host", 22)
                            if vm_ipv4:
                                return {"vm_ipv4": vm_ipv4, "ssh_port": ssh_port}
                except Exception:
                    continue

            # Fallback: scheduler
            try:
                resp = await client.get(
                    "https://scheduler.api.aleph.cloud/api/v0/allocation",
                    params={"item_hash": instance_hash},
                    timeout=10.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict):
                        vm_ipv4 = (
                            data.get("vm_ipv4")
                            or data.get("ipv4")
                            or data.get("ip")
                        )
                        ssh_port = data.get("ssh_port", 22)
                        if vm_ipv4:
                            return {"vm_ipv4": vm_ipv4, "ssh_port": ssh_port}
            except Exception:
                pass

        return None

    # ── 2n6.me subdomain lookup ────────────────────────────────────────

    async def lookup_subdomain(self, instance_hash: str) -> str | None:
        """Look up the 2n6.me subdomain for an instance via the gateway API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{GATEWAY_API_URL}/api/hash/{instance_hash}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("subdomain")
        except Exception as e:
            logger.warning(f"Gateway lookup failed for {instance_hash}: {e}")
        return None

    # ── SSH deployment ─────────────────────────────────────────────────

    async def _ssh_run(
        self, host: str, port: int, command: str, timeout: int = 120
    ) -> tuple[int, str, str]:
        """Run a command on the remote host via SSH using asyncio subprocess."""
        ssh_cmd = [
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=10",
            "-p", str(port),
        ]
        if os.path.exists(self.ssh_privkey_path):
            ssh_cmd.extend(["-i", self.ssh_privkey_path])
        ssh_cmd.append(f"root@{host}")
        ssh_cmd.append(command)

        try:
            process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )
            return (
                process.returncode or 0,
                stdout.decode("utf-8", errors="replace"),
                stderr.decode("utf-8", errors="replace"),
            )
        except asyncio.TimeoutError:
            return (124, "", f"Command timed out after {timeout}s")
        except Exception as e:
            return (1, "", str(e))

    async def deploy_agent(
        self,
        vm_ip: str,
        ssh_port: int,
        agent_name: str,
        system_prompt: str,
        model: str,
        libertai_api_key: str,
        agent_secret: str,
        instance_hash: str,
    ) -> dict:
        """SSH into a VM and deploy the agent code + Caddy reverse proxy.

        Returns dict with 'status' and 'vm_url'.
        """
        steps: list[dict] = []

        # Wait for SSH to be ready
        for attempt in range(6):
            code, out, _ = await self._ssh_run(vm_ip, ssh_port, "echo ready", timeout=15)
            if code == 0 and "ready" in out:
                break
            await asyncio.sleep(10)
        else:
            return {"status": "error", "error": "SSH not reachable", "steps": steps}

        steps.append({"step": "ssh_connected", "success": True})

        # Install Python + deps
        install_cmd = (
            "apt-get update -qq && "
            "apt-get install -y -qq python3 python3-pip python3-venv && "
            "python3 -m venv /opt/baal-agent && "
            "/opt/baal-agent/bin/pip install fastapi uvicorn openai aiosqlite pydantic-settings"
        )
        code, _, stderr = await self._ssh_run(vm_ip, ssh_port, install_cmd, timeout=300)
        steps.append({"step": "install_deps", "success": code == 0})
        if code != 0:
            return {"status": "error", "error": f"Dep install failed: {stderr}", "steps": steps}

        # Write agent code files
        agent_dir = "/opt/baal-agent/app"
        await self._ssh_run(vm_ip, ssh_port, f"mkdir -p {agent_dir}/baal_agent")

        agent_files = self._build_agent_files()
        for filename, content in agent_files.items():
            filepath = f"{agent_dir}/baal_agent/{filename}"
            cmd = _safe_write_file_command(content, filepath)
            code, _, stderr = await self._ssh_run(vm_ip, ssh_port, cmd)
            if code != 0:
                return {
                    "status": "error",
                    "error": f"Failed to write {filename}: {stderr}",
                    "steps": steps,
                }

        steps.append({"step": "write_agent_code", "success": True})

        # Write .env file
        env_content = (
            f"AGENT_NAME={agent_name}\n"
            f"SYSTEM_PROMPT={system_prompt}\n"
            f"MODEL={model}\n"
            f"LIBERTAI_API_KEY={libertai_api_key}\n"
            f"AGENT_SECRET={agent_secret}\n"
            f"PORT=8080\n"
            f"DB_PATH=/opt/baal-agent/app/agent.db\n"
        )
        cmd = _safe_write_file_command(env_content, f"{agent_dir}/.env")
        code, _, _ = await self._ssh_run(vm_ip, ssh_port, cmd)
        steps.append({"step": "write_env", "success": code == 0})

        # Create systemd service
        service_content = textwrap.dedent(f"""\
            [Unit]
            Description=Baal Agent - {agent_name}
            After=network.target

            [Service]
            Type=simple
            WorkingDirectory={agent_dir}
            EnvironmentFile={agent_dir}/.env
            Environment=PYTHONPATH={agent_dir}
            ExecStart=/opt/baal-agent/bin/uvicorn baal_agent.main:app --host 127.0.0.1 --port 8080
            Restart=always
            RestartSec=5

            [Install]
            WantedBy=multi-user.target
        """)
        cmd = _safe_write_file_command(service_content, "/etc/systemd/system/baal-agent.service")
        await self._ssh_run(vm_ip, ssh_port, cmd)

        # Start agent service
        code, _, stderr = await self._ssh_run(
            vm_ip, ssh_port,
            "systemctl daemon-reload && systemctl enable baal-agent && systemctl start baal-agent",
        )
        steps.append({"step": "start_agent", "success": code == 0})
        if code != 0:
            return {"status": "error", "error": f"Service start failed: {stderr}", "steps": steps}

        # Look up 2n6.me subdomain
        subdomain = await self.lookup_subdomain(instance_hash)
        if not subdomain:
            return {
                "status": "error",
                "error": "Could not resolve 2n6.me subdomain",
                "steps": steps,
            }

        fqdn = f"{subdomain}.2n6.me"

        # Install and configure Caddy
        caddy_install = (
            "apt-get update -qq && "
            "apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl && "
            "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && "
            "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && "
            "apt-get update -qq && apt-get install -y -qq caddy"
        )
        code, _, _ = await self._ssh_run(vm_ip, ssh_port, "which caddy")
        if code != 0:
            code, _, stderr = await self._ssh_run(vm_ip, ssh_port, caddy_install, timeout=120)
            if code != 0:
                return {"status": "error", "error": f"Caddy install failed: {stderr}", "steps": steps}

        caddyfile = f"{fqdn} {{\n    reverse_proxy localhost:8080\n}}\n"
        cmd = _safe_write_file_command(caddyfile, "/etc/caddy/Caddyfile")
        await self._ssh_run(vm_ip, ssh_port, cmd)
        code, _, stderr = await self._ssh_run(
            vm_ip, ssh_port,
            "systemctl stop caddy 2>/dev/null; systemctl enable caddy && systemctl start caddy",
        )
        steps.append({"step": "caddy_proxy", "success": code == 0})
        if code != 0:
            return {"status": "error", "error": f"Caddy start failed: {stderr}", "steps": steps}

        vm_url = f"https://{fqdn}"
        return {"status": "success", "vm_url": vm_url, "steps": steps}

    def _build_agent_files(self) -> dict[str, str]:
        """Return the agent source files as a dict of filename -> content."""
        files: dict[str, str] = {}

        files["__init__.py"] = ""

        files["config.py"] = textwrap.dedent("""\
            from pydantic_settings import BaseSettings

            class AgentSettings(BaseSettings):
                model_config = {"env_prefix": ""}
                agent_name: str = "Agent"
                system_prompt: str = "You are a helpful assistant."
                model: str = "hermes-3-8b-tee"
                libertai_api_key: str
                agent_secret: str
                port: int = 8080
                db_path: str = "agent.db"
                max_history: int = 20
        """)

        files["database.py"] = textwrap.dedent("""\
            from __future__ import annotations
            from datetime import datetime, timezone
            import aiosqlite

            class AgentDatabase:
                def __init__(self, db_path: str = "agent.db") -> None:
                    self.db_path = db_path
                    self._db: aiosqlite.Connection | None = None

                async def initialize(self) -> None:
                    self._db = await aiosqlite.connect(self.db_path)
                    self._db.row_factory = aiosqlite.Row
                    await self._db.execute("PRAGMA journal_mode=WAL")
                    await self._db.executescript(
                        "CREATE TABLE IF NOT EXISTS messages ("
                        "    id INTEGER PRIMARY KEY AUTOINCREMENT,"
                        "    chat_id TEXT NOT NULL,"
                        "    role TEXT NOT NULL,"
                        "    content TEXT NOT NULL,"
                        "    created_at TEXT NOT NULL DEFAULT (datetime('now'))"
                        ");"
                        "CREATE INDEX IF NOT EXISTS idx_messages_chat"
                        "    ON messages (chat_id, created_at);"
                    )

                async def close(self) -> None:
                    if self._db is not None:
                        await self._db.close()
                        self._db = None

                @property
                def db(self) -> aiosqlite.Connection:
                    if self._db is None:
                        raise RuntimeError("Database not initialized")
                    return self._db

                async def add_message(self, chat_id: str, role: str, content: str) -> None:
                    now = datetime.now(timezone.utc).isoformat()
                    await self.db.execute(
                        "INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                        (chat_id, role, content, now),
                    )
                    await self.db.commit()

                async def get_history(self, chat_id: str, limit: int = 20) -> list[dict]:
                    cursor = await self.db.execute(
                        "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
                        (chat_id, limit),
                    )
                    rows = await cursor.fetchall()
                    return [dict(r) for r in reversed(rows)]
        """)

        files["inference.py"] = textwrap.dedent("""\
            import asyncio
            from openai import AsyncOpenAI

            class InferenceClient:
                def __init__(self, api_key: str, base_url: str = "https://api.libertai.io/v1"):
                    self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)

                async def chat(self, messages: list[dict], model: str) -> str:
                    try:
                        response = await self.client.chat.completions.create(
                            model=model, messages=messages
                        )
                    except Exception:
                        await asyncio.sleep(2)
                        response = await self.client.chat.completions.create(
                            model=model, messages=messages
                        )
                    return response.choices[0].message.content
        """)

        files["main.py"] = textwrap.dedent("""\
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
                await db.add_message(req.chat_id, "user", req.message)
                history = await db.get_history(req.chat_id, limit=settings.max_history)
                messages = [{"role": "system", "content": settings.system_prompt}]
                messages.extend(history)
                reply = await inference.chat(messages=messages, model=settings.model)
                await db.add_message(req.chat_id, "assistant", reply)
                return ChatResponse(response=reply)

            @app.get("/health")
            async def health():
                return {"status": "ok", "agent_name": settings.agent_name}
        """)

        return files

    # ── Instance destruction ───────────────────────────────────────────

    async def destroy_instance(self, instance_hash: str) -> dict:
        """Delete an Aleph Cloud instance to stop billing."""
        if not ALEPH_SDK_AVAILABLE:
            return {"status": "error", "error": "aleph-sdk-python not installed"}
        if not self._account:
            return {"status": "error", "error": "No Aleph account configured"}

        try:
            from aleph_message.models import ItemHash

            async with AuthenticatedAlephHttpClient(
                account=self._account, api_server=aleph_settings.API_HOST
            ) as client:
                message, status = await client.forget(
                    hashes=[ItemHash(instance_hash)],
                    reason="Baal agent deletion",
                )
                return {
                    "status": "success",
                    "forget_hash": str(message.item_hash),
                }
        except Exception as e:
            return {"status": "error", "error": str(e)}
