// ================================================================
// Gateway AI Config
//
// HOW AI WORKS
//   The shared Claude API key lives in the Supabase database
//   (team_secrets table, RLS-protected). Agents log in via ☁ Sync
//   → key is fetched automatically → ✦ AI On → all features work.
//
//   No key is ever committed to this file or any code file.
//
// SETUP (run once in Supabase SQL Editor):
//   INSERT INTO team_secrets (key, value)
//   VALUES ('claude_api_key', 'sk-ant-...')
//   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
//
// FALLBACK
//   Agents without a Supabase login can still enter a personal
//   Claude API key via the ✦ AI button in the nav.
// ================================================================
window.AI_CONFIG = {
  proxyUrl: ''   // not needed — key is served from Supabase DB at login
};
