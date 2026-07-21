"""FastAPI app — the HTTP surface of the Photo Enhancer.

Routes:
  GET  /api/health                 liveness + which providers are configured
  GET  /api/styles                 available house styles (for the UI dropdown)
  POST /api/enhance                submit a batch → returns a job_id
  GET  /api/jobs/{job_id}          poll job status + per-photo results
  GET  /output/{filename}          download a finished JPEG or sidecar
  GET  /                           minimal self-contained upload UI (optional)

Designed to sit alongside the toolkit: the SPA (app/photo-enhancer.js) calls
these endpoints. CORS is locked to ALLOWED_ORIGIN.
"""
from __future__ import annotations

import json
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from . import __version__, batch, house_style
from .config import get_settings
from .models import EnhanceOptions, JobStatus
from .providers import get_provider

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("photo-enhancer")

settings = get_settings()
app = FastAPI(title="Gateway Photo Enhancer", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin, "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> JSONResponse:
    provider = get_provider()
    return JSONResponse({
        "ok": True,
        "version": __version__,
        "generative_provider": provider.name,
        "provider_available": provider.available(),
        "provider_capabilities": sorted(provider.capabilities),
        "claude_configured": bool(settings.claude_api_key),
    })


@app.get("/api/styles")
def styles() -> JSONResponse:
    return JSONResponse({"styles": house_style.list_styles()})


@app.post("/api/enhance", response_model=JobStatus)
async def enhance(
    files: list[UploadFile] = File(...),
    options: str = Form("{}"),
) -> JobStatus:
    """`options` is a JSON string matching EnhanceOptions (sent as a form field
    so it rides alongside the multipart file upload)."""
    if not files:
        raise HTTPException(400, "No files uploaded")
    if len(files) > settings.max_batch:
        raise HTTPException(400, f"Too many photos (max {settings.max_batch})")

    try:
        opts = EnhanceOptions.model_validate(json.loads(options or "{}"))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(400, f"Invalid options: {e}")

    photos: list[tuple[str, bytes]] = []
    for f in files:
        data = await f.read()
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(413, f"{f.filename} exceeds max upload size")
        if not data:
            raise HTTPException(400, f"{f.filename} is empty")
        # Basic content sniff — JPEG/PNG/HEIC magic. iPhones send JPEG/HEIC.
        if not (data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n"
                or data[4:12] in (b"ftypheic", b"ftypmif1")):
            raise HTTPException(400, f"{f.filename} is not a supported image (JPEG/PNG/HEIC)")
        photos.append((_safe_name(f.filename), data))

    return batch.create_job(photos, opts)


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
def job_status(job_id: str) -> JobStatus:
    job = batch.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found (it may have expired on restart)")
    return job


@app.get("/output/{filename}")
def download(filename: str) -> FileResponse:
    safe = _safe_name(filename)
    path = settings.output_path / safe
    if not path.exists():
        raise HTTPException(404, "File not found")
    media = "application/json" if safe.endswith(".json") else "image/jpeg"
    return FileResponse(path, media_type=media, filename=safe)


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    from pathlib import Path
    ui = Path(__file__).parent.parent / "static" / "index.html"
    if ui.exists():
        return HTMLResponse(ui.read_text())
    return HTMLResponse("<h1>Gateway Photo Enhancer</h1><p>API is running. See /api/health.</p>")


def _safe_name(name: str | None) -> str:
    """Prevent path traversal; keep only a basename with safe chars."""
    import re
    base = (name or "photo.jpg").replace("\\", "/").split("/")[-1]
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return base or "photo.jpg"
