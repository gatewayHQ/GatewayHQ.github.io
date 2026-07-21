"""Thin async wrapper around Claude for photo analysis and prompt authoring.

Degrades gracefully: if no CLAUDE_API_KEY is set, analysis returns a safe
default (auto room type, no generative suggestions) so the local pipeline
still runs. Generative prompt authoring falls back to a solid static template.
"""
from __future__ import annotations

import base64
import json
import logging

import httpx

from .config import get_settings
from . import prompts

log = logging.getLogger("photo-enhancer.claude")

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VER = "2023-06-01"


def _safe_analysis() -> dict:
    return {
        "room_type": "interior", "space": "", "is_empty": False,
        "has_windows_blown": True, "white_balance_cast": "none",
        "sky_visible": False, "sky_quality": "n/a", "clutter": [],
        "vertical_lines_skewed": True, "notes": "fallback: no analysis available",
    }


async def _call(system: str, content: list | str, max_tokens: int = 700) -> str | None:
    s = get_settings()
    if not s.claude_api_key:
        return None
    payload = {
        "model": s.claude_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": content}],
    }
    headers = {
        "x-api-key": s.claude_api_key,
        "anthropic-version": _ANTHROPIC_VER,
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(_ANTHROPIC_URL, json=payload, headers=headers)
        if r.status_code != 200:
            log.warning("Claude HTTP %s: %s", r.status_code, r.text[:200])
            return None
        data = r.json()
        return (data.get("content") or [{}])[0].get("text", "").strip()
    except Exception as e:  # network / timeout — never fatal
        log.warning("Claude call failed: %s", e)
        return None


async def analyze_photo(jpeg_bytes: bytes) -> dict:
    """Return the structured analysis dict for one photo."""
    b64 = base64.b64encode(jpeg_bytes).decode()
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
        {"type": "text", "text": prompts.analyst_user_prompt()},
    ]
    text = await _call(prompts.ANALYST_SYSTEM, content, max_tokens=500)
    if not text:
        return _safe_analysis()
    try:
        # Tolerate an accidental ```json fence.
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse analysis JSON: %s", text[:200])
        return _safe_analysis()


async def author_prompt(analysis: dict, edit: str, edit_detail: str,
                        house_style_desc: str) -> str:
    """Return a model-ready instruction for a generative edit."""
    text = await _call(
        prompts.PROMPT_ARCHITECT_SYSTEM,
        prompts.architect_user_prompt(analysis, edit, edit_detail, house_style_desc),
        max_tokens=400,
    )
    if text:
        return text
    return _fallback_prompt(edit, edit_detail)


def _fallback_prompt(edit: str, edit_detail: str) -> str:
    templates = {
        "sky_replacement": (
            f"Replace only the sky with a photorealistic {edit_detail or 'clear blue'} "
            "sky. Keep the building exposure, reflections, and light direction "
            "unchanged; blend naturally at the horizon. Do not alter the structure "
            "or landscaping."
        ),
        "declutter": (
            f"Remove the following clutter photorealistically: {edit_detail}. "
            "Reconstruct the surfaces behind them with correct texture, color, and "
            "shadows. Do not alter fixed features or conceal any defects."
        ),
        "object_removal": (
            f"Remove photorealistically: {edit_detail}. Reconstruct the background "
            "cleanly. Preserve all fixed property features and true proportions."
        ),
        "virtual_staging": (
            f"Furnish this empty room in a {edit_detail or 'modern'} style with "
            "correctly scaled furniture and consistent shadows. Keep flooring, "
            "walls, windows, and architecture unchanged."
        ),
    }
    return templates.get(edit, f"Apply {edit} photorealistically. {edit_detail}")
