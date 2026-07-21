"""House style — a named, reproducible look applied across a whole gallery.

Two layers of consistency:

1. **Local look** (always active): a deterministic grade — white-balance
   target, tone curve, saturation/vibrance, clarity — expressed as numbers so
   every photo in a listing is treated identically. This is what makes a
   gallery feel like one shoot instead of 20 separate edits.

2. **Learned AI Profile** (optional, Imagen): Imagen "AI Profiles" learn your
   editing style from a batch of before/after edits and reproduce it. The
   profile key lives in settings (IMAGEN_PROFILE_KEY). See README → "Learning
   your office house style".

Add or tune styles here; the key is what the frontend sends as
`house_style`. Keeping them in one file means the whole office shares one
look and it is trivially auditable.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LocalLook:
    # White balance target in Kelvin-ish bias. Positive = warmer.
    warmth: float = 0.0
    tint: float = 0.0
    # Tone: lift shadows / recover highlights (0..1 strength).
    shadow_lift: float = 0.18
    highlight_recovery: float = 0.35
    # Global exposure nudge in stops (applied after auto-balance).
    exposure_bias: float = 0.0
    # Color.
    vibrance: float = 0.12
    saturation: float = 0.04
    # Detail.
    clarity: float = 0.18
    sharpen_amount: float = 0.6
    # Vertical-line straightening aggressiveness (0..1).
    perspective_strength: float = 0.85
    # Imagen AI Profile key to use for this look, if any (overrides settings).
    imagen_profile_key: str = ""


@dataclass(frozen=True)
class HouseStyle:
    key: str
    label: str
    description: str
    look: LocalLook = field(default_factory=LocalLook)


STYLES: dict[str, HouseStyle] = {
    "gateway_default": HouseStyle(
        key="gateway_default",
        label="Gateway — Clean & Bright",
        description=(
            "Neutral walls, bright and airy, true-to-life color. The default "
            "MLS look: crisp, natural, no heavy stylization."
        ),
        look=LocalLook(
            warmth=0.03, shadow_lift=0.20, highlight_recovery=0.40,
            vibrance=0.12, saturation=0.03, clarity=0.16, sharpen_amount=0.55,
            perspective_strength=0.85,
        ),
    ),
    "warm_luxury": HouseStyle(
        key="warm_luxury",
        label="Warm Luxury",
        description="Richer, warmer, higher-contrast look for premium listings.",
        look=LocalLook(
            warmth=0.10, shadow_lift=0.12, highlight_recovery=0.30,
            vibrance=0.16, saturation=0.08, clarity=0.24, sharpen_amount=0.7,
            perspective_strength=0.9,
        ),
    ),
    "natural_flat": HouseStyle(
        key="natural_flat",
        label="Natural / Low-Process",
        description=(
            "Minimal processing for agents who want the least generative / "
            "most defensible-to-MLS look. Gentle balance only."
        ),
        look=LocalLook(
            warmth=0.0, shadow_lift=0.10, highlight_recovery=0.25,
            vibrance=0.06, saturation=0.0, clarity=0.08, sharpen_amount=0.4,
            perspective_strength=0.7,
        ),
    ),
}


def get_style(key: str) -> HouseStyle:
    return STYLES.get(key, STYLES["gateway_default"])


def list_styles() -> list[dict]:
    return [
        {"key": s.key, "label": s.label, "description": s.description}
        for s in STYLES.values()
    ]
