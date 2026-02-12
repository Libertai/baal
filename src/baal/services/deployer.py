"""Aleph Cloud deployer — instance creation, allocation polling, SSH deployment."""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import shlex
import textwrap
import time
from pathlib import Path

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
    "debian12": "5330dcefe1857bcd97b7b7f24d1420a7d46232d53f27be280c8a7071d88bd84e",
}

GATEWAY_API_URL = "https://api.2n6.me"

# How long a failed CRN stays blacklisted (seconds)
CRN_BLACKLIST_TTL = 600  # 10 minutes


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
        # CRN blacklist: maps CRN URL -> expiry timestamp (monotonic)
        self._crn_blacklist: dict[str, float] = {}

        if ALEPH_SDK_AVAILABLE:
            pk = private_key.removeprefix("0x")
            try:
                self._account = ETHAccount(private_key=bytes.fromhex(pk))
            except Exception as e:
                logger.error(f"Failed to load Aleph account: {e}")

    # ── CRN blacklist ─────────────────────────────────────────────────

    def _blacklist_crn(self, crn_url: str, reason: str) -> None:
        """Add a CRN to the temporary blacklist."""
        expiry = time.monotonic() + CRN_BLACKLIST_TTL
        self._crn_blacklist[crn_url] = expiry
        logger.info(
            f"Blacklisted CRN {crn_url} for {CRN_BLACKLIST_TTL}s: {reason}"
        )

    def _prune_blacklist(self) -> None:
        """Remove expired entries from the blacklist."""
        now = time.monotonic()
        expired = [url for url, exp in self._crn_blacklist.items() if now >= exp]
        for url in expired:
            del self._crn_blacklist[url]

    def _is_blacklisted(self, crn_url: str) -> bool:
        """Check if a CRN is currently blacklisted."""
        expiry = self._crn_blacklist.get(crn_url)
        if expiry is None:
            return False
        if time.monotonic() >= expiry:
            del self._crn_blacklist[crn_url]
            return False
        return True

    # ── CRN discovery ──────────────────────────────────────────────────

    async def get_available_crns(self) -> list[dict]:
        """Fetch CRNs from crns-list.aleph.sh, filtered and sorted by load."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get("https://crns-list.aleph.sh/crns.json")
                if resp.status_code != 200:
                    logger.warning(f"CRN list returned {resp.status_code}")
                    return []

                data = resp.json()
                nodes = data.get("crns", []) if isinstance(data, dict) else []
                crns = []
                for node in nodes:
                    # Require both IPv6 checks passing
                    ipv6 = node.get("ipv6_check", {})
                    if not (ipv6.get("host") is True and ipv6.get("vm") is True):
                        continue
                    # Must support qemu and have a payment address
                    if not node.get("qemu_support"):
                        continue
                    if not node.get("payment_receiver_address"):
                        continue
                    # Must have live system usage data
                    usage = node.get("system_usage")
                    if not usage or not usage.get("active"):
                        continue

                    # Compute a load score (lower = less loaded = better)
                    cpu = usage.get("cpu", {})
                    mem = usage.get("mem", {})
                    cpu_count = cpu.get("count", 1)
                    load5 = cpu.get("load_average", {}).get("load5", 0)
                    cpu_usage_pct = load5 / max(cpu_count, 1)
                    mem_total = mem.get("total_kB", 1)
                    mem_avail = mem.get("available_kB", 0)
                    mem_usage_pct = 1.0 - (mem_avail / max(mem_total, 1))
                    # Weighted: 60% CPU, 40% memory
                    load_score = 0.6 * cpu_usage_pct + 0.4 * mem_usage_pct

                    crns.append(
                        {
                            "hash": node.get("hash"),
                            "name": node.get("name"),
                            "url": node.get("address", "").rstrip("/"),
                            "payment_address": node["payment_receiver_address"],
                            "score": node.get("score", 0),
                            "load_score": load_score,
                        }
                    )

                # Filter out blacklisted CRNs
                self._prune_blacklist()
                before_count = len(crns)
                crns = [
                    c for c in crns
                    if not self._is_blacklisted(c["url"])
                ]
                blacklisted_count = before_count - len(crns)
                if blacklisted_count > 0:
                    logger.info(
                        f"Filtered out {blacklisted_count} blacklisted CRN(s)"
                    )

                # Sort by load (least loaded first), break ties by node score
                crns.sort(key=lambda c: (c["load_score"], -c["score"]))
                logger.info(f"Found {len(crns)} eligible CRNs (after blacklist)")
                return crns
        except Exception as e:
            logger.warning(f"Failed to fetch CRNs: {e}")
        return []

    # ── Instance creation ──────────────────────────────────────────────

    async def create_instance(self, agent_name: str) -> dict:
        """Create an Aleph Cloud VM instance using credits payment.

        Tries multiple CRNs with blacklisting of recently-failed nodes.
        Returns dict with 'status', 'instance_hash', 'crn_url', etc.
        """
        if not ALEPH_SDK_AVAILABLE:
            return {"status": "error", "error": "aleph-sdk-python not installed"}
        if not self._account:
            return {"status": "error", "error": "No Aleph account configured"}

        # Auto-select CRN with retry logic
        crns = await self.get_available_crns()
        if not crns:
            return {"status": "error", "error": "No CRNs available"}

        # Try up to 5 CRNs if the first ones fail (many nodes are unreliable)
        max_crn_attempts = min(5, len(crns))
        last_error = None
        instance_hash = None

        for crn_attempt in range(max_crn_attempts):
            selected = crns[crn_attempt]
            crn_url = selected["url"]
            if not crn_url.startswith("http"):
                crn_url = f"https://{crn_url}"
            crn_url = crn_url.rstrip("/")

            payment_receiver = selected["payment_address"]
            logger.info(
                f"Attempt {crn_attempt + 1}/{max_crn_attempts}: "
                f"Selected CRN {selected['name']} (load={selected['load_score']:.2f}) "
                f"at {crn_url}"
            )

            payment = Payment(
                chain=Chain.ETH,
                type=PaymentType.credit,
                receiver=payment_receiver,
            )

            try:
                # Only create a new instance if we don't already have one
                # (instance survives across CRN retries — we just need a CRN to start it)
                if instance_hash is None:
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
                        logger.info(f"Instance created: {instance_hash}, status: {status}")

                        # Wait and verify message exists on network before notifying
                        max_verify_attempts = 6
                        message_found = False
                        for attempt in range(max_verify_attempts):
                            await asyncio.sleep(5)
                            try:
                                async with httpx.AsyncClient(timeout=10.0) as verify_client:
                                    resp = await verify_client.get(
                                        f"https://api2.aleph.im/api/v0/messages.json?hashes={instance_hash}"
                                    )
                                    if resp.status_code == 200:
                                        data = resp.json()
                                        if data.get("messages") and len(data["messages"]) > 0:
                                            message_found = True
                                            logger.info(f"Message verified on network after {(attempt+1)*5}s")
                                            break
                            except Exception:
                                pass

                        if not message_found:
                            logger.warning(f"Message not found on network after {max_verify_attempts*5}s")

                        # Additional wait for CRN propagation
                        await asyncio.sleep(5)

                # Notify CRN to start (with timeout)
                try:
                    async with VmClient(self._account, crn_url) as vm_client:
                        start_status, start_result = await asyncio.wait_for(
                            vm_client.start_instance(instance_hash),
                            timeout=30.0  # 30s — many CRNs need more than 15s
                        )
                        if start_status != 200:
                            error_msg = f"CRN {selected['name']} returned status {start_status}: {start_result}"
                            logger.warning(error_msg)
                            last_error = error_msg
                            self._blacklist_crn(crn_url, error_msg)
                            continue

                    # Success!
                    logger.info(f"Successfully started instance on CRN {selected['name']}")
                    return {
                        "status": "success",
                        "instance_hash": instance_hash,
                        "crn_url": crn_url,
                    }

                except asyncio.TimeoutError:
                    error_msg = f"CRN {selected['name']} timed out during start notification (30s)"
                    logger.warning(error_msg)
                    last_error = error_msg
                    self._blacklist_crn(crn_url, "timeout during start_instance")
                    continue

            except Exception as e:
                error_msg = f"CRN {selected['name']} failed: {str(e)}"
                logger.warning(error_msg)
                last_error = error_msg
                self._blacklist_crn(crn_url, str(e))
                continue

        # All CRNs failed — if we created an instance but couldn't start it,
        # still return the hash so /repair can retry later
        if instance_hash:
            logger.warning(
                f"All {max_crn_attempts} CRN start attempts failed, but instance "
                f"{instance_hash} exists. User can /repair."
            )
            return {
                "status": "error",
                "error": f"All {max_crn_attempts} CRN attempts failed. Last: {last_error}",
                "instance_hash": instance_hash,
            }

        return {
            "status": "error",
            "error": f"All {max_crn_attempts} CRN attempts failed. Last: {last_error}",
        }

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

            # Re-notify CRN every 4th attempt (in case first notify was too early)
            if attempt > 0 and attempt % 4 == 0:
                logger.info(f"Re-sending CRN start notification (attempt {attempt + 1})")
                try:
                    async with VmClient(self._account, crn_url) as vm_client:
                        await asyncio.wait_for(
                            vm_client.start_instance(instance_hash),
                            timeout=30.0,
                        )
                except asyncio.TimeoutError:
                    logger.warning(f"Re-notify timed out (30s) for {instance_hash}")
                except Exception as e:
                    logger.debug(f"Re-notify failed: {e}")

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
        owner_chat_id: str = "",
    ) -> dict:
        """SSH into a VM and deploy the agent code + Caddy reverse proxy.

        Returns dict with 'status' and 'vm_url'.
        """
        steps: list[dict] = []

        # Wait for SSH to be ready (VMs can take 3-5 min to fully boot)
        logger.info(f"Waiting for SSH to be ready at {vm_ip}:{ssh_port}...")
        for attempt in range(30):  # 30 attempts × 10s = 5 minutes max
            code, out, err = await self._ssh_run(vm_ip, ssh_port, "echo ready", timeout=15)
            if code == 0 and "ready" in out:
                logger.info(f"SSH ready after {(attempt+1)*10}s")
                break
            # Log progress every 5 attempts (~50 seconds)
            if attempt > 0 and attempt % 5 == 0:
                logger.info(f"Still waiting for SSH... ({attempt+1}/30 attempts, {(attempt+1)*10}s elapsed)")
            if attempt < 29:  # Don't sleep on last attempt
                await asyncio.sleep(10)
        else:
            return {"status": "error", "error": f"SSH not reachable after 5 minutes (tried {vm_ip}:{ssh_port})", "steps": steps}

        steps.append({"step": "ssh_connected", "success": True})

        # Install Python + deps (skip if venv already exists from prepare_vm)
        code, _, _ = await self._ssh_run(vm_ip, ssh_port, "test -x /opt/baal-agent/bin/python3", timeout=10)
        if code == 0:
            logger.info("Deps already installed, skipping")
            steps.append({"step": "install_deps", "success": True, "skipped": True})
        else:
            install_cmd = (
                "apt-get update -qq && "
                "apt-get install -y -qq python3 python3-pip python3-venv && "
                "python3 -m venv /opt/baal-agent && "
                "/opt/baal-agent/bin/pip install fastapi uvicorn openai aiosqlite pydantic-settings httpx"
            )
            code, _, stderr = await self._ssh_run(vm_ip, ssh_port, install_cmd, timeout=300)
            steps.append({"step": "install_deps", "success": code == 0})
            if code != 0:
                return {"status": "error", "error": f"Dep install failed: {stderr}", "steps": steps}

        # Deploy agent code via tar pipe over SSH
        agent_dir = "/opt/baal-agent/app"
        await self._ssh_run(vm_ip, ssh_port, f"mkdir -p {agent_dir}")

        agent_src = self._get_agent_source_dir()
        code, _, stderr = await self._ssh_pipe_tar(
            vm_ip, ssh_port, agent_src.parent, "baal_agent", agent_dir
        )
        if code != 0:
            return {
                "status": "error",
                "error": f"Failed to deploy agent code: {stderr}",
                "steps": steps,
            }

        # Copy workspace template (no-clobber so re-deploys don't overwrite)
        await self._ssh_run(
            vm_ip, ssh_port,
            f"cp -rn {agent_dir}/baal_agent/workspace /opt/baal-agent/workspace 2>/dev/null; "
            f"mkdir -p /opt/baal-agent/workspace/memory /opt/baal-agent/workspace/skills",
        )

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
            f"WORKSPACE_PATH=/opt/baal-agent/workspace\n"
            f"OWNER_CHAT_ID={owner_chat_id}\n"
            f"HEARTBEAT_INTERVAL=1800\n"
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

    async def prepare_vm(
        self, vm_ip: str, ssh_port: int
    ) -> dict:
        """Pre-install all dependencies on a blank VM (Python, Caddy, dirs).

        Called during pool provisioning so deploy_agent() skips the slow
        dep install steps (~15-20s instead of ~2 min).
        """
        # Wait for SSH to be ready (VMs can take 3-5 min to fully boot)
        logger.info(f"prepare_vm: waiting for SSH at {vm_ip}:{ssh_port}...")
        for attempt in range(30):  # 30 × 10s = 5 min max
            code, out, _ = await self._ssh_run(vm_ip, ssh_port, "echo ready", timeout=15)
            if code == 0 and "ready" in out:
                logger.info(f"prepare_vm: SSH ready after {(attempt+1)*10}s")
                break
            if attempt < 29:
                await asyncio.sleep(10)
        else:
            return {"status": "error", "error": f"SSH not reachable at {vm_ip}:{ssh_port} after 5 min"}

        # Install Python + create venv + install deps
        install_cmd = (
            "apt-get update -qq && "
            "apt-get install -y -qq python3 python3-pip python3-venv && "
            "python3 -m venv /opt/baal-agent && "
            "/opt/baal-agent/bin/pip install fastapi uvicorn openai aiosqlite pydantic-settings httpx"
        )
        code, _, stderr = await self._ssh_run(vm_ip, ssh_port, install_cmd, timeout=600)
        if code != 0:
            return {"status": "error", "error": f"Dep install failed: {stderr}"}

        # Install Caddy
        caddy_install = (
            "apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl && "
            "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && "
            "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && "
            "apt-get update -qq && apt-get install -y -qq caddy"
        )
        code, _, stderr = await self._ssh_run(vm_ip, ssh_port, caddy_install, timeout=120)
        if code != 0:
            return {"status": "error", "error": f"Caddy install failed: {stderr}"}

        # Don't start Caddy with the real domain yet — deploy_agent() will
        # write the Caddyfile and start Caddy when the agent is deployed.
        await self._ssh_run(vm_ip, ssh_port, "systemctl stop caddy 2>/dev/null")

        # Create agent dirs
        await self._ssh_run(
            vm_ip, ssh_port,
            "mkdir -p /opt/baal-agent/app /opt/baal-agent/workspace/memory /opt/baal-agent/workspace/skills",
        )

        logger.info(f"prepare_vm: {vm_ip} ready (Python + Caddy installed)")
        return {"status": "success"}

    async def deploy_agent_code(
        self,
        vm_ip: str,
        ssh_port: int,
        fqdn: str,
        agent_name: str,
        system_prompt: str,
        model: str,
        libertai_api_key: str,
        agent_secret: str,
        owner_chat_id: str = "",
    ) -> dict:
        """Deploy only agent code to a VM already prepared by prepare_vm().

        Much faster than deploy_agent() (~15s vs ~2 min) because deps are
        already installed. Used for the fast pool path.
        """
        steps: list[dict] = []

        # Quick SSH check (3 retries × 5s)
        for attempt in range(3):
            code, out, _ = await self._ssh_run(vm_ip, ssh_port, "echo ready", timeout=10)
            if code == 0 and "ready" in out:
                break
            if attempt < 2:
                await asyncio.sleep(5)
        else:
            return {"status": "error", "error": f"SSH not reachable at {vm_ip}:{ssh_port}", "steps": steps}

        steps.append({"step": "ssh_connected", "success": True})

        # Deploy agent code via tar pipe
        agent_dir = "/opt/baal-agent/app"
        agent_src = self._get_agent_source_dir()
        code, _, stderr = await self._ssh_pipe_tar(
            vm_ip, ssh_port, agent_src.parent, "baal_agent", agent_dir
        )
        if code != 0:
            return {"status": "error", "error": f"Failed to deploy agent code: {stderr}", "steps": steps}

        # Copy workspace template (no-clobber so re-deploys don't overwrite)
        await self._ssh_run(
            vm_ip, ssh_port,
            f"cp -rn {agent_dir}/baal_agent/workspace /opt/baal-agent/workspace 2>/dev/null; "
            f"mkdir -p /opt/baal-agent/workspace/memory /opt/baal-agent/workspace/skills",
        )
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
            f"WORKSPACE_PATH=/opt/baal-agent/workspace\n"
            f"OWNER_CHAT_ID={owner_chat_id}\n"
            f"HEARTBEAT_INTERVAL=1800\n"
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

        # Start/restart agent service
        code, _, stderr = await self._ssh_run(
            vm_ip, ssh_port,
            "systemctl daemon-reload && systemctl enable baal-agent && systemctl restart baal-agent",
        )
        steps.append({"step": "start_agent", "success": code == 0})
        if code != 0:
            return {"status": "error", "error": f"Service start failed: {stderr}", "steps": steps}

        # Write Caddyfile and start Caddy (installed by prepare_vm, but not configured)
        caddyfile = f"{fqdn} {{\n    reverse_proxy localhost:8080\n}}\n"
        cmd = _safe_write_file_command(caddyfile, "/etc/caddy/Caddyfile")
        await self._ssh_run(vm_ip, ssh_port, cmd)
        code, _, stderr = await self._ssh_run(
            vm_ip, ssh_port,
            "systemctl stop caddy 2>/dev/null; systemctl enable caddy && systemctl start caddy",
        )
        steps.append({"step": "caddy_start", "success": code == 0})
        if code != 0:
            return {"status": "error", "error": f"Caddy start failed: {stderr}", "steps": steps}

        vm_url = f"https://{fqdn}"
        return {"status": "success", "vm_url": vm_url, "steps": steps}

    def _get_agent_source_dir(self) -> Path:
        """Get path to the baal_agent source package."""
        return Path(__file__).resolve().parent.parent.parent / "baal_agent"

    async def _ssh_pipe_tar(
        self,
        host: str,
        port: int,
        source_parent: Path,
        dir_name: str,
        remote_dest: str,
        timeout: int = 120,
    ) -> tuple[int, str, str]:
        """Pipe a tar archive over SSH to deploy code to a remote host."""
        ssh_opts = [
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=10",
            "-p", str(port),
        ]
        if os.path.exists(self.ssh_privkey_path):
            ssh_opts.extend(["-i", self.ssh_privkey_path])

        # Build: tar czf - -C <parent> <dir> | ssh <opts> root@host 'tar xzf - -C <dest>'
        tar_cmd = ["tar", "czf", "-", "-C", str(source_parent), dir_name]
        ssh_cmd = ["ssh"] + ssh_opts + [
            f"root@{host}",
            f"tar xzf - -C {shlex.quote(remote_dest)}",
        ]

        try:
            tar_proc = await asyncio.create_subprocess_exec(
                *tar_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            ssh_proc = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Pipe tar output to SSH input
            async def pipe_data():
                try:
                    if tar_proc.stdout and ssh_proc.stdin:
                        while True:
                            chunk = await tar_proc.stdout.read(8192)
                            if not chunk:
                                break
                            ssh_proc.stdin.write(chunk)
                            await ssh_proc.stdin.drain()
                except Exception as e:
                    logger.warning(f"Error during tar pipe: {e}")
                finally:
                    if ssh_proc.stdin:
                        ssh_proc.stdin.close()
                        try:
                            await ssh_proc.stdin.wait_closed()
                        except:
                            pass

            # Run piping with timeout
            await asyncio.wait_for(pipe_data(), timeout=timeout)

            # Now wait for SSH process to complete
            await ssh_proc.wait()
            await tar_proc.wait()

            # Get output
            ssh_stdout = await ssh_proc.stdout.read() if ssh_proc.stdout else b""
            ssh_stderr = await ssh_proc.stderr.read() if ssh_proc.stderr else b""

            return (
                ssh_proc.returncode or 0,
                ssh_stdout.decode("utf-8", errors="replace"),
                ssh_stderr.decode("utf-8", errors="replace"),
            )
        except asyncio.TimeoutError:
            return (124, "", f"Tar pipe timed out after {timeout}s")
        except Exception as e:
            return (1, "", str(e))

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
