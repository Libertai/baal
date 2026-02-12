"""VM Pool Manager — maintains warm VMs for instant agent deployment.

Pre-provisions Aleph Cloud VMs so /create can skip the 2-3 minute wait.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import aiosqlite

if TYPE_CHECKING:
    from baal.services.deployer import AlephDeployer

logger = logging.getLogger(__name__)


@dataclass
class PooledVM:
    """A pre-provisioned VM ready for agent deployment."""

    id: int
    instance_hash: str
    vm_ip: str
    vm_url: str  # e.g., https://{subdomain}.2n6.me
    crn_url: str
    ssh_port: int
    created_at: datetime
    claimed_at: datetime | None = None
    agent_id: int | None = None


class VMPool:
    """Manages a pool of warm VMs for instant agent deployment.

    Usage:
        pool = VMPool(db_path, deployer, min_size=5, max_size=10)
        await pool.initialize()
        await pool.start_replenisher()

        # In /create handler:
        vm = await pool.claim()
        if vm:
            # Deploy agent code to vm.vm_ip:vm.ssh_port (~10-15 seconds)
            await pool.mark_deployed(vm.id, agent_id)
        else:
            # Fallback to on-demand provisioning
    """

    def __init__(
        self,
        db_path: str,
        deployer: "AlephDeployer",
        *,
        min_size: int = 5,
        max_size: int = 10,
        replenish_interval: int = 30,
        max_age_hours: int = 24,
    ):
        self.db_path = db_path
        self.deployer = deployer
        self.min_size = min_size
        self.max_size = max_size
        self.replenish_interval = replenish_interval
        self.max_age_hours = max_age_hours
        self._db: aiosqlite.Connection | None = None
        self._replenish_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Initialize database and create tables."""
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row

        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS vm_pool (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_hash TEXT NOT NULL,
                vm_ip TEXT NOT NULL,
                vm_url TEXT NOT NULL,
                crn_url TEXT NOT NULL,
                ssh_port INTEGER NOT NULL DEFAULT 22,
                created_at TEXT NOT NULL,
                claimed_at TEXT,
                agent_id INTEGER,
                status TEXT NOT NULL DEFAULT 'warm'
                -- status: 'provisioning', 'warm', 'claimed', 'deployed', 'failed'
            )
        """)
        # Partial unique index: only enforce uniqueness for non-placeholder hashes
        await self._db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_hash 
            ON vm_pool(instance_hash) WHERE instance_hash != 'pending'
        """)
        await self._db.commit()
        # Recover from unclean shutdown: release any orphaned 'claimed' VMs
        await self._db.execute("""
            UPDATE vm_pool SET status = 'warm', claimed_at = NULL, agent_id = NULL
            WHERE status = 'claimed'
        """)
        # Clean up any stuck 'provisioning' entries from previous run
        await self._db.execute("""
            DELETE FROM vm_pool WHERE status = 'provisioning'
        """)
        await self._db.commit()

        logger.info(f"VM pool initialized (min={self.min_size}, max={self.max_size})")

    async def close(self) -> None:
        """Stop replenisher and close database."""
        if self._replenish_task:
            self._replenish_task.cancel()
            try:
                await self._replenish_task
            except asyncio.CancelledError:
                pass
        if self._db:
            await self._db.close()

    # ── Pool stats ────────────────────────────────────────────────────

    async def get_stats(self) -> dict:
        """Get current pool statistics."""
        async with self._db.execute("""
            SELECT status, COUNT(*) as count FROM vm_pool GROUP BY status
        """) as cursor:
            rows = await cursor.fetchall()

        stats = {row["status"]: row["count"] for row in rows}
        stats["total"] = sum(stats.values())
        stats["available"] = stats.get("warm", 0)
        return stats

    # ── Claim / release ───────────────────────────────────────────────

    async def claim(self) -> PooledVM | None:
        """Claim a warm VM from the pool. Returns None if pool is empty."""
        async with self._lock:
            async with self._db.execute("""
                SELECT * FROM vm_pool
                WHERE status = 'warm'
                ORDER BY created_at ASC
                LIMIT 1
            """) as cursor:
                row = await cursor.fetchone()

            if not row:
                logger.warning("Pool empty — no warm VMs available")
                return None

            now = datetime.now(timezone.utc).isoformat()
            await self._db.execute("""
                UPDATE vm_pool
                SET status = 'claimed', claimed_at = ?
                WHERE id = ?
            """, (now, row["id"]))
            await self._db.commit()

            logger.info(f"Claimed VM {row['instance_hash'][:12]}... from pool")

            return PooledVM(
                id=row["id"],
                instance_hash=row["instance_hash"],
                vm_ip=row["vm_ip"],
                vm_url=row["vm_url"],
                crn_url=row["crn_url"],
                ssh_port=row["ssh_port"],
                created_at=datetime.fromisoformat(row["created_at"]),
                claimed_at=datetime.fromisoformat(now),
            )

    async def mark_deployed(self, pool_id: int, agent_id: int) -> None:
        """Mark a claimed VM as deployed with an agent."""
        await self._db.execute("""
            UPDATE vm_pool
            SET status = 'deployed', agent_id = ?
            WHERE id = ?
        """, (agent_id, pool_id))
        await self._db.commit()
        logger.info(f"Pool VM {pool_id} deployed for agent {agent_id}")

    async def release(self, pool_id: int) -> None:
        """Release a claimed VM back to the pool (if deployment failed)."""
        await self._db.execute("""
            UPDATE vm_pool
            SET status = 'warm', claimed_at = NULL, agent_id = NULL
            WHERE id = ? AND status = 'claimed'
        """, (pool_id,))
        await self._db.commit()
        logger.info(f"Released VM {pool_id} back to pool")

    async def remove(self, pool_id: int, destroy_vm: bool = True) -> None:
        """Remove a VM from the pool and optionally destroy it."""
        async with self._db.execute(
            "SELECT instance_hash FROM vm_pool WHERE id = ?", (pool_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if row and destroy_vm:
            try:
                await self.deployer.destroy_instance(row["instance_hash"])
                logger.info(f"Destroyed VM {row['instance_hash'][:12]}...")
            except Exception as e:
                logger.error(f"Failed to destroy VM {row['instance_hash']}: {e}")

        await self._db.execute("DELETE FROM vm_pool WHERE id = ?", (pool_id,))
        await self._db.commit()

    async def remove_by_instance(self, instance_hash: str) -> None:
        """Remove a pool entry by instance hash (no VM destruction — caller handles that)."""
        await self._db.execute(
            "DELETE FROM vm_pool WHERE instance_hash = ?", (instance_hash,)
        )
        await self._db.commit()

    # ── Replenishment ─────────────────────────────────────────────────

    async def start_replenisher(self) -> None:
        """Start the background replenishment task."""
        self._replenish_task = asyncio.create_task(self._replenish_loop())
        logger.info("Pool replenisher started")

    async def _replenish_loop(self) -> None:
        """Background loop that maintains minimum pool size."""
        while True:
            try:
                await self._replenish_once()
                await self._cleanup_stale()
            except Exception as e:
                logger.error(f"Replenish error: {e}")
            await asyncio.sleep(self.replenish_interval)

    async def _replenish_once(self) -> None:
        """Check pool and provision VMs if needed."""
        stats = await self.get_stats()
        available = stats.get("available", 0)
        provisioning = stats.get("provisioning", 0)
        total = stats.get("total", 0)

        # How many do we need?
        needed = self.min_size - available - provisioning

        # Don't exceed max
        can_create = self.max_size - total
        to_create = min(needed, can_create)

        if to_create <= 0:
            return

        logger.info(
            f"Pool needs {to_create} VMs (available={available}, provisioning={provisioning})"
        )

        # Provision with limited concurrency (2-3 at a time)
        semaphore = asyncio.Semaphore(2)

        async def provision_with_limit():
            async with semaphore:
                await self._provision_one()

        tasks = [provision_with_limit() for _ in range(to_create)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"Provision failed: {r}")

    async def _provision_one(self) -> None:
        """Provision a single VM and add to pool."""
        now = datetime.now(timezone.utc).isoformat()

        # Insert placeholder
        async with self._db.execute("""
            INSERT INTO vm_pool (instance_hash, vm_ip, vm_url, crn_url, ssh_port, created_at, status)
            VALUES ('pending', '', '', '', 22, ?, 'provisioning')
        """, (now,)) as cursor:
            pool_id = cursor.lastrowid
        await self._db.commit()

        try:
            # Create VM via Aleph
            result = await self.deployer.create_instance(f"pool-{pool_id}")

            if result.get("status") != "success":
                raise RuntimeError(result.get("error", "Unknown error"))

            instance_hash = result["instance_hash"]
            crn_url = result["crn_url"]

            # Wait for allocation
            alloc = await self.deployer.wait_for_allocation(instance_hash, crn_url)

            if not alloc:
                raise RuntimeError("Allocation timed out")

            vm_ip = alloc["vm_ipv4"]
            ssh_port = alloc.get("ssh_port", 22)

            # Look up 2n6.me URL
            subdomain = await self.deployer.lookup_subdomain(instance_hash)
            vm_url = f"https://{subdomain}.2n6.me" if subdomain else ""

            if not subdomain:
                raise RuntimeError("Could not resolve 2n6.me subdomain")

            # Pre-install dependencies so deploy_agent_code() is fast
            fqdn = f"{subdomain}.2n6.me"
            prep_result = await self.deployer.prepare_vm(vm_ip, ssh_port, fqdn)
            if prep_result.get("status") != "success":
                raise RuntimeError(
                    f"prepare_vm failed: {prep_result.get('error', 'unknown')}"
                )

            # Update pool entry — only mark 'warm' after deps are installed
            await self._db.execute("""
                UPDATE vm_pool SET
                    instance_hash = ?,
                    vm_ip = ?,
                    vm_url = ?,
                    crn_url = ?,
                    ssh_port = ?,
                    status = 'warm'
                WHERE id = ?
            """, (instance_hash, vm_ip, vm_url, crn_url, ssh_port, pool_id))
            await self._db.commit()

            logger.info(f"Provisioned pool VM: {instance_hash[:12]}... at {vm_ip} (deps installed)")

        except Exception as e:
            logger.error(f"Failed to provision pool VM: {e}")
            await self._db.execute(
                "UPDATE vm_pool SET status = 'failed' WHERE id = ?",
                (pool_id,),
            )
            await self._db.commit()
            raise

    # ── Cleanup ───────────────────────────────────────────────────────

    async def _cleanup_stale(self) -> None:
        """Remove stale VMs (cost control + orphan recovery)."""
        # Clean up warm VMs older than max_age_hours
        async with self._db.execute("""
            SELECT id, instance_hash FROM vm_pool
            WHERE status = 'warm'
            AND datetime(created_at) < datetime('now', ?, 'utc')
        """, (f'-{self.max_age_hours} hours',)) as cursor:
            rows = await cursor.fetchall()

        for row in rows:
            logger.info(f"Cleaning up stale warm VM {row['instance_hash'][:12]}...")
            await self.remove(row["id"], destroy_vm=True)

        # Clean up failed provisions (1 hour)
        await self._db.execute("""
            DELETE FROM vm_pool
            WHERE status = 'failed'
            AND datetime(created_at) < datetime('now', '-1 hour', 'utc')
        """)

        # Clean up orphaned 'provisioning' entries (stuck for >30 min = likely dead)
        await self._db.execute("""
            DELETE FROM vm_pool
            WHERE status = 'provisioning'
            AND datetime(created_at) < datetime('now', '-30 minutes', 'utc')
        """)

        # Clean up orphaned 'claimed' entries (stuck for >10 min = deployment abandoned)
        async with self._db.execute("""
            SELECT id, instance_hash FROM vm_pool
            WHERE status = 'claimed'
            AND datetime(claimed_at) < datetime('now', '-10 minutes', 'utc')
        """) as cursor:
            orphaned = await cursor.fetchall()

        for row in orphaned:
            logger.warning(f"Releasing orphaned claimed VM {row['instance_hash'][:12]}...")
            await self.release(row["id"])

        await self._db.commit()
