// Gateway Agent Toolkit — Configuration
//
// SETUP:
//   1. Copy this file → rename to "config.js"
//   2. Fill in your values
//   3. NEVER commit config.js (it's in .gitignore)
//
// TEAM SETUP (recommended for offices with 2+ agents):
//   Deploy gateway-proxy/ to Vercel, then set proxyUrl + proxySecret below.
//   Agents don't need individual API keys — everything routes through the proxy.

const CONFIG = {

  // ── API Proxy (recommended for teams) ───────────────────────────
  // Deploy gateway-proxy/ to Vercel, then paste the URL here.
  // When set, Claude and Buffer calls route through the proxy — no
  // per-agent API keys needed.
  proxyUrl:    '',   // e.g. 'https://gateway-api-proxy.vercel.app'
  proxySecret: '',   // Must match GATEWAY_SECRET in your Vercel env vars

  // ── Claude API (only needed without proxy) ───────────────────────
  // Get from https://console.anthropic.com/api-keys
  // When proxyUrl is set above, this is ignored.
  claudeApiKey: '',

  // ── Buffer API (only needed without proxy) ───────────────────────
  // Get from https://buffer.com/developers/apps
  // When proxyUrl is set above, this is ignored.
  bufferAccessToken: '',

  // ── Cloud Sync (cross-device) ────────────────────────────────────
  // Enables agents to log in and access their saved templates, OMs,
  // invoices, API keys, and agent profiles from any device.
  //
  // SETUP (one-time, ~5 minutes):
  //   1. Create a free project at https://supabase.com
  //   2. Run gateway-proxy/supabase/migration.sql in the SQL Editor
  //   3. Copy Project URL and anon key from Settings → API
  //   4. Paste both values below
  //   5. In Supabase Auth → Settings, disable email confirmation
  //      (or use "Invite User" to create agent accounts manually)
  //
  // Each agent then clicks ☁ Sync in the toolkit nav and logs in
  // with their work email — data syncs automatically after that.
  supabaseUrl:      '',  // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey:  '',  // e.g. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

  // ── Office Settings ──────────────────────────────────────────────
  // Admin password to unlock company info editing in the OM builder
  adminPassword: 'gateway2025',

  // Resend API key for email notifications (optional)
  resendApiKey: '',

  // Google Analytics (optional)
  googleAnalyticsId: '',

  // Office address shown in generated documents
  officeAddress: '700 Nebraska Street, Sioux City, IA'

};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
