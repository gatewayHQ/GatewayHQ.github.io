"""Pydantic request/response models shared across the API."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RoomType(str, Enum):
    interior = "interior"
    exterior = "exterior"
    aerial = "aerial"
    twilight = "twilight"
    detail = "detail"
    auto = "auto"


class SkyStyle(str, Enum):
    none = "none"
    blue = "blue"
    golden_hour = "golden_hour"
    dramatic = "dramatic"


class EnhanceOptions(BaseModel):
    """What the agent wants done. Non-generative steps are on by default and
    are always MLS-safe; generative steps are opt-in and get disclosed."""

    # ── Non-generative (deterministic, MLS-safe) ──────────────────────
    perspective_correction: bool = True
    white_balance: bool = True
    exposure_balance: bool = True
    window_pull: bool = True          # local highlight recovery on windows
    clarity_sharpen: bool = True

    # ── Generative (opt-in, disclosed) ───────────────────────────────
    sky_replacement: SkyStyle = SkyStyle.none
    declutter: bool = False           # remove clutter / personal items
    object_removal: list[str] = Field(default_factory=list)  # named targets
    virtual_staging: bool = False     # furnish empty rooms
    staging_style: str = "modern"     # modern | transitional | farmhouse | luxury

    # ── Global ────────────────────────────────────────────────────────
    room_type: RoomType = RoomType.auto
    house_style: str = "gateway_default"   # keys house_style.STYLES
    long_edge: Optional[int] = None        # overrides settings.mls_long_edge


class PhotoResult(BaseModel):
    filename: str
    status: str                         # queued | analyzing | editing | done | error
    room_type: Optional[str] = None
    generative_steps: list[str] = Field(default_factory=list)
    output_url: Optional[str] = None
    sidecar_url: Optional[str] = None   # MLS disclosure JSON
    disclosure_required: bool = False
    disclosure_text: Optional[str] = None
    error: Optional[str] = None


class JobStatus(BaseModel):
    job_id: str
    state: str                          # queued | running | done | error
    created_at: str
    total: int
    completed: int
    failed: int
    house_style: str
    photos: list[PhotoResult] = Field(default_factory=list)
    error: Optional[str] = None
