// ================================================================
// Gateway API — Supabase Edge Function
// One function handles all proxy routes for the toolkit.
//
// Auth: Supabase infra-level JWT verification is DISABLED in the
// dashboard so the 403 gate (which has no CORS headers) never fires.
// Instead we verify the caller's Supabase session in code using the
// auto-injected SUPABASE_URL + SUPABASE_ANON_KEY — same security,
// no CORS breakage.
//
// Supabase secrets to set (dashboard → Edge Functions → Secrets):
//   CLAUDE_API_KEY        = sk-ant-...
//   BUFFER_ACCESS_TOKEN   = (optional, for social scheduling)
//
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.
//
// Dashboard toggle required (one-time):
//   Edge Functions → gateway-api → JWT Verification → OFF
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://gatewayhq.github.io';
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || '';
const BUFFER_TOKEN   = Deno.env.get('BUFFER_ACCESS_TOKEN') || '';

const ANTHROPIC_VER  = '2023-06-01';
const DEFAULT_MODEL  = 'claude-sonnet-4-6';
const DEFAULT_TOKENS = 2000;
const FETCH_TIMEOUT  = 45_000;

// ── CORS ─────────────────────────────────────────────────────────

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control':                'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Auth — verify caller has a valid Supabase session ────────────
// We do this in code (not via the infra toggle) so every response
// always includes CORS headers, even auth failures.

async function getUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;

  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } } }
  );

  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

// ── Route: /api/claude ───────────────────────────────────────────

async function handleClaude(req: Request): Promise<Response> {
  if (!CLAUDE_API_KEY) {
    return json({ error: 'Claude API key not configured. Set CLAUDE_API_KEY in Supabase secrets.' }, 500);
  }

  let body: { system?: string; user?: string; max_tokens?: number; model?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { system, user, max_tokens, model } = body;
  if (!user) return json({ error: 'Missing user prompt' }, 400);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         CLAUDE_API_KEY,
        'anthropic-version': ANTHROPIC_VER,
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      model      || DEFAULT_MODEL,
        max_tokens: max_tokens || DEFAULT_TOKENS,
        system:     system     || '',
        messages:   [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Claude request failed' }, 502);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();
  if (!response.ok) {
    return json({ error: data?.error?.message || `Claude API error ${response.status}` }, response.status);
  }
  return json(data);
}

// ── Route: /api/buffer-profiles ──────────────────────────────────

async function handleBufferProfiles(): Promise<Response> {
  if (!BUFFER_TOKEN) return json({ error: 'Buffer token not configured.' }, 500);

  let response: Response;
  try {
    response = await fetch('https://api.buffer.com/1/profiles.json', {
      headers: { Authorization: `Bearer ${BUFFER_TOKEN}` },
      signal:  AbortSignal.timeout(FETCH_TIMEOUT),
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Buffer request failed' }, 502);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();
  if (!Array.isArray(data)) return json({ error: data?.error || 'Unexpected Buffer response' }, 400);

  return json({
    // deno-lint-ignore no-explicit-any
    profiles: data.map((p: any) => ({
      id:      p.id,
      service: p.service,
      handle:  p.formatted_username || p.handle || p.id,
      avatar:  p.avatar || '',
    })),
  });
}

// ── Route: /api/buffer ───────────────────────────────────────────

async function handleBuffer(req: Request): Promise<Response> {
  if (!BUFFER_TOKEN) return json({ error: 'Buffer token not configured.' }, 500);

  let body: { profileIds?: string[]; text?: string; mediaUrl?: string | null; scheduledAt?: string | null };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { profileIds, text, mediaUrl, scheduledAt } = body;
  if (!profileIds?.length || !text) return json({ error: 'Missing profileIds or text' }, 400);

  type PostResult = { profileId: string; updateId?: string; error?: string };
  const settled: PostResult[] = await Promise.all(
    profileIds.map(async (profileId): Promise<PostResult> => {
      try {
        const params = new URLSearchParams({ text, 'profile_ids[]': profileId });
        if (mediaUrl)    params.append('media[link]', mediaUrl);
        if (scheduledAt) params.append('scheduled_at', scheduledAt);

        const r = await fetch('https://api.buffer.com/1/updates/create.json', {
          method:  'POST',
          headers: { Authorization: `Bearer ${BUFFER_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    params.toString(),
          signal:  AbortSignal.timeout(FETCH_TIMEOUT),
        });
        // deno-lint-ignore no-explicit-any
        const d: any = await r.json();
        if (!r.ok || d.error) return { profileId, error: d.error || `HTTP ${r.status}` };
        return { profileId, updateId: d.updates?.[0]?.id || d.id };
      } catch (err: unknown) {
        return { profileId, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    })
  );

  const results = settled.filter(r => !r.error).map(({ profileId, updateId }) => ({ profileId, updateId }));
  const errors  = settled.filter(r =>  r.error).map(({ profileId, error })  => ({ profileId, error: error! }));
  return json({ results, errors, success: errors.length === 0 });
}

// ── Route: /api/health ───────────────────────────────────────────

function handleHealth(): Response {
  return json({ ok: true, ts: new Date().toISOString(), claude: !!CLAUDE_API_KEY, buffer: !!BUFFER_TOKEN });
}

// ── Router ───────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Always handle preflight first — before auth — so CORS headers
  // are returned on OPTIONS even for unauthenticated callers.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Health check is public — lets the toolkit verify the function is live.
  const path = new URL(req.url).pathname;
  if (path.endsWith('/api/health')) return handleHealth();

  // All other routes require a valid Supabase session.
  const user = await getUser(req);
  if (!user) {
    return json({ error: 'Sign in via ☁ Sync to use shared AI, or click ✦ AI to add a personal key.' }, 401);
  }

  if (path.endsWith('/api/claude')          && req.method === 'POST') return handleClaude(req);
  if (path.endsWith('/api/buffer-profiles'))                           return handleBufferProfiles();
  if (path.endsWith('/api/buffer')          && req.method === 'POST') return handleBuffer(req);

  return json({ error: 'Not found' }, 404);
});
