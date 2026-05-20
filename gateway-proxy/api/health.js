// Health check endpoint — called by the health-monitor workflow every 6h
// and by the app's AI status badge on startup.
// Returns: service availability, version, environment, response time.

const VERSION = '2.0.0';
const START_TIME = Date.now();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://gatewayhq.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gateway-secret');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health endpoint is auth-optional — light auth to prevent public exposure
  // of service capability info. Unauthenticated gets a minimal response.
  const secret = req.headers['x-gateway-secret'];
  const isAuthed = !process.env.GATEWAY_SECRET || secret === process.env.GATEWAY_SECRET;

  if (!isAuthed) {
    // Minimal response for unauthenticated callers — confirms the proxy is alive
    return res.status(200).json({ ok: true, version: VERSION });
  }

  const uptimeSec = Math.round((Date.now() - START_TIME) / 1000);

  // ── Probe Claude API reachability (lightweight — no tokens consumed) ──
  let claudeReachable = null;
  let claudeLatencyMs = null;
  if (process.env.CLAUDE_API_KEY) {
    const t0 = Date.now();
    try {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key':         process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        signal: AbortSignal.timeout(5000)
      });
      claudeReachable = r.ok || r.status === 404; // 404 = endpoint exists, key valid
      claudeLatencyMs = Date.now() - t0;
    } catch {
      claudeReachable = false;
      claudeLatencyMs = null;
    }
  }

  res.status(200).json({
    ok:       true,
    version:  VERSION,
    env:      process.env.NODE_ENV || 'development',
    uptimeSec,
    timestamp: new Date().toISOString(),
    services: {
      claude: {
        configured: !!process.env.CLAUDE_API_KEY,
        reachable:  claudeReachable,
        latencyMs:  claudeLatencyMs
      },
      buffer: {
        configured: !!process.env.BUFFER_ACCESS_TOKEN
      }
    }
  });
};
