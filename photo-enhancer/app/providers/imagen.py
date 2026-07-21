"""Imagen AI adapter — the primary/recommended provider.

Imagen is purpose-built for real-estate post-production: HDR merge, perspective
correction, window pull, color correction, and sky replacement, driven by an
"AI Profile" that learns your office's editing style (see README → house
style). It is project-based: create a project, upload photos, trigger an edit
with your profile + real-estate options, poll until done, optionally export to
JPEG, then download.

Auth: `x-api-key` header. An API key requires Imagen's Business plan — request
one from Imagen (support.imagen-ai.com → "Onboarding for Imagen API").
Base URL: https://api.imagen-ai.com/v1

── Endpoint verification note ─────────────────────────────────────────────
The create-project, get_temporary_upload_links, and edit endpoints below match
Imagen's published API. The exact edit-option field names and the status/
export/download endpoint paths can evolve — they are centralized in the `_EP`
map and `_edit_options()` so you can confirm them against the live docs at
https://api-docs.imagen-ai.com/ and adjust in one place. Every network step is
defensively parsed and wrapped, so a shape mismatch surfaces as a clear error
rather than a crash.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import get_settings
from .base import (
    GenerativeProvider, GenEdit, GenResult,
    EDIT_GRADE, EDIT_SKY,
)

log = logging.getLogger("photo-enhancer.imagen")

# Centralized endpoint paths (relative to base_url). Confirm against live docs.
_EP = {
    "create_project": "/projects/",
    "upload_links": "/projects/{uuid}/get_temporary_upload_links",
    "edit": "/projects/{uuid}/edit",
    "edit_status": "/projects/{uuid}/edit/status",
    "export": "/projects/{uuid}/export",
    "export_status": "/projects/{uuid}/export/status",
    "download_links": "/projects/{uuid}/get_temporary_download_links",
}

_POLL_INTERVAL_S = 4
_POLL_TIMEOUT_S = 600           # 10 min ceiling per batch
_SKY_MAP = {"blue": "BLUE_SKY", "golden_hour": "GOLDEN_HOUR", "dramatic": "DRAMATIC"}


class ImagenProvider(GenerativeProvider):
    name = "imagen"
    # Imagen owns the full non-generative grade AND sky replacement. Object
    # removal / virtual staging are NOT Imagen features — route those to
    # Replicate/Fal (declared via their capabilities).
    capabilities = {EDIT_GRADE, EDIT_SKY}

    def __init__(self) -> None:
        s = get_settings()
        self._key = s.imagen_api_key
        self._base = s.imagen_base_url.rstrip("/")
        self._profile = s.imagen_profile_key

    def available(self) -> bool:
        return bool(self._key)

    # ── low-level HTTP ────────────────────────────────────────────────
    def _headers(self) -> dict:
        return {"x-api-key": self._key, "Content-Type": "application/json"}

    async def _post(self, client: httpx.AsyncClient, path: str, body: dict | None = None) -> dict:
        r = await client.post(self._base + path, headers=self._headers(), json=body or {})
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _get(self, client: httpx.AsyncClient, path: str) -> dict:
        r = await client.get(self._base + path, headers=self._headers())
        r.raise_for_status()
        return r.json() if r.content else {}

    @staticmethod
    def _dig(d: dict, *keys: str):
        """Pull the first present key from a possibly-nested {'data': {...}}."""
        scope = d.get("data", d) if isinstance(d, dict) else {}
        for k in keys:
            if isinstance(scope, dict) and k in scope:
                return scope[k]
        return None

    def _edit_options(self, sky: str, profile_key: str) -> dict:
        """Build the edit payload. Keep the real-estate flags here so they're
        easy to confirm against the docs."""
        opts = {
            "profile_key": profile_key or self._profile,
            "hdr_merge": True,
            "perspective_correction": True,
            "window_pull": True,
            "color_correction": True,
            "crop": False,
            "straighten": True,
            "smooth_skin": False,
        }
        if sky and sky != "none":
            opts["sky_replacement"] = True
            opts["sky_type"] = _SKY_MAP.get(sky, "BLUE_SKY")
        return opts

    # ── polling helper ────────────────────────────────────────────────
    async def _poll(self, client: httpx.AsyncClient, path: str) -> None:
        waited = 0
        while waited < _POLL_TIMEOUT_S:
            data = await self._get(client, path)
            status = str(self._dig(data, "status", "state") or "").lower()
            if status in ("completed", "done", "success", "finished"):
                return
            if status in ("failed", "error"):
                raise RuntimeError(f"Imagen reported '{status}' for {path}")
            await asyncio.sleep(_POLL_INTERVAL_S)
            waited += _POLL_INTERVAL_S
        raise TimeoutError(f"Imagen poll timed out after {_POLL_TIMEOUT_S}s: {path}")

    # ── batch grade (the recommended path) ────────────────────────────
    async def process_batch(self, images: list[tuple[str, bytes]], *,
                            sky: str = "none", profile_key: str = "") -> list[GenResult]:
        """Run one project through the whole Imagen flow for a set of photos:
        create → upload → edit (grade [+ sky]) → export JPEG → download.

        This is where Imagen shines: one consistent, profile-driven grade across
        the entire gallery in a single pass.
        """
        if not self.available():
            return [GenResult(fn, None, "Imagen API key not set", self.name) for fn, _ in images]

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                proj = await self._post(client, _EP["create_project"],
                                        {"name": "gateway-enhance"})
                uuid = self._dig(proj, "project_uuid", "uuid", "id")
                if not uuid:
                    raise RuntimeError(f"No project_uuid in response: {proj}")

                # 1) request presigned upload links
                links = await self._post(
                    client, _EP["upload_links"].format(uuid=uuid),
                    {"files_list": [{"file_name": fn} for fn, _ in images]},
                )
                link_list = self._dig(links, "files_list", "upload_links") or []
                by_name = {item.get("file_name"): item.get("upload_link") for item in link_list}

                # 2) PUT each photo to its S3 link
                for fn, data in images:
                    url = by_name.get(fn)
                    if not url:
                        raise RuntimeError(f"No upload link returned for {fn}")
                    up = await client.put(url, content=data,
                                          headers={"Content-Type": "image/jpeg"})
                    up.raise_for_status()

                # 3) trigger edit + poll
                await self._post(client, _EP["edit"].format(uuid=uuid),
                                 self._edit_options(sky, profile_key))
                await self._poll(client, _EP["edit_status"].format(uuid=uuid))

                # 4) export to JPEG + poll
                await self._post(client, _EP["export"].format(uuid=uuid), {"file_type": "JPG"})
                await self._poll(client, _EP["export_status"].format(uuid=uuid))

                # 5) download links → bytes
                dl = await self._get(client, _EP["download_links"].format(uuid=uuid))
                dl_list = self._dig(dl, "files_list", "download_links") or []
                dl_by_name = {i.get("file_name"): i.get("download_link") for i in dl_list}

                results: list[GenResult] = []
                for fn, _ in images:
                    url = dl_by_name.get(fn)
                    if not url:
                        results.append(GenResult(fn, None, "No download link", self.name))
                        continue
                    got = await client.get(url)
                    got.raise_for_status()
                    results.append(GenResult(fn, got.content, None, self.name))
                return results

        except httpx.HTTPStatusError as e:
            msg = f"Imagen HTTP {e.response.status_code}: {e.response.text[:200]}"
            log.error(msg)
            return [GenResult(fn, None, msg, self.name) for fn, _ in images]
        except Exception as e:
            log.error("Imagen batch failed: %s", e)
            return [GenResult(fn, None, str(e), self.name) for fn, _ in images]

    # ── single-image interface (delegates to a 1-photo batch) ─────────
    async def edit(self, job: GenEdit) -> GenResult:
        if job.edit not in self.capabilities:
            return GenResult(job.filename, None,
                             f"Imagen does not support '{job.edit}'", self.name)
        sky = job.params.get("sky", "none") if job.edit == EDIT_SKY else "none"
        results = await self.process_batch(
            [(job.filename, job.image_bytes)], sky=sky,
            profile_key=job.params.get("profile_key", ""),
        )
        return results[0]
