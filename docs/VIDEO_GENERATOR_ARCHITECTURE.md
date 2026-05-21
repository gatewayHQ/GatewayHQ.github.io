# Video Generator — System Architecture

> Senior systems architecture design for the GatewayHQ listing video pipeline.
> Covers infrastructure, components, data flow, API design, database schema,
> caching strategy, and competitive differentiation.

---

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AGENT BROWSER                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  app/video.js  (SPA module — ~1800 lines, no build step)    │    │
│  │                                                             │    │
│  │  Form Inputs → Photo Compressor → Composition Builder       │    │
│  │       ↓                                ↓                   │    │
│  │  AI Fill (Claude)           Animation Engine               │    │
│  │  /api/claude                  (Ken Burns / Panoramic)       │    │
│  │                                        ↓                   │    │
│  │                          Render Orchestrator               │    │
│  │                    (vidRenderViaEdge preferred)             │    │
│  └───────────────────┬───────────────────┬─────────────────────┘    │
│                      │ HTTPS/JWT         │ Realtime WS              │
└──────────────────────┼───────────────────┼──────────────────────────┘
                       ↓                   ↓
┌──────────────────────────────┐   ┌───────────────────────────────────┐
│   SUPABASE EDGE FUNCTION     │   │        SUPABASE                   │
│   gateway-api (Deno)         │   │                                   │
│                              │   │  Auth (JWT sessions)              │
│  /api/health    (public)     │   │  video_jobs table                 │
│  /api/claude    (proxied)    │◄──┤  error_logs table                 │
│  /api/buffer    (proxied)    │   │  team_secrets table               │
│  /api/video-render           │   │                                   │
│       ↓                      │   │  Realtime (postgres_changes)      │
│  GitHub API (GH_PAT)         │   │  ← updates browser live           │
└──────────────────────────────┘   └───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────────────┐
│   GITHUB (gatewayhq/gatewayhq.github.io)                            │
│                                                                      │
│  compositions/pending/<slug>.html   ← uploaded by Edge Function      │
│                 ↓                                                    │
│  render-listing-video.yml (GitHub Actions)                           │
│    → Puppeteer + HyperFrames CLI → FFmpeg encode                    │
│    → Commit MP4 to renders/<slug>.mp4                                │
│    → Update video_jobs row (completed / failed)                      │
│                                                                      │
│  GitHub Pages (Fastly CDN)  ← static SPA + rendered videos          │
└──────────────────────────────────────────────────────────────────────┘
```

### Infrastructure Tiers

| Tier | Service | Role | Scale ceiling |
|------|---------|------|---------------|
| CDN / Static | GitHub Pages (Fastly) | SPA shell, JS, CSS, rendered MP4s | Unlimited (CDN) |
| API Proxy | Supabase Edge Functions (Deno) | Auth, Claude proxy, render dispatch | 500K req/day free tier |
| Database | Supabase Postgres | Job tracking, error logs, secrets | Up to 8GB free tier |
| Realtime | Supabase Realtime | Live render status push | 200 concurrent free tier |
| Render Worker | GitHub Actions (Ubuntu) | Puppeteer → FFmpeg → MP4 | 2000 min/month free |
| AI | Anthropic Claude API | Property copy, scene script | Pay-per-token |
| Social | Buffer API | Multi-platform post scheduling | Per-plan |

**Why this stack scales without K8s:**
- GitHub Pages + Fastly replaces Nginx/CDN pods — zero ops, global CDN included.
- Supabase Edge Functions replace ECS/Lambda — deploy with one CLI command, auto-scale.
- GitHub Actions replaces a job queue + worker fleet — free for open-source, pay-per-minute beyond.
- If render throughput exceeds Actions free tier: migrate render worker to Cloud Run or ECS Fargate, triggered by a Supabase `pg_net` webhook, keeping the rest of the stack unchanged.

---

## 2. Component Structure

```
app/video.js
├── Constants & Config
│   ├── VID_PLATFORMS         (landscape, portrait, square, reel)
│   ├── VID_MUSIC_LIBRARY     (5 royalty-free tracks)
│   └── VID_ANIM_TYPES        (kenBurns, panoramic, fade, zoom)
│
├── Photo Pipeline
│   ├── compressPhoto()       canvas → JPEG 78%, max 1280px
│   ├── compressPhotos()      Promise.all compression
│   └── vidHandlePhotoUpload() FileReader → dataUrl → preview
│
├── Composition Builders
│   ├── mkH()                 base HTML shell (CSS variables, GSAP CDN)
│   ├── sharedCss()           scene-type CSS (stats, agent, panoramic)
│   ├── statsScene()          Stats Card — gradient + accent lines
│   ├── agentScene()          Agent Close — dark gradient + headshot
│   ├── buildListing()        Standard listing (4 scenes)
│   ├── buildJustListed()     Just Listed variant
│   ├── buildJustSold()       Just Sold variant
│   ├── buildOpenHouse()      Open House variant
│   ├── buildPriceImproved()  Price Improved variant
│   └── buildNeighborhood()   Neighborhood highlight
│
├── Animation Engine
│   ├── kb(i, t, dur, dir)    Ken Burns — subtle zoom + pan
│   └── pan(i, t, dur, dir)   Panoramic — 165% wide, 32% sweep
│
├── Render Orchestrator
│   ├── vidRenderViaEdge()    PRIMARY: JWT → Edge Function → GitHub
│   ├── vidRenderSupabase()   FALLBACK: client PAT → Supabase tracking
│   └── vidRenderLegacy()     LEGACY: client PAT → direct dispatch
│
└── UI Bindings
    ├── vidSelectAnim()       animation card selection
    ├── vidGeneratePreview()  scene thumbnail grid (pc())
    └── vidAiFill()           Claude → auto-populate form fields

supabase/functions/gateway-api/index.ts
├── handleHealth()            GET /api/health — public
├── handleClaude()            POST /api/claude — proxied + rate-limited
├── handleBuffer()            POST /api/buffer — proxied
├── handleBufferProfiles()    GET /api/buffer-profiles — proxied
└── handleVideoRender()       POST /api/video-render — full pipeline
    ├── Validate JWT (getUser)
    ├── Upload composition HTML to GitHub (GH_PAT)
    ├── Insert video_jobs row (user's session — RLS-safe)
    └── Dispatch render-listing-video.yml workflow

.github/workflows/render-listing-video.yml
├── Concurrency group (per-slug — no duplicate renders)
├── Cache HyperFrames + Chrome binary
├── Run HyperFrames CLI → MP4
├── FFmpeg quality pass (balanced / high)
├── Commit to renders/<slug>.mp4
└── Update video_jobs (completed / failed) via Supabase REST
```

---

## 3. Data Flow

### 3a. Happy Path — Server-Side Render (preferred)

```
Agent                 video.js              Edge Function         GitHub               Supabase
  │                      │                       │                   │                    │
  │─ Fill form ──────────►│                       │                   │                    │
  │─ Upload photos ───────►│                       │                   │                    │
  │                       │◄ compressPhotos()      │                   │                    │
  │─ Generate Video ──────►│                       │                   │                    │
  │                       │─ buildComposition() ──►│                   │                    │
  │                       │  (HTML string)         │                   │                    │
  │                       │─ POST /api/video-render►│                   │                    │
  │                       │  {compHtmlB64,slug,...} │                   │                    │
  │                       │                       │─ PUT /contents/─── ►│                    │
  │                       │                       │  compositions/       │                    │
  │                       │                       │  pending/<slug>.html │                    │
  │                       │                       │◄─ 201 Created ──────│                    │
  │                       │                       │─ INSERT video_jobs ──────────────────────►│
  │                       │                       │  {user_id,slug,      │                    │
  │                       │                       │   status:'queued'}   │                    │
  │                       │                       │─ POST /dispatches ───►│                    │
  │                       │                       │  {ref,inputs:{slug}} │                    │
  │                       │                       │◄─ 204 No Content ───│                    │
  │                       │◄─ {jobId,slug} ────────│                   │                    │
  │                       │─ subscribe Realtime ─────────────────────────────────────────────►│
  │◄── status: queued ────│                       │                   │                    │
  │                       │                       │         ┌─────────────────────────────┐  │
  │                       │                       │         │  GitHub Actions              │  │
  │                       │                       │         │  render-listing-video.yml   │  │
  │                       │                       │         │  ↓ checkout                 │  │
  │                       │                       │         │  ↓ HyperFrames render       │  │
  │                       │                       │         │  ↓ FFmpeg encode            │  │
  │                       │                       │         │  ↓ commit renders/<slug>.mp4│  │
  │                       │                       │         │  ↓ PATCH video_jobs ────────│──►│
  │                       │                       │         │    status: completed         │  │
  │                       │                       │         └─────────────────────────────┘  │
  │◄── Realtime push ─────│◄─────────────────────────────────────────────────────────────────│
  │    render_url = ...    │                       │                   │                    │
  │─ Download / Share ─────►│                       │                   │                    │
```

### 3b. Fallback Chain

```
Is user logged in via Supabase?
├── YES + proxyUrl set → vidRenderViaEdge()    (no client PAT needed)
├── YES + no proxyUrl → vidRenderSupabase()    (client PAT, Supabase tracking)
└── NO              → vidRenderLegacy()        (client PAT, polling only)
```

### 3c. AI Fill Flow

```
Agent clicks "AI Fill"
  → POST /api/claude {user: "Extract property details from: ...", max_tokens: 800}
  → Edge Function validates JWT + rate limits + token cap
  → Anthropic Claude API
  → Response parsed → form fields populated
```

---

## 4. API Design Specification

### Base URL
```
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/gateway-api
```

### Authentication
All routes except `/api/health` require:
```
Authorization: Bearer <supabase-jwt>
```
JWT is the user's active Supabase session token (`session.access_token`).

---

### GET /api/health
Public. No auth required.

**Response 200:**
```json
{
  "ok": true,
  "version": "2.1.0",
  "ts": "2026-05-21T12:00:00.000Z",
  "services": {
    "claude": true,
    "buffer": false
  }
}
```

---

### POST /api/claude
Generate AI text via Claude. Rate-limited 30 req/min/user.

**Request:**
```json
{
  "system": "You are a real estate copywriter...",
  "user": "Write a 3-sentence listing description for...",
  "max_tokens": 800,
  "model": "claude-sonnet-4-6"
}
```

**Response 200:** Anthropic messages API response (pass-through).

**Error responses:**
| Status | Meaning |
|--------|---------|
| 400 | Missing/empty user prompt or invalid JSON |
| 401 | No valid session |
| 413 | Body > 32 KB |
| 429 | Rate limit exceeded (Retry-After: 60) |
| 503 | CLAUDE_API_KEY not configured |

---

### POST /api/video-render
Upload composition + dispatch render workflow. No body-size limit (compositions are 1–4 MB with photos).

**Request:**
```json
{
  "compHtmlB64": "<base64-encoded HTML string>",
  "slug": "123-main-st-listing",
  "platform": "landscape",
  "musicPath": "music/01-luxury-calm.mp3",
  "branch": "main",
  "quality": "balanced"
}
```

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `compHtmlB64` | Yes | Base64-encoded composition HTML |
| `slug` | Yes | Output filename (no extension). Used as job ID and file path. |
| `platform` | No | `landscape` \| `portrait` \| `square` (default: `landscape`) |
| `musicPath` | No | Repo-relative path to background music MP3 |
| `branch` | No | Git branch to dispatch against (default: `main`) |
| `quality` | No | `balanced` \| `high` (default: `balanced`) |

**Response 200:**
```json
{
  "jobId": "uuid-here-or-null",
  "slug": "123-main-st-listing",
  "compositionPath": "compositions/pending/123-main-st-listing.html"
}
```

**Error responses:**
| Status | Meaning |
|--------|---------|
| 400 | Missing compHtmlB64 or slug |
| 401 | No valid session |
| 503 | GH_PAT not configured, or GitHub 401 (bad token) |
| 502 | GitHub upload or workflow dispatch failed |

---

### POST /api/buffer
Schedule a post to one or more Buffer profiles.

**Request:**
```json
{
  "profileIds": ["abc123", "def456"],
  "text": "Just listed! 3BD/2BA at 123 Main St...",
  "mediaUrl": "https://gatewayhq.github.io/renders/123-main-st.mp4",
  "scheduledAt": "2026-05-22T14:00:00.000Z"
}
```

**Response 200:**
```json
{
  "results": [{ "profileId": "abc123", "updateId": "xyz" }],
  "errors": [],
  "success": true
}
```

---

### GET /api/buffer-profiles
List connected Buffer social profiles.

**Response 200:**
```json
{
  "profiles": [
    { "id": "abc123", "service": "instagram", "handle": "@gatewayrealestate", "avatar": "https://..." }
  ]
}
```

---

## 5. Database Schema

```sql
-- ── Video render jobs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_jobs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug             text NOT NULL,
  status           text NOT NULL DEFAULT 'queued',
  -- status enum: queued | rendering | completed | failed
  platform         text DEFAULT 'landscape',
  composition_path text,
  render_url       text,            -- public URL of completed MP4
  elapsed_sec      integer,         -- wall-clock seconds for the render
  error_msg        text,            -- populated on failure
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Index for user job history queries
CREATE INDEX IF NOT EXISTS video_jobs_user_id_idx ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS video_jobs_status_idx  ON video_jobs(status);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own jobs" ON video_jobs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime — browser subscribes to postgres_changes on this table
ALTER PUBLICATION supabase_realtime ADD TABLE video_jobs;

-- ── Client-side error tracking ───────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message    text,
  source     text,
  line_no    integer,
  col_no     integer,
  stack      text,
  url        text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own errors"   ON error_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own errors" ON error_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Team shared credentials (RLS-protected) ──────────────────────
CREATE TABLE IF NOT EXISTS team_secrets (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Only authenticated users can read; only admins should insert
ALTER TABLE team_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read secrets" ON team_secrets
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── Health monitoring snapshots ──────────────────────────────────
CREATE TABLE IF NOT EXISTS system_health (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at   timestamptz NOT NULL,
  pages_ok     boolean,
  edge_ok      boolean,
  supabase_ok  boolean,
  pages_status text,
  edge_status  text,
  run_id       text,
  created_at   timestamptz DEFAULT now()
);
```

### Schema rationale

- **`video_jobs.render_url`** — set by the GitHub Actions workflow after committing the MP4. Points to `https://gatewayhq.github.io/renders/<slug>.mp4`.
- **`video_jobs.elapsed_sec`** — used for capacity planning: if P95 > 90s, consider upgrading the render runner.
- **`video_jobs.status` state machine:** `queued` → `rendering` → `completed | failed`. Any other transition is invalid.
- **RLS on `video_jobs`** — each agent only sees and modifies their own jobs. The GitHub Actions workflow uses `SUPABASE_SERVICE_ROLE_KEY` to update job status (bypasses RLS legitimately).

---

## 6. Caching Strategy

### Layer-by-layer

| Layer | What's cached | TTL | Mechanism |
|-------|--------------|-----|-----------|
| Browser — photos | Compressed photo dataURLs | Session | `sessionStorage` keyed by `file.name + file.size` |
| Browser — AI Fill | Claude responses per property | Session | `sessionStorage` keyed by address hash |
| Browser — Buffer profiles | Social profile list | 5 min | In-memory `let _profilesCache` |
| Browser — music tracks | MP3 files | Browser HTTP cache | Static files served with `Cache-Control: max-age=31536000` |
| CDN (Fastly) | SPA shell, JS, CSS, MP4s | Until next push | GitHub Pages default headers |
| Edge Function — rate limiter | Per-user request count | 60s window | In-memory `Map` (reset on cold start) |
| GitHub Actions — deps | HyperFrames npm, Chrome binary | Until cache key changes | `actions/cache` keyed by `package-lock.json` hash |

### Photo compression caching (current implementation)

```javascript
// Before compressing, check sessionStorage
const cacheKey = `photo-${file.name}-${file.size}`;
const cached = sessionStorage.getItem(cacheKey);
if (cached) return cached;
const compressed = await compressPhoto(dataUrl, 1280);
sessionStorage.setItem(cacheKey, compressed);
return compressed;
```

### What we deliberately do NOT cache

- **Composition HTML** — built fresh every render. Stale HTML from a previous session would embed outdated form data. Build time is ~10ms; not worth caching.
- **`video_jobs` rows** — always fetched from Supabase so the browser always sees live status.
- **Auth tokens** — handled entirely by Supabase client library (auto-refresh, secure storage).

### Future: CDN-level cache for rendered videos

When render volume grows, add a `Cache-Control: public, max-age=86400` header to MP4 responses via a GitHub Pages `_headers` file (Netlify-style, not supported natively) or by migrating video storage to Supabase Storage with custom headers. Fastly will then cache the video at the CDN edge on first request.

---

## 7. Top 5 Ideas to Beat Every Paid Real Estate Video Platform

The paid platforms (Animoto, Promo, Typito, InVideo, Lumen5) all share the same weakness: **static templates + manual data entry + one output per render**. Here's how to beat each one:

---

### #1 — AI Vision Scene Planner

**What:** Send uploaded property photos to Claude's vision API. Claude analyzes each photo (bedroom, kitchen, exterior, pool, view) and automatically assigns the optimal scene type, animation style, and copy for each. Agents upload photos and click one button — the entire 4-scene sequence is pre-built, with copy written to match the room.

**Why it beats competitors:** Every paid platform requires the agent to manually pick which photo goes in which scene and type their own text. This eliminates both steps. The result is a video tailored to what's actually in the photos, not a generic template.

**Implementation path:**
```javascript
// POST /api/claude with vision
{ model: 'claude-opus-4-7', messages: [
    { role: 'user', content: [
        { type: 'text', text: 'Analyze these property photos. For each, identify room type and suggest: scene title, 2-sentence copy, animation style (ken-burns or panoramic). Return JSON array.' },
        ...photos.map(p => ({ type: 'image_source': { type: 'base64', ... } }))
    ]}
]}
```

---

### #2 — Browser-Side 15-Second Quick Preview

**What:** Before the full 2-5 minute GitHub Actions render, generate a real-time 15-second preview video **entirely in the browser** using the Web Animations API + `MediaRecorder` on a `<canvas>`. The agent sees a draft in under 5 seconds and only triggers the full render when happy.

**Why it beats competitors:** No paid platform offers in-browser preview of the actual video before render. They show a static mockup. We show the real thing — music, animations, all — in the browser before spending any render time.

**Implementation path:**
- GSAP animates scenes on a hidden `<canvas>` element.
- `canvas.captureStream(30)` + `MediaRecorder` records at 30fps.
- Audio mixed via Web Audio API (`AudioContext` + `createBufferSource`).
- Total output: ~3MB preview MP4, available in 8–12 seconds, no server needed.

---

### #3 — One-Click Multi-Format Export

**What:** A single render job produces 4 aspect ratios simultaneously: landscape (16:9 for YouTube/email), portrait (9:16 for Instagram/TikTok Reels), square (1:1 for Facebook/LinkedIn), and 4:5 for Instagram feed. The GitHub Actions job runs FFmpeg 4 times in parallel after the Puppeteer render.

**Why it beats competitors:** Animoto and InVideo charge extra per format, or require separate export jobs. Agents posting across platforms manually resize or skip vertical formats entirely. We automate all 4 for free in a single click.

**Implementation path:**
```yaml
# In render-listing-video.yml — after HyperFrames renders landscape:
- name: Generate all formats
  run: |
    ffmpeg -i renders/$SLUG.mp4 -vf "scale=1080:1920,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" renders/${SLUG}-reel.mp4
    ffmpeg -i renders/$SLUG.mp4 -vf "scale=1080:1080,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" renders/${SLUG}-square.mp4
    ffmpeg -i renders/$SLUG.mp4 -vf "scale=1080:1350,pad=1080:1350:(ow-iw)/2:(oh-ih)/2" renders/${SLUG}-feed.mp4
```

---

### #4 — QR Code + Short Link Auto-Embedded in Closing Scene

**What:** When the agent fills in a listing URL, automatically generate a Bitly short link + QR code (via the Bitly MCP already integrated in this project) and embed it in the Stats Card scene. Buyers scanning the video on social can go directly to the listing. The agent can track click-through from the video in their Bitly dashboard.

**Why it beats competitors:** Zero paid RE video platforms embed trackable links or QR codes in the video itself. This turns a passive marketing asset into a measurable one — agents can prove ROI on their video marketing.

**Implementation path:**
```javascript
// In vidBuildComposition(), after user inputs are collected:
if (formData.listingUrl) {
  const shortLink = await GatewayAPI.createShortLink(formData.listingUrl); // Bitly
  const qrDataUrl = await renderQRToCanvas(shortLink.url); // qrcode.js, no dep needed
  // inject into statsScene() template as a positioned <img>
}
```

---

### #5 — Agent Brand Pack — One-Time Setup, Automatic in Every Video

**What:** An agent fills out their brand profile once (headshot, name, phone, email, brokerage name + logo, brand colors, DRE license number). Every video they generate automatically applies their exact brand — no per-video configuration. The profile is stored in Supabase `team_secrets` per agent.

**Why it beats competitors:** Animoto and Promo require agents to re-upload their logo and retype their contact info for every video. Agents with multiple listings in a month waste 10 minutes per video on brand setup. Our brand pack is set once and applied automatically — including pulling updated headshots and logos via URL references so they stay current without any manual update.

**Implementation path:**
- New `agent_profiles` Supabase table: `{ id, user_id, headshot_url, name, phone, email, brokerage, logo_url, brand_color, license_no }`.
- `app/sync.js` loads the profile on login and caches to `window._gwAgentProfile`.
- `agentScene()` in `video.js` reads from `window._gwAgentProfile` and falls back to form inputs.
- Agent profile editor page added to the toolkit SPA (`page-agent-profile`).

---

## 8. Render Reliability Architecture

```
Render request
     │
     ▼
Edge Function: /api/video-render
  - Validates JWT
  - Uploads composition HTML (idempotent PUT — safe to retry)
  - Creates video_jobs row (status: queued)
  - Dispatches GitHub Actions workflow
     │
     ▼
render-listing-video.yml
  concurrency:
    group: render-${{ github.event.inputs.output_slug }}
    cancel-in-progress: false   ← never cancel a running render
  
  strategy.max-parallel: 1     ← queue, don't stack
  
  on failure: auto-retry 2x (transient Puppeteer/Chrome crashes)
  
  always: cleanup compositions/pending/<slug>.html
  always: update video_jobs status (completed/failed + elapsed_sec)
     │
     ▼
Supabase Realtime → browser gets live status update
```

### Failure modes and mitigations

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| GitHub upload 401 | Edge Function returns 503 | Rotate `GH_PAT` in Supabase secrets |
| Workflow dispatch fails | 4xx from GitHub API | Edge Function returns 502 with message |
| Puppeteer crash | Actions step failure | Auto-retry 2x (configured in workflow) |
| Render takes > 45 min | Actions `timeout-minutes: 45` | Job marked failed; agent retries |
| Supabase Realtime down | Browser doesn't get push | Browser polls `video_jobs` every 10s as fallback |
| `video_jobs` insert fails | Console warning in Edge Function | Render proceeds; no Realtime updates for this job |

---

## 9. Security Posture

| Control | Implementation |
|---------|---------------|
| Auth | Supabase JWT — verified in code on every non-health route |
| Rate limiting | 30 req/min per user in-memory (Edge Function) |
| Token cap | Max 4000 tokens per Claude call |
| Model allowlist | Only `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-7` |
| Body size cap | 32 KB on `/api/claude`; no cap on `/api/video-render` (compositions are large) |
| CORS | `ALLOWED_ORIGIN` env var — only `https://gatewayhq.github.io` |
| GitHub token | Server-side only (`GH_PAT` Edge Function secret, never sent to browser) |
| RLS | `video_jobs`, `error_logs`, `team_secrets` all have row-level security |
| Secret scanning | CI rejects commits with `sk-ant-api`, `ghp_`, `service_role` patterns |
| No build step | No supply chain attack surface from npm bundler/transpiler |

---

*Last updated: 2026-05-21*
