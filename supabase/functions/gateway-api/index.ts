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
//   CLAUDE_API_KEY           = sk-ant-...
//   BUFFER_ACCESS_TOKEN      = (optional, for social scheduling)
//   CENSUS_API_KEY           = 40-char Census Bureau key (bypasses 500/day anonymous throttle)
//   GOOGLE_MAPS_STATIC_KEY   = Google Cloud Maps Static API key (Location Overview map pin)
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
const CENSUS_KEY     = Deno.env.get('CENSUS_API_KEY') || '';
const GMAPS_KEY      = Deno.env.get('GOOGLE_MAPS_STATIC_KEY') || '';

const ANTHROPIC_VER  = '2023-06-01';
const DEFAULT_MODEL  = 'claude-sonnet-4-6';
const DEFAULT_TOKENS = 2000;
const FETCH_TIMEOUT  = 45_000;

// Hard caps — prevent runaway cost and abuse
const MAX_TOKENS_CAP  = 4000;
// 4 MB: text prompts are tiny, but vision requests carry one or more
// downscaled JPEG photos (base64) for auto-captioning. Output cost is still
// bounded by MAX_TOKENS_CAP and the per-user rate limit.
const MAX_BODY_BYTES  = 4_194_304; // 4 MB

// Allowlist — only these model IDs pass through to Anthropic
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-7',
]);

// ── In-memory rate limiter ────────────────────────────────────────
// Per-user-ID bucket: 30 req/min. Resets on cold start (acceptable
// for a small team tool; use Deno KV for persistent limits if needed).
const RATE_LIMIT_RPM = 30;
const RATE_WINDOW_MS = 60_000;
const _rateStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const rec = _rateStore.get(userId);
  if (!rec || (now - rec.windowStart) > RATE_WINDOW_MS) {
    _rateStore.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_RPM) return false;
  rec.count++;
  return true;
}

// ── CORS ─────────────────────────────────────────────────────────

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control':                'no-store',
  'X-Content-Type-Options':       'nosniff',
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

async function handleClaude(req: Request, userId: string): Promise<Response> {
  if (!CLAUDE_API_KEY) {
    return json({ error: 'Claude API key not configured. Set CLAUDE_API_KEY in Supabase secrets.' }, 503);
  }

  // Payload size guard
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Request payload too large' }, 413);
  }

  // Per-user rate limit
  if (!checkRateLimit(userId)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — try again in 60s' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  let body: {
    system?: string; user?: string; max_tokens?: number; model?: string;
    images?: Array<{ media_type?: string; data?: string }>;
  };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { system, user, max_tokens, model, images } = body;
  if (!user || typeof user !== 'string' || !user.trim()) {
    return json({ error: 'Missing or empty user prompt' }, 400);
  }

  // Build the message content. With images (vision, e.g. photo auto-captioning)
  // we send Anthropic content blocks: the photos followed by the text prompt.
  const ALLOWED_IMG = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  // deno-lint-ignore no-explicit-any
  let content: any = user.trim();
  if (Array.isArray(images) && images.length) {
    if (images.length > 10) return json({ error: 'Too many images (max 10)' }, 400);
    // deno-lint-ignore no-explicit-any
    const blocks: any[] = [];
    for (const im of images) {
      const mt = im?.media_type ?? '';
      if (!ALLOWED_IMG.has(mt) || typeof im?.data !== 'string' || !im.data) {
        return json({ error: 'Invalid image (allowed: jpeg, png, webp, gif)' }, 400);
      }
      blocks.push({ type: 'image', source: { type: 'base64', media_type: mt, data: im.data } });
    }
    blocks.push({ type: 'text', text: user.trim() });
    content = blocks;
  }

  // Token cap — caller can request less, never more than our ceiling
  const clampedTokens = Math.min(
    Number.isInteger(max_tokens) ? max_tokens! : DEFAULT_TOKENS,
    MAX_TOKENS_CAP
  );

  // Model allowlist — fall back to default if unknown model requested
  const resolvedModel = ALLOWED_MODELS.has(model ?? '') ? model! : DEFAULT_MODEL;

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
        model:      resolvedModel,
        max_tokens: clampedTokens,
        system:     system || '',
        messages:   [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Claude request failed' }, 502);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();
  if (!response.ok) {
    // Translate upstream errors to client-safe messages
    if (response.status === 401) return json({ error: 'AI service configuration error' }, 503);
    if (response.status === 429) return json({ error: 'AI rate limit — please wait a moment' }, 429);
    if (response.status === 529) return json({ error: 'AI service overloaded — try again shortly' }, 503);
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

// ── Route: /api/census ───────────────────────────────────────────
// Proxies U.S. Census Bureau ACS 5-Year queries with the server-side
// CENSUS_API_KEY appended.  Client never sees the key, and we're no longer
// throttled at 500/req/day per office IP.
//
//   GET /api/census?state=<FIPS>&year=<YYYY>&vars=<CSV>
//
// Response: raw Census ACS JSON (array of arrays).

const CENSUS_STATE_RE = /^\d{2}$/;
const CENSUS_YEAR_RE  = /^(20)\d{2}$/;
// Only alphanumeric, underscore, comma — matches the Census variable-code grammar.
const CENSUS_VARS_RE  = /^[A-Za-z0-9_,]{1,600}$/;

async function handleCensus(req: Request, userId: string): Promise<Response> {
  if (!checkRateLimit(userId)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — try again in 60s' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const u     = new URL(req.url);
  const state = u.searchParams.get('state') ?? '';
  const year  = u.searchParams.get('year')  ?? '2023';
  const vars  = u.searchParams.get('vars')  ?? 'NAME';

  if (!CENSUS_STATE_RE.test(state)) return json({ error: 'Invalid state FIPS (expected 2 digits)' }, 400);
  if (!CENSUS_YEAR_RE.test(year))   return json({ error: 'Invalid year' }, 400);
  if (!CENSUS_VARS_RE.test(vars))   return json({ error: 'Invalid vars (letters/digits/underscore/comma only)' }, 400);

  const upstream =
    'https://api.census.gov/data/' + year + '/acs/acs5' +
    '?get='  + vars +
    '&for=county:*' +
    '&in=state:' + state +
    (CENSUS_KEY ? '&key=' + encodeURIComponent(CENSUS_KEY) : '');

  let resp: Response;
  try {
    resp = await fetch(upstream, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Census request failed' }, 502);
  }

  if (!resp.ok) {
    const body = await resp.text();
    return json({
      error: 'Census upstream HTTP ' + resp.status,
      upstreamStatus: resp.status,
      upstreamBody:   body.slice(0, 400),
    }, resp.status);
  }

  // Pass through as JSON so the existing client parser keeps working.
  // deno-lint-ignore no-explicit-any
  const data: any = await resp.json();
  return json(data);
}

// ── Route: /api/staticmap ────────────────────────────────────────
// Proxies Google Maps Static API so the API key never touches the
// browser (and can't be scraped from an <img src>).  Streams the PNG
// bytes back — client fetches, converts to a base64 data URI, embeds
// it in the PPTX (or renders as an <img>).
//
//   GET /api/staticmap?address=<url-encoded>&zoom=<1-20>&size=<WxH>

const STATICMAP_SIZE_RE = /^\d{2,4}x\d{2,4}$/;

async function handleStaticMap(req: Request, userId: string): Promise<Response> {
  if (!GMAPS_KEY) {
    return json({ error: 'Google Maps key not configured. Set GOOGLE_MAPS_STATIC_KEY in Supabase secrets.' }, 503);
  }
  if (!checkRateLimit(userId)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — try again in 60s' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const u       = new URL(req.url);
  const address = (u.searchParams.get('address') ?? '').trim();
  const zoomRaw = parseInt(u.searchParams.get('zoom') ?? '15', 10);
  const size    = u.searchParams.get('size') ?? '640x520';

  if (!address || address.length > 500)  return json({ error: 'Missing or too-long address' }, 400);
  if (!STATICMAP_SIZE_RE.test(size))     return json({ error: 'Invalid size (WxH)' }, 400);
  const zoom = Math.min(20, Math.max(1, Number.isFinite(zoomRaw) ? zoomRaw : 15));

  const q = encodeURIComponent(address);
  // Gold pin (#C9A84C) matches the OM brand palette exactly.
  const upstream =
    'https://maps.googleapis.com/maps/api/staticmap' +
    '?center=' + q +
    '&zoom='   + zoom +
    '&size='   + size +
    '&scale=2' +
    '&maptype=roadmap' +
    '&markers=color:0xC9A84C%7Clabel:P%7C' + q +
    '&key='    + encodeURIComponent(GMAPS_KEY);

  let resp: Response;
  try {
    resp = await fetch(upstream, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : 'Static map request failed' }, 502);
  }

  if (!resp.ok) {
    const body = await resp.text();
    return json({
      error:          'Google Maps upstream HTTP ' + resp.status,
      upstreamStatus: resp.status,
      upstreamBody:   body.slice(0, 400),
    }, resp.status);
  }

  const bytes = await resp.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type':  resp.headers.get('Content-Type') || 'image/png',
      // Short private cache lets a preview + PPTX-export within the same
      // session avoid a second Google call for the same address.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// ── Route: /api/health ───────────────────────────────────────────
// Public — no auth required. Used by health-monitor workflow and
// the app's AI status badge on startup.

function handleHealth(): Response {
  return json({
    ok:        true,
    version:   '2.3.0',          // 2.3.0 = adds /api/census and /api/staticmap
    vision:    true,
    ts:        new Date().toISOString(),
    services: {
      claude:    !!CLAUDE_API_KEY,
      buffer:    !!BUFFER_TOKEN,
      census:    !!CENSUS_KEY,
      staticmap: !!GMAPS_KEY,
    },
  });
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

  if (path.endsWith('/api/claude')          && req.method === 'POST') return handleClaude(req, user.id);
  if (path.endsWith('/api/buffer-profiles'))                           return handleBufferProfiles();
  if (path.endsWith('/api/buffer')          && req.method === 'POST') return handleBuffer(req);
  if (path.endsWith('/api/census')          && req.method === 'GET')  return handleCensus(req, user.id);
  if (path.endsWith('/api/staticmap')       && req.method === 'GET')  return handleStaticMap(req, user.id);

  return json({ error: 'Not found' }, 404);
});
