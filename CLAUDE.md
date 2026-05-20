# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GatewayHQ is a real estate agent toolkit SPA for Gateway Real Estate Advisors. It's a vanilla JavaScript, no-build-step static site hosted on GitHub Pages, with a Vercel serverless API proxy backend and Supabase for auth/secrets management.

## Deployment

**Main site (GitHub Pages):** Push to any branch and it deploys automatically.

**API proxy (Vercel):**
```bash
cd gateway-proxy
npx vercel deploy --prod
```
Required Vercel env vars: `CLAUDE_API_KEY`, `BUFFER_ACCESS_TOKEN`, `GATEWAY_SECRET`, `ALLOWED_ORIGIN`

**Video rendering (GitHub Actions):**
Trigger the `Render Listing Video` workflow manually with:
- `output_slug` — output filename (no extension)
- `composition_path` — repo-relative path to the composition HTML
- `music_path` — optional background music file path

Rendered videos are committed to `renders/` automatically.

## Architecture

### No Build Step
This is plain HTML/CSS/JS. There is no `npm run build`, no bundler, no transpilation. Changes to `.js` or `.html` files are live immediately on push.

### SPA Structure
`index.html` is the entire app shell. Each tool is a separate module in `app/`:
- `app/core.js` — brand colors, AI status badge, config auto-wire on page load
- `app/api.js` — centralized API client for all Claude and Buffer calls (handles retry, timeout, proxy routing)
- `app/router.js` — client-side navigation between tools
- `app/sync.js` — Supabase login to access team-shared Claude key
- Other `app/*.js` files — individual tools (social, video, valuation, leasing, invoice, etc.)

### API Layer
All external API calls go through `app/api.js`. It proxies Claude and Buffer requests through the Vercel backend (`gateway-proxy/api/`) to avoid exposing keys in the browser. The proxy validates requests with `GATEWAY_SECRET`.

### Secrets & Config
- **Local dev:** Copy `config.example.js` to `config.js` (git-ignored). Set `proxyUrl`, `proxySecret`, `claudeApiKey`, `bufferAccessToken`.
- **Team/cloud:** Keys stored in Supabase `team_secrets` table (RLS-protected). `ai-config.js` points to the Supabase project. Agents log in via `app/sync.js` to retrieve the shared Claude key.
- **Never commit** `config.js`, `.env`, or any file with live API keys.

### Video Generation
Listing promo videos are built as HTML compositions using **HyperFrames** with GSAP timelines, then rendered headlessly via Puppeteer in GitHub Actions. Compositions live in `compositions/`. The custom skill at `.claude/skills/listing-video/SKILL.md` contains the full brand template, 4-scene structure, and step-by-step workflow — read that file before generating any listing video.

Key HyperFrames CLI commands (run at composition level):
```bash
npx hyperframes lint          # validate composition
npx hyperframes preview       # local browser preview
npx hyperframes render        # render to video locally
```

### Supabase Edge Functions
`supabase/functions/gateway-api/index.ts` is an alternative backend deployed to Supabase Edge Functions. Schema/migrations are in `gateway-proxy/supabase/migration.sql`.

### Session-Start Hook
On remote Claude Code sessions, `.claude/hooks/session-start.sh` runs automatically and installs the HyperFrames skill suite globally via `npx skills add heygen-com/hyperframes --yes --global`. Installed skills live in `.agents/skills/`.

## Brand

Brand identity is in `brand/brand.json` and `brand/` assets. The primary palette and logo usage are referenced throughout GSAP compositions and the listing-video skill. Always use brand colors from `brand.json` rather than hardcoding hex values in new compositions.

## Key Patterns

- **Claude model:** Default to `claude-sonnet-4-6` for any new AI feature unless the task requires extended reasoning.
- **Buffer integration:** `app/social.js` and `gateway-proxy/api/buffer.js` handle multi-profile social posting. Agent profiles are in `data/agents.json`.
- **Valuation tools:** `app/valuation.js`, `app/home-valuation.js`, and `app/multifamily.js` each handle different property types — keep them separate.
- **No framework:** Avoid introducing React, Vue, or any bundled framework. Keep modules as plain ES modules or IIFE scripts compatible with direct `<script>` tags.

---

## Production Infrastructure

### Architecture Overview

```
Browser (Agents)
    │
    ├── Static SPA ──────────► GitHub Pages (Fastly CDN)
    │                          Auto-deploys on push to any branch
    │
    ├── API calls ───────────► Vercel Serverless (gateway-proxy/)
    │   Claude, Buffer              Rate-limited, secret-validated
    │   Max 20 req/min/IP           ALLOWED_ORIGIN enforced
    │
    ├── Auth / Secrets ──────► Supabase
    │   Login, team_secrets          RLS-protected tables
    │   video_jobs, error_logs       Realtime subscriptions
    │
    └── Video Render ────────► GitHub Actions
        Upload → Dispatch            Puppeteer + HyperFrames + FFmpeg
        Realtime status via          45 min timeout, auto-retry on fail
        Supabase postgres_changes    Renders committed to renders/
```

> **Why not Docker/Kubernetes?**
> This is a JAMstack/serverless architecture — GitHub Pages replaces Nginx/CDN pods, Vercel replaces ECS/Lambda, GitHub Actions replaces a job queue + worker fleet. Adding K8s would introduce operational complexity with no benefit at the current scale. If render throughput exceeds GitHub Actions' free tier limits, the equivalent migration path is: render worker → containerized Puppeteer on Cloud Run or ECS Fargate, triggered by a Supabase queue.

---

### CI/CD Pipeline

Two GitHub Actions workflows run automatically:

**`.github/workflows/ci.yml`** — runs on every push and PR:
1. JS syntax check (`node --check`) on all `app/*.js` and `gateway-proxy/api/*.js`
2. Secret scanning — rejects commits with hardcoded API keys, PATs, or service role keys
3. HTML structure check — verifies all required DOM IDs are present
4. Proxy handler validation — confirms all API handlers export a function

**`.github/workflows/render-listing-video.yml`** — triggered by the Video Generator:
- Concurrency group prevents duplicate renders of the same slug
- Auto-retry (2 attempts) on transient Puppeteer/Chrome failures
- Cleanup step on failure removes orphaned pending composition files
- Reports `completed`/`failed` status to Supabase `video_jobs` table

**`.github/workflows/health-monitor.yml`** — runs every 6 hours:
- Pings GitHub Pages, Vercel health endpoint, and Supabase
- Writes snapshot to `system_health` table (create in Supabase if monitoring)
- Opens a GitHub issue tagged `health-alert` on degradation (de-duplicated)

---

### Required Secrets

**GitHub repo secrets** (Settings → Secrets → Actions):

| Secret | Used by | Description |
|---|---|---|
| `SUPABASE_URL` | render workflow, health monitor | Supabase project REST URL |
| `SUPABASE_SERVICE_ROLE_KEY` | render workflow, health monitor | Service role key for server-side writes |
| `VERCEL_HEALTH_URL` | health monitor | Base URL of the Vercel deployment |

**Vercel environment variables** (Vercel dashboard → Settings → Environment):

| Variable | Description |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key |
| `BUFFER_ACCESS_TOKEN` | Buffer API token |
| `GATEWAY_SECRET` | Shared secret for proxy auth (32+ char random hex) |
| `ALLOWED_ORIGIN` | `https://gatewayhq.github.io` |
| `NODE_ENV` | `production` |

**Supabase tables** (run in SQL editor — idempotent):
```sql
-- Error tracking (populated by app/core.js window.onerror)
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
CREATE POLICY "Users see own errors" ON error_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own errors" ON error_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Health monitoring (populated by health-monitor workflow)
CREATE TABLE IF NOT EXISTS system_health (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at  timestamptz NOT NULL,
  pages_ok    boolean,
  vercel_ok   boolean,
  supabase_ok boolean,
  pages_status text,
  vercel_status text,
  run_id      text,
  created_at  timestamptz DEFAULT now()
);
```

---

### Monitoring Strategy

| Layer | Signal | Where |
|---|---|---|
| **Availability** | HTTP 200 on Pages + Vercel | Health monitor workflow (every 6h) |
| **Proxy errors** | Non-2xx responses, rate limits | Vercel function logs (dashboard) |
| **Client errors** | `window.onerror` + unhandledrejection | Supabase `error_logs` table |
| **Video renders** | Job status, elapsed time, error messages | Supabase `video_jobs` table |
| **Render failures** | Workflow conclusion = failure | GitHub Actions email + GitHub issue |
| **Cost anomalies** | Unexpected Claude API spend | Anthropic console usage alerts |

**Viewing errors in production:**
```sql
-- Recent client errors (last 24h)
SELECT message, source, line_no, url, created_at
FROM error_logs
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- Video render success rate (last 7 days)
SELECT
  DATE(created_at) AS day,
  COUNT(*) FILTER (WHERE status = 'completed') AS succeeded,
  COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
  AVG(elapsed_sec) FILTER (WHERE status = 'completed') AS avg_sec
FROM video_jobs
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

---

### Production Deployment Checklist

**Before any release:**
- [ ] CI passes on PR (JS syntax, secret scan, HTML structure, proxy handlers)
- [ ] No `config.js`, `.env`, or credential files committed
- [ ] `ALLOWED_ORIGIN` in Vercel matches the live GitHub Pages URL exactly
- [ ] `GATEWAY_SECRET` set in both Vercel env and GitHub secrets (must match)
- [ ] Vercel preview URL tested before deploying to production

**After a Vercel proxy deploy:**
- [ ] Hit `GET /api/health` with `x-gateway-secret` header — confirm `ok: true`
- [ ] Confirm `services.claude.configured: true` and `services.claude.reachable: true`
- [ ] Send a test Claude request from the app — confirm AI status badge turns green

**After a render workflow change:**
- [ ] Trigger a manual render from the Actions tab with a test composition
- [ ] Confirm Supabase `video_jobs` row transitions queued → rendering → completed
- [ ] Confirm the MP4 appears in `renders/` within expected time window
- [ ] Confirm `compositions/pending/` test file is cleaned up after render

**Monthly:**
- [ ] Rotate `GATEWAY_SECRET` in Vercel + GitHub secrets (update together atomically)
- [ ] Review Supabase `error_logs` for recurring client-side errors
- [ ] Review video render success rates — investigate any rate < 95%
- [ ] Verify Vercel function duration P95 < 20s for Claude calls
- [ ] Check GitHub Actions cache hit rate for HyperFrames + Chrome caches

**Music library maintenance:**
- [ ] Add royalty-free MP3 files to `music/` matching paths in `VID_MUSIC_LIBRARY` in `app/video.js`:
  - `music/01-luxury-calm.mp3`
  - `music/02-upbeat-energy.mp3`
  - `music/03-cinematic-drama.mp3`
  - `music/04-warm-acoustic.mp3`
  - `music/05-modern-beat.mp3`
- [ ] Keep tracks under 5 MB each (compressed, ~128kbps stereo is sufficient)
