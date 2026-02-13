"""Network endpoints — public CRN geo-location data (no auth required).

Used by the landing page map and available for the Expo app.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from baal_core.crn_geo import get_crn_locations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/network", tags=["network"])


class CRNNodeResponse(BaseModel):
    hash: str
    name: str
    url: str
    score: float
    lat: float
    lng: float
    country: str
    city: str
    mem_avail_gb: float
    cpu_count: int
    active: bool


class CRNMapResponse(BaseModel):
    total: int
    nodes: list[CRNNodeResponse]


@router.get("/crns", response_model=CRNMapResponse)
async def get_crn_map():
    """Return geolocated CRN nodes for map visualization.

    Public endpoint — no auth required. Results are cached for 1 hour
    in the crn_geo service.
    """
    locations = await get_crn_locations()
    return CRNMapResponse(
        total=len(locations),
        nodes=[
            CRNNodeResponse(
                hash=loc.hash,
                name=loc.name,
                url=loc.url,
                score=loc.score,
                lat=loc.lat,
                lng=loc.lng,
                country=loc.country,
                city=loc.city,
                mem_avail_gb=loc.mem_avail_gb,
                cpu_count=loc.cpu_count,
                active=loc.active,
            )
            for loc in locations
        ],
    )
