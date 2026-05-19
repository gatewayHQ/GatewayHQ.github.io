// ================================================================
// video-jobs — Supabase Edge Function
//
// Manages async video render jobs. Three routes:
//
//   POST   /video-jobs              Create job + trigger GitHub Actions
//   PATCH  /video-jobs/:jobId       Webhook from GitHub Actions (secret auth)
//   GET    /video-jobs/:jobId       Poll job status (auth required)
//
// Required edge function secrets (Dashboard → Edge Functions → Secrets):
//   GH_ACTIONS_PAT        GitHub PAT with repo + actions:write
//   GH_REPO               e.g. gatewayhq/gatewayhq.github.io
//   GH_BRANCH             default branch, e.g. main
//   RENDER_WEBHOOK_SECRET  random 32-char hex, same value in GH secrets
//   ALLOWED_ORIGIN         https://gatewayhq.github.io
//
// Required GitHub Actions secrets (repo Settings → Secrets):
//   SUPABASE_VIDEO_JOBS_URL  https://<ref>.supabase.co/functions/v1/video-jobs
//   RENDER_WEBHOOK_SECRET    same value as above
// ================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GH_ACTIONS_PAT        = Deno.env.get('GH_ACTIONS_PAT')        || '';
const GH_REPO               = Deno.env.get('GH_REPO')               || 'gatewayhq/gatewayhq.github.io';
const GH_BRANCH             = Deno.env.get('GH_BRANCH')             || 'main';
const RENDER_WEBHOOK_SECRET = Deno.env.get('RENDER_WEBHOOK_SECRET') || '';
const ALLOWED_ORIGIN        = Deno.env.get('ALLOWED_ORIGIN')        || 'https://gatewayhq.github.io';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')          || '';
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')    || '';
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Verify caller is a logged-in Supabase user
async function getUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

// Service-role client for server-side DB + Storage operations
function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── POST / — create render job ────────────────────────────────────
//
// Body (JSON):
//   slug             string  output filename (no extension)
//   platform         string  reels | feed | landscape | shorts | story
//   composition_path string  storage path: {userId}/{slug}.html
//   music_path       string? storage path: {userId}/{slug}-music.{ext}
//   branch           string? git branch override (default: GH_BRANCH)
// ─────────────────────────────────────────────────────────────────
async function handleCreate(req: Request): Promise<Response> {
  const user = await getUser(req);
  if (!user) return json({ error: 'Sign in via ☁ Sync to generate videos.' }, 401);

  let body: {
    slug?: string;
    platform?: string;
    composition_path?: string;
    music_path?: string;
    branch?: string;
  };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { slug, platform, composition_path, music_path, branch } = body;
  if (!slug)             return json({ error: 'slug is required' }, 400);
  if (!composition_path) return json({ error: 'composition_path is required' }, 400);

  const db = serviceClient();

  // Create the job record first so we have a jobId to pass to Actions
  const { data: job, error: insertErr } = await db
    .from('video_jobs')
    .insert({
      user_id:          user.id,
      slug,
      status:           'queued',
      platform:         platform || 'landscape',
      composition_path,
    })
    .select('id')
    .single();

  if (insertErr || !job) {
    return json({ error: 'Failed to create job: ' + (insertErr?.message || 'unknown') }, 500);
  }

  const jobId = job.id as string;

  // Generate signed URLs (2 hours — well beyond the 45-min Actions timeout)
  const EXPIRES = 7200;
  const { data: compSign, error: compSignErr } = await db.storage
    .from('video-compositions')
    .createSignedUrl(composition_path, EXPIRES);

  if (compSignErr || !compSign?.signedUrl) {
    await db.from('video_jobs').update({ status: 'failed', error_msg: 'Could not sign composition URL' }).eq('id', jobId);
    return json({ error: 'Could not sign composition URL: ' + (compSignErr?.message || 'unknown') }, 500);
  }

  let musicSignedUrl = '';
  if (music_path) {
    const { data: musicSign } = await db.storage.from('video-compositions').createSignedUrl(music_path, EXPIRES);
    musicSignedUrl = musicSign?.signedUrl || '';
  }

  // Trigger GitHub Actions workflow
  const targetBranch = branch || GH_BRANCH;
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/render-listing-video.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GH_ACTIONS_PAT}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json',
      },
      body: JSON.stringify({
        ref: targetBranch,
        inputs: {
          job_id:          jobId,
          output_slug:     slug,
          composition_url: compSign.signedUrl,
          music_url:       musicSignedUrl,
        },
      }),
    }
  );

  if (!dispatchRes.ok && dispatchRes.status !== 204) {
    // deno-lint-ignore no-explicit-any
    const de: any = await dispatchRes.json().catch(() => ({}));
    const errMsg = `GitHub Actions dispatch failed (${dispatchRes.status}): ${de?.message || 'unknown'}`;
    await db.from('video_jobs').update({ status: 'failed', error_msg: errMsg }).eq('id', jobId);
    return json({ error: errMsg }, 502);
  }

  return json({ jobId, status: 'queued' });
}

// ── PATCH /:jobId — webhook from GitHub Actions ───────────────────
//
// Header: X-Webhook-Secret: <RENDER_WEBHOOK_SECRET>
// Body (JSON):
//   status      string  rendering | completed | failed
//   render_url  string? raw.githubusercontent.com download URL
//   error_msg   string? human-readable failure reason
//   run_id      string? GitHub Actions run ID
//   elapsed_sec number? seconds from workflow start to completion
// ─────────────────────────────────────────────────────────────────
async function handleWebhook(req: Request, jobId: string): Promise<Response> {
  if (!RENDER_WEBHOOK_SECRET) return json({ error: 'Webhook secret not configured' }, 500);

  const incoming = req.headers.get('X-Webhook-Secret') ?? '';
  // Constant-time comparison to prevent timing attacks
  if (incoming.length !== RENDER_WEBHOOK_SECRET.length) return json({ error: 'Unauthorized' }, 401);
  let mismatch = 0;
  for (let i = 0; i < incoming.length; i++) {
    mismatch |= incoming.charCodeAt(i) ^ RENDER_WEBHOOK_SECRET.charCodeAt(i);
  }
  if (mismatch !== 0) return json({ error: 'Unauthorized' }, 401);

  let body: {
    status?: string;
    render_url?: string;
    error_msg?: string;
    run_id?: string;
    elapsed_sec?: number;
  };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const VALID_STATUSES = new Set(['rendering', 'completed', 'failed']);
  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return json({ error: 'status must be rendering | completed | failed' }, 400);
  }

  const db = serviceClient();
  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = { status: body.status };
  if (body.render_url  !== undefined) update.render_url  = body.render_url;
  if (body.error_msg   !== undefined) update.error_msg   = body.error_msg;
  if (body.run_id      !== undefined) update.run_id      = body.run_id;
  if (body.elapsed_sec !== undefined) update.elapsed_sec = body.elapsed_sec;

  const { error } = await db.from('video_jobs').update(update).eq('id', jobId);
  if (error) return json({ error: 'DB update failed: ' + error.message }, 500);

  return json({ ok: true });
}

// ── GET /:jobId — poll job status ─────────────────────────────────
async function handleGet(req: Request, jobId: string): Promise<Response> {
  const user = await getUser(req);
  if (!user) return json({ error: 'Authentication required' }, 401);

  const db = serviceClient();
  const { data, error } = await db
    .from('video_jobs')
    .select('id, slug, status, platform, render_url, error_msg, elapsed_sec, run_id, created_at, updated_at')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return json({ error: 'Job not found' }, 404);
  return json(data);
}

// ── Router ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const lastSeg  = segments[segments.length - 1] ?? '';
  const jobId    = UUID_RE.test(lastSeg) ? lastSeg : null;

  if (!jobId && req.method === 'POST')  return handleCreate(req);
  if ( jobId && req.method === 'PATCH') return handleWebhook(req, jobId);
  if ( jobId && req.method === 'GET')   return handleGet(req, jobId);

  return json({ error: 'Not found' }, 404);
});
