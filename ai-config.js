// ================================================================
// Gateway AI Config — committed to repo, safe to do so because:
//   • proxyUrl + proxySecret route through YOUR Vercel proxy only
//   • The actual Claude API key lives in Vercel env vars, never here
//   • If this secret is ever compromised, rotate it in Vercel — done
//
// SETUP (one-time):
//   1. Deploy gateway-proxy/ to Vercel
//   2. In Vercel project settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...  (your Claude key)
//        GATEWAY_SECRET    = (any strong random string you choose)
//        BUFFER_ACCESS_TOKEN = (optional, for social scheduling)
//   3. Paste your Vercel deploy URL and your chosen secret below
//   4. Commit this file — all agents get AI automatically
//
// Without a proxy: leave proxyUrl empty and agents enter their own
// Claude API key via the ✦ AI button. Both modes work simultaneously.
// ================================================================
window.AI_CONFIG = {
  proxyUrl:    '',   // e.g. 'https://gateway-proxy.vercel.app'
  proxySecret: ''    // must match GATEWAY_SECRET in Vercel env vars
};
