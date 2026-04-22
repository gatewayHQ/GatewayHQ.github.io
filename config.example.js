// Gateway Agent Toolkit - API Configuration Template
//
// INSTRUCTIONS:
// 1. Copy this file and rename it to "config.js"
// 2. Replace all placeholder values with your actual API keys
// 3. NEVER commit config.js to GitHub (it's in .gitignore)

const CONFIG = {

  // Buffer API - https://buffer.com/developers/apps
  // Get your access token from the Buffer developer dashboard
  bufferAccessToken: 'YOUR_BUFFER_ACCESS_TOKEN_HERE',

  // Claude API - for AI features (optional)
  claudeApiKey: '',

  // Resend API - for email notifications (optional)
  resendApiKey: '',

  // Google Analytics (optional)
  googleAnalyticsId: '',

  // Gateway Office Address
  officeAddress: '700 Nebraska Street, Sioux City, IA'

};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
