"""CRN geo-location service.

Fetches the Aleph Cloud CRN list, resolves hostnames to IPs,
and geolocates them via ip-api.com's batch endpoint.
Results are cached in memory with a 1-hour TTL.

Used by:
- LiberClaw API: /api/v1/network/crns endpoint (landing page map)
- Deployer: geo-aware CRN selection during deployment
"""

from __future__ import annotations

import asyncio
import logging
import socket
import time
from dataclasses import dataclass, asdict
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

CRN_LIST_URL = "https://crns-list.aleph.sh/crns.json"
GEOIP_BATCH_URL = "http://ip-api.com/batch"
CACHE_TTL = 3600  # 1 hour


@dataclass
class CRNLocation:
    """A CRN node with geographic coordinates."""

    hash: str
    name: str
    url: str
    score: float
    lat: float
    lng: float
    country: str
    city: str
    ip: str
    mem_avail_gb: float
    cpu_count: int
    active: bool

    def to_dict(self) -> dict:
        return asdict(self)


# ── Cache ────────────────────────────────────────────────────────────

_cache: list[CRNLocation] = []
_cache_time: float = 0


# ── DNS resolution ───────────────────────────────────────────────────


async def _resolve_hostname(hostname: str) -> str | None:
    """Resolve a hostname to an IP address (IPv4 preferred, fallback IPv6)."""
    loop = asyncio.get_event_loop()
    for family in (socket.AF_INET, socket.AF_INET6):
        try:
            results = await loop.getaddrinfo(hostname, None, family=family)
            if results:
                return results[0][4][0]
        except (socket.gaierror, OSError):
            continue
    return None


async def _resolve_batch(hostnames: dict[str, str]) -> dict[str, str]:
    """Resolve a dict of {crn_hash: hostname} to {crn_hash: ip} concurrently."""
    sem = asyncio.Semaphore(50)

    async def _resolve(crn_hash: str, hostname: str) -> tuple[str, str | None]:
        async with sem:
            ip = await _resolve_hostname(hostname)
            return crn_hash, ip

    tasks = [_resolve(h, name) for h, name in hostnames.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    ip_map: dict[str, str] = {}
    for result in results:
        if isinstance(result, tuple) and result[1]:
            ip_map[result[0]] = result[1]
    return ip_map


# ── GeoIP ────────────────────────────────────────────────────────────


async def _geolocate_ips(
    ips: list[str], client: httpx.AsyncClient
) -> dict[str, dict]:
    """Batch geolocate IPs via ip-api.com. Returns {ip: {lat, lon, country, city}}."""
    geo_map: dict[str, dict] = {}

    # ip-api.com batch supports up to 100 IPs per request
    for i in range(0, len(ips), 100):
        batch = ips[i : i + 100]
        try:
            resp = await client.post(
                GEOIP_BATCH_URL,
                json=[
                    {"query": ip, "fields": "lat,lon,country,city,query,status"}
                    for ip in batch
                ],
                timeout=15,
            )
            for entry in resp.json():
                if entry.get("status") == "success":
                    geo_map[entry["query"]] = entry
        except Exception as exc:
            logger.warning("GeoIP batch request failed: %s", exc)

        # Rate limit: 15 batch requests per minute
        if i + 100 < len(ips):
            await asyncio.sleep(4)

    return geo_map


# ── Public API ───────────────────────────────────────────────────────


async def get_crn_locations(force_refresh: bool = False) -> list[CRNLocation]:
    """Fetch, resolve, and geolocate all active Aleph Cloud CRNs.

    Returns a list of CRNLocation with real lat/lng coordinates.
    Results are cached for 1 hour.
    """
    global _cache, _cache_time

    if not force_refresh and _cache and (time.time() - _cache_time) < CACHE_TTL:
        return _cache

    logger.info("Refreshing CRN geo-location data...")

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Fetch CRN list
        resp = await client.get(CRN_LIST_URL)
        resp.raise_for_status()
        data = resp.json()
        crns = data.get("crns", []) if isinstance(data, dict) else data

        # 2. Filter active CRNs (same criteria as deployer)
        active_crns = [
            c
            for c in crns
            if c.get("qemu_support")
            and (c.get("system_usage") or {}).get("active")
            and c.get("score", 0) >= 0.3
        ]
        logger.info("Found %d active CRNs out of %d total", len(active_crns), len(crns))

        # 3. Extract hostnames
        hostnames: dict[str, str] = {}
        for crn in active_crns:
            hostname = urlparse(crn.get("address", "")).hostname
            if hostname:
                hostnames[crn["hash"]] = hostname

        # 4. Resolve hostnames → IPs
        ip_map = await _resolve_batch(hostnames)
        logger.info("Resolved %d / %d hostnames to IPs", len(ip_map), len(hostnames))

        # 5. Batch geolocate unique IPs
        unique_ips = list(set(ip_map.values()))
        geo_map = await _geolocate_ips(unique_ips, client)
        logger.info("Geolocated %d / %d unique IPs", len(geo_map), len(unique_ips))

        # 6. Build results
        locations: list[CRNLocation] = []
        for crn in active_crns:
            ip = ip_map.get(crn["hash"])
            if not ip:
                continue
            geo = geo_map.get(ip)
            if not geo:
                continue

            usage = crn.get("system_usage", {})
            locations.append(
                CRNLocation(
                    hash=crn["hash"],
                    name=crn.get("name", "Unknown"),
                    url=crn.get("address", ""),
                    score=crn.get("score", 0),
                    lat=geo["lat"],
                    lng=geo["lon"],
                    country=geo.get("country", ""),
                    city=geo.get("city", ""),
                    ip=ip,
                    mem_avail_gb=round(
                        usage.get("mem", {}).get("available_kB", 0) / 1_048_576, 1
                    ),
                    cpu_count=usage.get("cpu", {}).get("count", 0),
                    active=usage.get("active", False),
                )
            )

        logger.info("Built %d CRN locations with coordinates", len(locations))
        _cache = locations
        _cache_time = time.time()
        return locations
