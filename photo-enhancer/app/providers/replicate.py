"""Replicate adapter — fallback for generative edits Imagen doesn't do
(object removal, virtual staging) and an alternative for sky replacement.

Replicate runs open models behind one API: create a prediction, poll it, then
download the output image. We call the model-by-name endpoint
(POST /v1/models/{owner}/{name}/predictions) which always uses the model's
latest version, so there are no version hashes to rot.

── Model selection note ───────────────────────────────────────────────────
Model slugs change as better ones ship; the defaults in `_MODELS` are sensible
starting points, not guarantees. Confirm current real-estate / inpainting
models at https://replicate.com/collections and edit `_MODELS`. Each model's
input schema differs slightly — `_build_input()` maps our canonical fields to
the common ones (image, prompt, mask); adjust per the model's API tab.
"""
from __future__ import annotations

import asyncio
import base64
import logging

import httpx

from ..config import get_settings
from .base import (
    GenerativeProvider, GenEdit, GenResult,
    EDIT_SKY, EDIT_DECLUTTER, EDIT_OBJECT_REMOVAL, EDIT_STAGING,
)

log = logging.getLogger("photo-enhancer.replicate")

_API = "https://api.replicate.com/v1"
_POLL_INTERVAL_S = 2
_POLL_TIMEOUT_S = 300

# Canonical edit -> a Replicate model (owner/name). VERIFY / tune these.
_MODELS = {
    EDIT_SKY:            "black-forest-labs/flux-kontext-pro",
    EDIT_DECLUTTER:      "black-forest-labs/flux-kontext-pro",
    EDIT_OBJECT_REMOVAL: "black-forest-labs/flux-kontext-pro",
    EDIT_STAGING:        "black-forest-labs/flux-kontext-pro",
}


def _data_uri(image_bytes: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode()


class ReplicateProvider(GenerativeProvider):
    name = "replicate"
    capabilities = {EDIT_SKY, EDIT_DECLUTTER, EDIT_OBJECT_REMOVAL, EDIT_STAGING}

    def __init__(self) -> None:
        self._token = get_settings().replicate_api_token

    def available(self) -> bool:
        return bool(self._token)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

    def _build_input(self, job: GenEdit) -> dict:
        # Common Flux-Kontext-style image-edit schema: instruction + input image.
        return {
            "prompt": job.prompt,
            "input_image": _data_uri(job.image_bytes),
            "output_format": "jpg",
            "safety_tolerance": 2,
        }

    async def edit(self, job: GenEdit) -> GenResult:
        if not self.available():
            return GenResult(job.filename, None, "REPLICATE_API_TOKEN not set", self.name)
        model = _MODELS.get(job.edit)
        if not model:
            return GenResult(job.filename, None, f"No model mapped for '{job.edit}'", self.name)

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                created = await client.post(
                    f"{_API}/models/{model}/predictions",
                    headers=self._headers(), json={"input": self._build_input(job)},
                )
                created.raise_for_status()
                pred = created.json()
                get_url = pred.get("urls", {}).get("get")
                status = pred.get("status")

                waited = 0
                while status not in ("succeeded", "failed", "canceled"):
                    if waited >= _POLL_TIMEOUT_S:
                        raise TimeoutError("Replicate prediction timed out")
                    await asyncio.sleep(_POLL_INTERVAL_S)
                    waited += _POLL_INTERVAL_S
                    poll = await client.get(get_url, headers=self._headers())
                    poll.raise_for_status()
                    pred = poll.json()
                    status = pred.get("status")

                if status != "succeeded":
                    return GenResult(job.filename, None,
                                     f"Replicate {status}: {pred.get('error')}", self.name)

                out = pred.get("output")
                out_url = out[0] if isinstance(out, list) and out else out
                if not isinstance(out_url, str):
                    return GenResult(job.filename, None, "No output image URL", self.name)
                img = await client.get(out_url)
                img.raise_for_status()
                return GenResult(job.filename, img.content, None, self.name)

        except httpx.HTTPStatusError as e:
            msg = f"Replicate HTTP {e.response.status_code}: {e.response.text[:200]}"
            log.error(msg)
            return GenResult(job.filename, None, msg, self.name)
        except Exception as e:
            log.error("Replicate edit failed: %s", e)
            return GenResult(job.filename, None, str(e), self.name)
