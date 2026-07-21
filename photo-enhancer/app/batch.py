"""In-memory batch job store + background runner.

Jobs run as asyncio background tasks; the frontend submits a batch, gets a
job_id immediately, then polls GET /api/jobs/{id}. This keeps the UI responsive
during long generative renders (the "minimal clicks, non-blocking" goal).

Scope note: this store is per-process and resets on restart — fine for a small
office tool with a single backend instance. To scale horizontally, back it with
Redis or the toolkit's Supabase (a `photo_jobs` table mirrors this shape) and
move rendering to a worker queue; the JobStatus model is already the contract.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from .models import EnhanceOptions, JobStatus, PhotoResult
from .providers import get_provider
from . import pipeline

log = logging.getLogger("photo-enhancer.batch")

_JOBS: dict[str, JobStatus] = {}
_MAX_KEEP = 200                          # cap memory; evict oldest beyond this


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(photos: list[tuple[str, bytes]], opts: EnhanceOptions) -> JobStatus:
    job_id = uuid.uuid4().hex[:12]
    job = JobStatus(
        job_id=job_id, state="queued", created_at=_now(),
        total=len(photos), completed=0, failed=0, house_style=opts.house_style,
        photos=[PhotoResult(filename=fn, status="queued") for fn, _ in photos],
    )
    _JOBS[job_id] = job
    _evict_old()
    # Fire-and-forget the runner.
    asyncio.create_task(_run(job_id, photos, opts))
    return job


def get_job(job_id: str) -> JobStatus | None:
    return _JOBS.get(job_id)


def _evict_old() -> None:
    if len(_JOBS) <= _MAX_KEEP:
        return
    for k in sorted(_JOBS, key=lambda k: _JOBS[k].created_at)[:len(_JOBS) - _MAX_KEEP]:
        _JOBS.pop(k, None)


async def _run(job_id: str, photos: list[tuple[str, bytes]], opts: EnhanceOptions) -> None:
    job = _JOBS[job_id]
    job.state = "running"
    provider = get_provider()
    by_name = {p.filename: p for p in job.photos}

    def on_update(res: PhotoResult) -> None:
        by_name[res.filename] = res
        job.photos = list(by_name.values())
        job.completed = sum(1 for p in job.photos if p.status == "done")
        job.failed = sum(1 for p in job.photos if p.status == "error")

    try:
        await pipeline.process_batch(photos, opts, provider, on_update)
        job.state = "done"
    except Exception as e:
        log.exception("Job %s crashed", job_id)
        job.state = "error"
        job.error = str(e)
        for p in job.photos:
            if p.status not in ("done", "error"):
                p.status = "error"
                p.error = "batch aborted"
