"""Fal.ai adapter — alternative fallback for generative edits.

Fal exposes models at https://fal.run/{model-id} with `Authorization: Key
<FAL_API_KEY>`. The synchronous endpoint returns the result directly; image
inputs accept data URIs. Like the Replicate adapter, model ids are centralized
in `_MODELS` and should be confirmed at https://fal.ai/models — they change as
better models ship.
"""
from __future__ import annotations

import base64
import logging

import httpx

from ..config import get_settings
from .base import (
    GenerativeProvider, GenEdit, GenResult,
    EDIT_SKY, EDIT_DECLUTTER, EDIT_OBJECT_REMOVAL, EDIT_STAGING,
)

log = logging.getLogger("photo-enhancer.fal")

_API = "https://fal.run"

# Canonical edit -> a Fal model id. VERIFY / tune these at https://fal.ai/models
_MODELS = {
    EDIT_SKY:            "fal-ai/flux-pro/kontext",
    EDIT_DECLUTTER:      "fal-ai/flux-pro/kontext",
    EDIT_OBJECT_REMOVAL: "fal-ai/flux-pro/kontext",
    EDIT_STAGING:        "fal-ai/flux-pro/kontext",
}


def _data_uri(image_bytes: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode()


class FalProvider(GenerativeProvider):
    name = "fal"
    capabilities = {EDIT_SKY, EDIT_DECLUTTER, EDIT_OBJECT_REMOVAL, EDIT_STAGING}

    def __init__(self) -> None:
        self._key = get_settings().fal_api_key

    def available(self) -> bool:
        return bool(self._key)

    async def edit(self, job: GenEdit) -> GenResult:
        if not self.available():
            return GenResult(job.filename, None, "FAL_API_KEY not set", self.name)
        model = _MODELS.get(job.edit)
        if not model:
            return GenResult(job.filename, None, f"No model mapped for '{job.edit}'", self.name)

        payload = {
            "prompt": job.prompt,
            "image_url": _data_uri(job.image_bytes),
            "output_format": "jpeg",
        }
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                r = await client.post(
                    f"{_API}/{model}",
                    headers={"Authorization": f"Key {self._key}",
                             "Content-Type": "application/json"},
                    json=payload,
                )
                r.raise_for_status()
                data = r.json()
                images = data.get("images") or []
                out_url = images[0].get("url") if images else data.get("image", {}).get("url")
                if not out_url:
                    return GenResult(job.filename, None, "No output image in Fal response", self.name)
                img = await client.get(out_url)
                img.raise_for_status()
                return GenResult(job.filename, img.content, None, self.name)

        except httpx.HTTPStatusError as e:
            msg = f"Fal HTTP {e.response.status_code}: {e.response.text[:200]}"
            log.error(msg)
            return GenResult(job.filename, None, msg, self.name)
        except Exception as e:
            log.error("Fal edit failed: %s", e)
            return GenResult(job.filename, None, str(e), self.name)
