// Claude API proxy — all external Claude calls route through here.
// Security layers: secret header, origin allowlist, input validation, token cap.
// Rate limiting: in-memory per-IP bucket (resets on cold start; sufficient for
// a small team tool). For high-traffic use, replace with Vercel KV or Upstash.

const MAX_TOKENS_CAP  = 4000;   // hard ceiling — prevents runaway costs
const MAX_BODY_BYTES  = 32_768; // 32 KB payload limit
const RATE_LIMIT_RPM  = 20;     // requests per minute per IP
const RATE_WINDOW_MS  = 60_000;

// In-memory rate store: Map<ip, { count, windowStart }>
// Cleared on cold start; not shared across Vercel instances (acceptable for small team)
const _rateStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = _rateStore.get(ip);
  if (!rec || (now - rec.windowStart) > RATE_WINDOW_MS) {
    _rateStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_RPM) return false;
  rec.count++;
  return true;
}

// Evict stale entries to prevent unbounded memory growth
setInterval(function evict() {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [ip, rec] of _rateStore) {
    if (rec.windowStart < cutoff) _rateStore.delete(ip);
  }
}, RATE_WINDOW_MS);

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://gatewayhq.github.io';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gateway-secret');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Origin validation ────────────────────────────────────────────
  const origin = req.headers['origin'] || '';
  if (origin && origin !== allowedOrigin && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // ── Secret header auth ───────────────────────────────────────────
  const secret = req.headers['x-gateway-secret'];
  if (process.env.GATEWAY_SECRET && secret !== process.env.GATEWAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Payload size guard ───────────────────────────────────────────
  const bodyStr = JSON.stringify(req.body || {});
  if (bodyStr.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request payload too large' });
  }

  // ── Per-IP rate limiting ─────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (!checkRateLimit(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate limit exceeded — try again in 60s' });
  }

  // ── Input validation ─────────────────────────────────────────────
  const { system, user, max_tokens, model } = req.body || {};
  if (!user || typeof user !== 'string' || !user.trim()) {
    return res.status(400).json({ error: 'Missing or empty user prompt' });
  }
  if (system !== undefined && typeof system !== 'string') {
    return res.status(400).json({ error: 'system must be a string' });
  }

  // ── API key check ────────────────────────────────────────────────
  if (!process.env.CLAUDE_API_KEY) {
    console.error('[claude] CLAUDE_API_KEY not set');
    return res.status(503).json({ error: 'AI service not configured' });
  }

  // ── Token cap — caller can request less, never more ──────────────
  const clampedTokens = Math.min(
    Number.isInteger(max_tokens) ? max_tokens : 1000,
    MAX_TOKENS_CAP
  );

  // ── Allowlist of models the proxy will pass through ──────────────
  const ALLOWED_MODELS = new Set([
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-7',
  ]);
  const resolvedModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-6';

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json'
      },
      body: JSON.stringify({
        model:      resolvedModel,
        max_tokens: clampedTokens,
        system:     system || '',
        messages:   [{ role: 'user', content: user.trim() }]
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const errMsg = data.error?.message || `Claude API error ${upstream.status}`;
      console.error(`[claude] upstream ${upstream.status}: ${errMsg}`);
      // Translate anthropic errors to cleaner messages for the client
      if (upstream.status === 401) return res.status(503).json({ error: 'AI service configuration error' });
      if (upstream.status === 429) return res.status(429).json({ error: 'AI rate limit — please wait a moment' });
      if (upstream.status === 529) return res.status(503).json({ error: 'AI service overloaded — try again shortly' });
      return res.status(upstream.status).json({ error: errMsg });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('[claude] fetch error:', err.message);
    res.status(502).json({ error: 'Failed to reach AI service' });
  }
};
