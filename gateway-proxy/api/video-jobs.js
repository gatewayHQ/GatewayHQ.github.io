// ================================================================
// video-jobs — Vercel serverless endpoint
//
// Three operations on one route (method + query param dispatch):
//
//   POST   /api/video-jobs              Create job + trigger GitHub Actions
//   PATCH  /api/video-jobs?jobId=<uuid> Webhook from GitHub Actions
//   GET    /api/video-jobs?jobId=<uuid> Poll job status
//
// Required Vercel env vars:
//   GH_ACTIONS_PAT          GitHub PAT (repo + workflow scopes)
//   GH_REPO                 e.g. gatewayhq/gatewayhq.github.io
//   GH_BRANCH               default branch, e.g. main
//   RENDER_WEBHOOK_SECRET   random 32-char hex — same value in GitHub secrets
//   GATEWAY_SECRET          existing proxy secret (gates POST/GET from browser)
//   ALLOWED_ORIGIN          existing CORS origin
//
// Optional (enables DB job tracking + Supabase Realtime in browser):
//   SUPABASE_URL            https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service role key (never expose to browser)
//
// Required GitHub Actions secrets:
//   VIDEO_JOBS_WEBHOOK_URL  https://<your-vercel>.vercel.app/api/video-jobs
//   RENDER_WEBHOOK_SECRET   same value as above
// ================================================================

const ORIGIN         = process.env.ALLOWED_ORIGIN        || 'https://gatewayhq.github.io';
const GW_SECRET      = process.env.GATEWAY_SECRET        || '';
const WEBHOOK_SECRET = process.env.RENDER_WEBHOOK_SECRET || '';
const GH_PAT         = process.env.GH_ACTIONS_PAT        || '';
const GH_REPO        = process.env.GH_REPO               || 'gatewayhq/gatewayhq.github.io';
const GH_BRANCH      = process.env.GH_BRANCH             || 'main';
const SB_URL         = (process.env.SUPABASE_URL         || '').replace(/\/$/, '');
const SB_KEY         = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── Supabase REST helpers (no npm dependency needed) ─────────────

function sbHeaders() {
  return {
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function sbInsert(table, row) {
  if (!SB_URL || !SB_KEY) return null;
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
    body:    JSON.stringify(row),
  });
  if (!res.ok) { console.error('sbInsert error', res.status, await res.text()); return null; }
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpdate(table, id, patch) {
  if (!SB_URL || !SB_KEY) return;
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
    method:  'PATCH',
    headers: sbHeaders(),
    body:    JSON.stringify(patch),
  });
  if (!res.ok) console.error('sbUpdate error', res.status, await res.text());
}

async function sbSelect(table, id) {
  if (!SB_URL || !SB_KEY) return null;
  const fields = 'id,slug,status,platform,render_url,error_msg,elapsed_sec,run_id,created_at,updated_at';
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}&select=${fields}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function sbSignedUrl(bucket, path, expiresIn = 7200) {
  if (!SB_URL || !SB_KEY) return '';
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method:  'POST',
    headers: sbHeaders(),
    body:    JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.signedURL ? `${SB_URL}/storage/v1${data.signedURL}` : '';
}

// ── CORS ─────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gateway-secret, X-Webhook-Secret');
  res.setHeader('Cache-Control', 'no-store');
}

// ── POST — create job + trigger GitHub Actions ────────────────────
async function handleCreate(req, res) {
  const secret = req.headers['x-gateway-secret'] || '';
  if (GW_SECRET && secret !== GW_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { slug, platform, quality, composition_path, music_path, user_id, branch } = req.body || {};
  if (!slug)             return res.status(400).json({ error: 'slug is required' });
  if (!composition_path) return res.status(400).json({ error: 'composition_path is required' });
  if (!GH_PAT)           return res.status(500).json({ error: 'GH_ACTIONS_PAT not set on server' });

  // Create DB record (optional — works without Supabase configured)
  let jobId = null;
  if (SB_URL && SB_KEY) {
    const row = await sbInsert('video_jobs', {
      user_id:          user_id || '00000000-0000-0000-0000-000000000000',
      slug,
      status:           'queued',
      platform:         platform || 'landscape',
      composition_path,
    });
    jobId = row?.id || null;
  }

  // Generate short-lived signed URLs so Actions can download from Supabase Storage
  let compositionUrl = '';
  let musicUrl       = '';
  if (jobId) {
    compositionUrl = await sbSignedUrl('video-compositions', composition_path);
    if (music_path) musicUrl = await sbSignedUrl('video-compositions', music_path);
  }

  // Trigger GitHub Actions
  const targetBranch = branch || GH_BRANCH;
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/render-listing-video.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GH_PAT}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
      },
      body: JSON.stringify({
        ref: targetBranch,
        inputs: {
          job_id:          jobId  || '',
          output_slug:     slug,
          quality:         quality || 'high',
          composition_url: compositionUrl,
          music_url:       musicUrl,
          // legacy git-path fallback (used when Supabase Storage not configured)
          composition_path: compositionUrl ? '' : composition_path,
          music_path:       musicUrl       ? '' : (music_path || ''),
        },
      }),
    }
  );

  if (!dispatchRes.ok && dispatchRes.status !== 204) {
    const de = await dispatchRes.json().catch(() => ({}));
    const msg = `GitHub dispatch failed (${dispatchRes.status}): ${de?.message || 'unknown'}`;
    if (jobId) await sbUpdate('video_jobs', jobId, { status: 'failed', error_msg: msg });
    return res.status(502).json({ error: msg });
  }

  return res.status(200).json({ jobId, status: 'queued' });
}

// ── PATCH ?jobId=xxx — webhook from GitHub Actions ────────────────
async function handleWebhook(req, res) {
  const incoming = req.headers['x-webhook-secret'] || '';
  if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const jobId = req.query.jobId;
  if (!jobId) return res.status(400).json({ error: 'jobId query param required' });

  const { status, render_url, error_msg, run_id, elapsed_sec } = req.body || {};
  const VALID = new Set(['rendering', 'completed', 'failed']);
  if (!status || !VALID.has(status)) return res.status(400).json({ error: 'invalid status' });

  if (!SB_URL || !SB_KEY) return res.status(200).json({ ok: true, note: 'Supabase not configured' });

  const patch = { status };
  if (render_url  != null) patch.render_url  = render_url;
  if (error_msg   != null) patch.error_msg   = error_msg;
  if (run_id      != null) patch.run_id      = run_id;
  if (elapsed_sec != null) patch.elapsed_sec = elapsed_sec;

  await sbUpdate('video_jobs', jobId, patch);
  return res.status(200).json({ ok: true });
}

// ── GET ?jobId=xxx — poll job status ─────────────────────────────
async function handleGet(req, res) {
  const secret = req.headers['x-gateway-secret'] || '';
  if (GW_SECRET && secret !== GW_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const jobId = req.query.jobId;
  if (!jobId) return res.status(400).json({ error: 'jobId query param required' });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Supabase not configured on server' });

  const row = await sbSelect('video_jobs', jobId);
  if (!row) return res.status(404).json({ error: 'Job not found' });
  return res.status(200).json(row);
}

// ── Main handler ──────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'POST')    return handleCreate(req, res);
  if (req.method === 'PATCH')   return handleWebhook(req, res);
  if (req.method === 'GET')     return handleGet(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};
