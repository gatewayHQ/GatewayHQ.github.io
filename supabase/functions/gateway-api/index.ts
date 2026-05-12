// ================================================================
// Gateway API — Supabase Edge Function
// Replaces the Vercel proxy. One function handles all routes.
//
// Supabase secrets required:
//   CLAUDE_API_KEY        = sk-ant-...
//   GATEWAY_SECRET        = <match the value in ai-config.js>
//   BUFFER_ACCESS_TOKEN   = <optional, for social scheduling>
//   ALLOWED_ORIGIN        = <optional, defaults to gatewayhq.github.io>
//
// Deploy:
//   supabase functions deploy gateway-api
//
// Set secrets:
//   supabase secrets set CLAUDE_API_KEY=sk-ant-...
//   supabase secrets set GATEWAY_SECRET=<your-random-string>
//   supabase secrets set BUFFER_ACCESS_TOKEN=...   (optional)
// ================================================================

const ALLOWED_ORIGIN  = Deno.env.get('ALLOWED_ORIGIN')  || 'https://gatewayhq.github.io';
const CLAUDE_API_KEY  = Deno.env.get('CLAUDE_API_KEY')  || '';
const BUFFER_TOKEN    = Deno.env.get('BUFFER_ACCESS_TOKEN') || '';
// Auth is handled by Supabase JWT verification (enabled in function settings).
// Only agents with a Supabase account can reach this function — no shared
// secret needed in code.

const ANTHROPIC_VER   = '2023-06-01';
const DEFAULT_MODEL   = 'claude-sonnet-4-6';
const DEFAULT_TOKENS  = 2000;
const FETCH_TIMEOUT   = 45_000; // ms — matches browser-side AbortController

// ── Response helpers ─────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control':                'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── Route: /api/claude ───────────────────────────────────────────

async function handleClaude(req: Request): Promise<Response> {
  if (!CLAUDE_API_KEY) {
    return json({ error: 'Claude API key not configured. Set CLAUDE_API_KEY in Supabase secrets.' }, 500);
  }

  let body: { system?: string; user?: string; max_tokens?: number; model?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

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
    const msg = err instanceof Error ? err.message : 'Claude request failed';
    return json({ error: msg }, 502);
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
  if (!BUFFER_TOKEN) {
    return json({ error: 'Buffer token not configured. Set BUFFER_ACCESS_TOKEN in Supabase secrets.' }, 500);
  }

  let response: Response;
  try {
    response = await fetch('https://api.buffer.com/1/profiles.json', {
      headers: { Authorization: `Bearer ${BUFFER_TOKEN}` },
      signal:  AbortSignal.timeout(FETCH_TIMEOUT),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Buffer request failed';
    return json({ error: msg }, 502);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();
  if (!Array.isArray(data)) {
    return json({ error: data?.error || 'Unexpected Buffer response' }, 400);
  }

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
  if (!BUFFER_TOKEN) {
    return json({ error: 'Buffer token not configured. Set BUFFER_ACCESS_TOKEN in Supabase secrets.' }, 500);
  }

  let body: { profileIds?: string[]; text?: string; mediaUrl?: string | null; scheduledAt?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { profileIds, text, mediaUrl, scheduledAt } = body;
  if (!profileIds?.length || !text) {
    return json({ error: 'Missing profileIds or text' }, 400);
  }

  // Fan out to all profiles in parallel — faster than sequential for-loop
  type PostResult = { profileId: string; updateId?: string; error?: string };
  const settled: PostResult[] = await Promise.all(
    profileIds.map(async (profileId): Promise<PostResult> => {
      try {
        const params = new URLSearchParams({ text, 'profile_ids[]': profileId });
        if (mediaUrl)    params.append('media[link]', mediaUrl);
        if (scheduledAt) params.append('scheduled_at', scheduledAt);

        const r = await fetch('https://api.buffer.com/1/updates/create.json', {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${BUFFER_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body:   params.toString(),
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
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

  const results = settled.filter((r) => !r.error).map(({ profileId, updateId }) => ({ profileId, updateId }));
  const errors  = settled.filter((r) =>  r.error).map(({ profileId, error })  => ({ profileId, error: error! }));
  return json({ results, errors, success: errors.length === 0 });
}

// ── Route: /api/health ───────────────────────────────────────────

function handleHealth(): Response {
  return json({
    ok:     true,
    ts:     new Date().toISOString(),
    claude: !!CLAUDE_API_KEY,
    buffer: !!BUFFER_TOKEN,
    mode:   'supabase-edge',
  });
}

// ── Main router ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const path = new URL(req.url).pathname;

  if (path.endsWith('/api/claude') && req.method === 'POST') {
    return handleClaude(req);
  }
  if (path.endsWith('/api/buffer-profiles')) {
    return handleBufferProfiles();
  }
  if (path.endsWith('/api/buffer') && req.method === 'POST') {
    return handleBuffer(req);
  }
  if (path.endsWith('/api/health')) {
    return handleHealth();
  }

  return json({ error: 'Not found' }, 404);
});
