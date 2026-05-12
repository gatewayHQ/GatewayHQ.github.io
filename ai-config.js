// ================================================================
// Gateway AI Config — committed to repo, safe to do so because:
//   • The actual Claude API key lives in Supabase secrets, never here
//   • Access is controlled by Supabase user accounts — only agents
//     with a Supabase login can use the shared Claude key
//   • Revoking an agent's access: delete their account in Supabase
//
// HOW IT WORKS
//   Agents log in via the ☁ Sync button → they get a Supabase JWT →
//   that JWT authorises Claude API calls through the Edge Function.
//   Not logged in → falls back to a personal Claude key via ✦ AI.
//
// SETUP (one-time):
//   1. Deploy the Edge Function:
//        supabase functions deploy gateway-api
//   2. Add the Claude API key as a Supabase secret:
//        supabase secrets set CLAUDE_API_KEY=sk-ant-...
//   3. Create a Supabase user account for each agent:
//        Supabase dashboard → Authentication → Users → Add user
//   4. Commit this file — done. No secrets here.
//
// Edge Function: supabase/functions/gateway-api/index.ts
// ================================================================
window.AI_CONFIG = {
  proxyUrl: 'https://jrtaxhfglcymipncwmvu.supabase.co/functions/v1/gateway-api'
};
