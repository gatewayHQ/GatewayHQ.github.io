# Professional Photo Enhancer

Turn iPhone listing photos into magazine / MLS-ready images. A small, fast
Python (FastAPI) service that plugs into the Gateway agent toolkit: agents
upload one photo or a whole gallery, pick a house style, and download
high-res JPGs — with generative edits automatically disclosed for MLS
compliance.

This service is a **companion backend**. The rest of the toolkit is a static
SPA on GitHub Pages; heavy image work doesn't belong in the browser, so it
lives here. The SPA tool (`app/photo-enhancer.js`, tool card "Professional
Photo Enhancer") is a thin control surface that talks to these endpoints.

---

## What it does

| Transform | How | MLS disclosure? |
|---|---|---|
| Perspective correction / straighten verticals | Local (OpenCV) **or** Imagen | No — corrective |
| Exposure balance / HDR-style tone | Local (LAB + CLAHE) **or** Imagen | No — corrective |
| Window pull (recover blown windows) | Local mask **or** Imagen | No — corrective |
| Neutral white balance / cast removal | Local (gray-world + white-patch) **or** Imagen | No — corrective |
| Clarity, sharpening, detail | Local (unsharp) **or** Imagen | No — corrective |
| Consistent gallery styling | Shared house style / Imagen AI Profile | No — corrective |
| Sky replacement (blue / golden / dramatic) | Imagen **or** Replicate / Fal | **Yes** |
| Declutter / object removal | Replicate / Fal | **Yes** |
| Virtual staging (furnish empty rooms) | Replicate / Fal | **Yes** |

**Corrective** edits (geometry, exposure, color, detail) are what every real
estate photographer does in Lightroom — universally accepted, no disclosure.
**Generative** edits add or remove real-world content and are disclosed on the
delivered file and in a sidecar (see [MLS compliance](#mls-compliance)).

The corrective core runs **fully offline with no API keys** — so the tool is
useful on day one, and generative features layer on when you add a provider.

---

## Architecture

```
Agent (Toolkit SPA)                     Photo Enhancer backend (this service)
 app/photo-enhancer.js                   FastAPI (app/main.py)
        │  multipart upload + options JSON        │
        │  POST /api/enhance ───────────────────► │  batch.create_job() → job_id
        │  ◄──────────────────────── job_id       │        │ (asyncio background task)
        │                                          │        ▼
        │  poll GET /api/jobs/{id} ─────────────►  │   pipeline.process_batch()
        │  ◄─── per-photo status + URLs            │        │
        │                                          │  1. Claude analyze (room type, clutter)
        │  GET /output/{file}.jpg ──────────────►  │  2. Grade:  Imagen project  ── or ── local OpenCV
        │  GET /output/{file}.mls.json             │  3. Generative (opt-in): sky / declutter / stage
        │                                          │        via provider adapter (Imagen│Replicate│Fal)
        │                                          │  4. Resize → JPEG → embed disclosure → sidecar
```

Everything routes through one small interface (`providers/base.py`) so the
vendor is swappable via a single env var — no vendor lock-in.

### File structure

```
photo-enhancer/
├── app/
│   ├── main.py            FastAPI routes (enhance, jobs, styles, health, output)
│   ├── config.py          env-driven settings (pydantic-settings)
│   ├── models.py          request/response schemas
│   ├── pipeline.py        orchestration: analyze → grade → generative → finalize
│   ├── batch.py           in-memory job store + async background runner
│   ├── local_ops.py       deterministic OpenCV/NumPy transforms (MLS-safe core)
│   ├── imaging_io.py       decode/encode/resize (EXIF-orientation aware)
│   ├── house_style.py     named, reproducible looks (gallery consistency)
│   ├── claude_client.py   photo analysis + generative-prompt authoring
│   ├── prompts.py         the system prompts Claude uses
│   ├── mls.py             disclosure logic + EXIF/sidecar writing
│   └── providers/
│       ├── base.py        provider-agnostic interface + NullProvider
│       ├── imagen.py      Imagen AI adapter (primary — grade + sky)
│       ├── replicate.py   Replicate adapter (object removal / staging / sky)
│       └── fal.py         Fal.ai adapter (alternative)
├── static/index.html      standalone uploader (works without the SPA)
├── tests/test_local_ops.py
├── requirements.txt
└── .env.example
```

---

## Quick start

```bash
cd photo-enhancer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit as needed (works empty for local-only mode)
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000` for the built-in uploader, or point the toolkit at
it by setting `photoEnhancerUrl` in `ai-config.js` / `config.js`.

Run the offline tests (no keys required):

```bash
pytest -q
```

### Connect it to the toolkit

In `ai-config.js` (team) or `config.js` (local):

```js
photoEnhancerUrl: 'https://your-photo-enhancer-host'   // e.g. Render/Fly/Cloud Run URL
```

The "Professional Photo Enhancer" card then works end-to-end. If it's blank,
the tool shows a setup panel instead of erroring.

---

## Provider setup

Choose one with `GENERATIVE_PROVIDER` in `.env`. `none` = corrective-only.

### Imagen AI (recommended)

Imagen is purpose-built for real estate: HDR merge, perspective correction,
window pull, color correction, and sky replacement, driven by an **AI Profile**
that learns your editing style. It's project-based and batches a whole gallery
in one consistent pass — ideal here.

```env
GENERATIVE_PROVIDER=imagen
IMAGEN_API_KEY=your-key            # Business plan; request from Imagen
IMAGEN_BASE_URL=https://api.imagen-ai.com/v1
IMAGEN_PROFILE_KEY=your-profile    # the office "house style" (see below)
```

An API key requires Imagen's Business plan — request one via
`support.imagen-ai.com` → "Onboarding for Imagen API". Full docs:
`https://api-docs.imagen-ai.com/`.

#### Exact Imagen integration (what `providers/imagen.py` does)

Auth is the header `x-api-key: <IMAGEN_API_KEY>` on every call. The flow:

```
1. Create a project
   POST {base}/projects/
   → { "data": { "project_uuid": "..." } }

2. Get presigned upload links for your files
   POST {base}/projects/{uuid}/get_temporary_upload_links
   body: { "files_list": [ { "file_name": "front.jpg" }, ... ] }
   → { "data": { "files_list": [ { "file_name": "...", "upload_link": "https://s3..." } ] } }

3. PUT each photo to its S3 link
   PUT <upload_link>        headers: Content-Type: image/jpeg        body: <bytes>

4. Trigger the edit with your profile + real-estate options
   POST {base}/projects/{uuid}/edit
   body: {
     "profile_key": "<IMAGEN_PROFILE_KEY>",
     "hdr_merge": true,
     "perspective_correction": true,
     "window_pull": true,
     "color_correction": true,
     "straighten": true,
     "sky_replacement": true,          // only when requested
     "sky_type": "BLUE_SKY"            // BLUE_SKY | GOLDEN_HOUR | DRAMATIC
   }

5. Poll until the edit completes
   GET {base}/projects/{uuid}/edit/status   → { "data": { "status": "Completed" } }

6. Export to JPEG (Imagen returns XMP/DNG by default) and poll
   POST {base}/projects/{uuid}/export   body: { "file_type": "JPG" }
   GET  {base}/projects/{uuid}/export/status

7. Get download links and fetch the finished JPEGs
   GET {base}/projects/{uuid}/get_temporary_download_links
   → { "data": { "files_list": [ { "file_name": "...", "download_link": "..." } ] } }
```

> **Verify against the live docs.** The create-project, upload-links, and edit
> endpoints match Imagen's published API; the exact **edit-option field names**
> and the **status / export / download** paths can change between API versions.
> They're centralized in `imagen.py` (`_EP` map + `_edit_options()`) so you
> confirm them once at `api-docs.imagen-ai.com` and edit in one place. Every
> step is defensively parsed, so a shape mismatch surfaces as a clear error
> string on the affected photo rather than crashing the batch.

Imagen owns the **grade + sky**. It does **not** do object removal or virtual
staging — configure Replicate or Fal for those (the pipeline routes each edit
to whichever provider declares support, and clearly reports anything skipped).

### Replicate / Fal.ai (object removal, staging, alt sky)

```env
GENERATIVE_PROVIDER=replicate     # or: fal
REPLICATE_API_TOKEN=...           # FAL_API_KEY=... for fal
```

These run image-to-image / inpainting models per photo. Model slugs live in
`_MODELS` at the top of `providers/replicate.py` / `providers/fal.py` — they
change as better models ship, so pick current real-estate / inpainting models
from the provider's catalog and update that map. Claude authors the per-edit
instruction; the adapter passes it plus the source image to the model.

---

## Learning your office "house style"

Consistency across a listing gallery — and across every agent in the office —
comes from **one shared look**, applied two ways:

1. **Local look (always on).** `house_style.py` defines named styles
   (`gateway_default`, `warm_luxury`, `natural_flat`) as explicit numbers:
   white-balance bias, shadow lift, highlight recovery, vibrance, clarity,
   sharpening, straightening strength. Because they're numeric and shared, the
   whole gallery is graded identically. To tune the office look, edit the
   `LocalLook` for `gateway_default` (or add a new style) — it's the single
   source of truth, and trivially auditable.

2. **Learned AI Profile (Imagen).** Imagen AI Profiles *learn* an editing style
   from a batch of your own before/after edits, then reproduce it. To build the
   office profile:
   - In Imagen, edit ~1–2 representative galleries the way your office likes
     them (or import existing Lightroom edits).
   - Imagen trains a **Personal AI Profile** from those edits.
   - Copy that profile's key into `IMAGEN_PROFILE_KEY` (or set
     `imagen_profile_key` on a specific `HouseStyle` to bind a look to a
     profile). Every batch then grades with your learned style automatically.

Either way, the agent just picks a style from the dropdown — the consistency is
enforced server-side, not left to per-agent judgment.

---

## Batching

- One request = one batch = one listing gallery. `POST /api/enhance` accepts up
  to `MAX_BATCH` photos (default 40) as multipart, plus an `options` JSON field.
- The request returns a `job_id` immediately; work runs in an asyncio
  background task. The UI polls `GET /api/jobs/{id}` (~1.5s) and renders each
  photo the moment it finishes — the agent never waits on a blocking call.
- The **Imagen path grades the whole gallery in a single project** — the most
  consistent and cost-efficient option. The **local path** grades photos
  concurrently. Generative edits run per photo, gated by the analysis so empty
  rooms get staged and cluttered rooms get decluttered without the agent
  picking per-image.
- Photo analysis for the batch is fanned out concurrently (`asyncio.gather`).

Scaling note: the job store is in-memory (per process) — right for a small
office on one instance. To scale out, back it with Redis or the toolkit's
Supabase (`photo_jobs` table mirrors the `JobStatus` shape) and move rendering
to a worker queue; the model is already the contract.

---

## Error handling

- **Never lose the photo.** If a generative step or Imagen grade fails for a
  photo, the pipeline falls back to the local grade so the agent still gets a
  usable file; the failure is logged and surfaced on that photo's result.
- **Degrade gracefully without keys.** No `CLAUDE_API_KEY` → analysis returns a
  safe default and generative prompts use solid static templates. No generative
  provider → corrective-only, clearly reported by `/api/health`.
- **Per-photo isolation.** One bad file can't sink the batch — each photo
  carries its own `status` / `error`.
- **Input validation.** Content-type sniffing (JPEG/PNG/HEIC magic bytes),
  size caps (`MAX_UPLOAD_BYTES`), batch caps, and path-traversal-safe
  filenames on every upload and download.
- **Timeouts + clear messages.** All upstream calls (Claude, Imagen, Replicate,
  Fal, S3) are wrapped with timeouts and translate transport errors into
  readable messages rather than stack traces.
- **CORS locked** to `ALLOWED_ORIGIN`.

---

## MLS compliance

> Not legal advice. MLS rules and state law vary — confirm your local MLS's
> policy. This service implements a conservative, widely-accepted default.

The principle (NAR Code of Ethics, Article 12 — no misleading advertising): a
listing photo must not misrepresent the property.

- **Corrective edits are fine and undisclosed** — exposure, white balance,
  straightening, sharpening, window pull. They present the real space
  accurately, the way any professional shoot would.
- **Generative edits are disclosed** — sky replacement, decluttering / object
  removal, and especially **virtual staging**. Many MLSs additionally require
  the explicit label "Virtually Staged" and that the unaltered original remain
  available.

What the service does automatically (`mls.py`), for every generative edit:

1. **Decides** whether disclosure is required from the applied edit set.
2. **Generates** the disclosure caption (virtual staging gets the strongest,
   most specific wording).
3. **Embeds** it into the delivered JPEG's EXIF `ImageDescription` + `XPComment`
   so it travels with the file.
4. **Writes a sidecar** `<photo>.jpg.mls.json` next to the output — a full
   provenance record: which corrective vs. generative edits ran, the provider,
   and the **exact prompts** sent to the models. That's your audit trail.

The tool also **never** conceals defects, damage, or safety hazards — the
system prompts (`prompts.py`) forbid it, and object removal is scoped to
clearly personal/temporary clutter, not property condition.

Agent workflow: publish corrective-only photos freely; when you use a
generative edit, keep the original, apply your MLS's required label, and keep
the sidecar with your listing records.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + which providers/keys are configured |
| `GET` | `/api/styles` | House styles for the UI dropdown |
| `POST` | `/api/enhance` | Submit a batch (`files[]` + `options` JSON) → `job_id` |
| `GET` | `/api/jobs/{id}` | Poll job + per-photo results |
| `GET` | `/output/{file}` | Download a finished JPEG or `.mls.json` sidecar |
| `GET` | `/` | Built-in standalone uploader |

`options` (all optional; sensible defaults) matches `models.EnhanceOptions`:

```json
{
  "perspective_correction": true, "white_balance": true,
  "exposure_balance": true, "window_pull": true, "clarity_sharpen": true,
  "sky_replacement": "none|blue|golden_hour|dramatic",
  "declutter": false, "object_removal": ["car in driveway"],
  "virtual_staging": false, "staging_style": "modern",
  "house_style": "gateway_default", "long_edge": 2048
}
```

---

## Deployment

Any host that runs a Python ASGI app works (Render, Fly.io, Railway, Google
Cloud Run, a small VM). Container example:

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Set env vars (`ALLOWED_ORIGIN=https://gatewayhq.github.io`, `CLAUDE_API_KEY`,
`GENERATIVE_PROVIDER`, provider keys), deploy, then put the public URL in
`ai-config.js` → `photoEnhancerUrl`. Confirm with
`GET /api/health` (should show your provider available).
