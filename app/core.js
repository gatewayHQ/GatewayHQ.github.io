// ===================================================================
// GATEWAY AGENT TOOLKIT - Application Code
// ===================================================================

// ==== LOGOS ====

// LOGO_CIRCLE_LIGHT: uses embedded round submark (dark on light) for light backgrounds;
// dark backgrounds fall back to the Cloudinary white circle
var LOGO_CIRCLE_LIGHT = LOGO_ROUND_SUBMARK;

// ==== BRAND COLORS ====
var BRAND = {
  navy: '#1E2F39',
  navyDark: '#152229',
  blue: '#A2B6C0',
  cream: '#E4E3D4',
  gray: '#969694',
  white: '#FFFFFF',
  black: '#282828'
};

// ==== CONFIG SYNC ====
// Auto-wire API keys from config.js into localStorage on every page load.
// Set claudeApiKey in config.js once — AI features work everywhere automatically.
(function() {
  var cfg = window.CONFIG || {};
  if (cfg.claudeApiKey && cfg.claudeApiKey.trim()) {
    localStorage.setItem('gw_claude_api_key', cfg.claudeApiKey.trim());
  }
  if (cfg.bufferAccessToken && cfg.bufferAccessToken.trim() && cfg.bufferAccessToken !== 'YOUR_BUFFER_ACCESS_TOKEN_HERE') {
    localStorage.setItem('gw_buffer_token', cfg.bufferAccessToken.trim());
  }
  if (cfg.adminPassword && cfg.adminPassword.trim()) {
    localStorage.setItem('gw_admin_pass', cfg.adminPassword.trim());
  }
})();

// ==== AI STATUS INDICATOR ====
// Shows a subtle badge in the nav when Claude is or isn't configured.
function getClaudeKeyGlobal() {
  return (localStorage.getItem('gw_claude_api_key') || '').trim();
}

function renderAIStatusBadge() {
  var badge = document.getElementById('ai-status-badge');
  if (!badge) return;
  var key = getClaudeKeyGlobal();
  var proxyActive = !!(window.GatewayAPI && window.GatewayAPI.claudeAvailable && window.GatewayAPI.claudeAvailable());
  if (key || proxyActive) {
    badge.title = 'AI Connected — Claude API key is active';
    badge.style.background = 'rgba(76,175,80,0.15)';
    badge.style.color = '#4CAF50';
    badge.style.borderColor = 'rgba(76,175,80,0.3)';
    badge.textContent = '✦ AI On';
  } else {
    badge.title = 'AI Not Configured — click to set up Claude API key';
    badge.style.background = 'rgba(255,193,7,0.12)';
    badge.style.color = '#FFC107';
    badge.style.borderColor = 'rgba(255,193,7,0.25)';
    badge.textContent = '✦ AI Setup';
  }
}

window.openAISetup = function() {
  var existing = getClaudeKeyGlobal();
  var modal = document.getElementById('ai-setup-modal');
  if (!modal) return;
  var inp = document.getElementById('ai-key-input');
  if (inp) inp.value = existing ? '•'.repeat(20) + existing.slice(-6) : '';
  modal.style.display = 'flex';
  setTimeout(function() { if (inp) inp.focus(); }, 100);
};

window.closeAISetup = function() {
  var modal = document.getElementById('ai-setup-modal');
  if (modal) modal.style.display = 'none';
};

window.saveAIKey = function() {
  var inp = document.getElementById('ai-key-input');
  if (!inp) return;
  var val = inp.value.trim();
  if (!val || val.startsWith('•')) { closeAISetup(); return; }
  if (!val.startsWith('sk-ant-')) {
    showGlobalStatus('⚠️ That doesn\'t look like a valid Claude API key (should start with sk-ant-)');
    return;
  }
  localStorage.setItem('gw_claude_api_key', val);
  closeAISetup();
  renderAIStatusBadge();
  showGlobalStatus('✓ Claude API key saved — AI features are now active');
};

window.clearAIKey = function() {
  if (!confirm('Remove the Claude API key? AI features will stop working.')) return;
  localStorage.removeItem('gw_claude_api_key');
  var inp = document.getElementById('ai-key-input');
  if (inp) inp.value = '';
  closeAISetup();
  renderAIStatusBadge();
  showGlobalStatus('Claude API key removed');
};

// ==== LOGIN GATE ====
(function() {
  var VALID_PASSWORDS = ['700Nebraska$'];
  var SESSION_KEY = 'gw_auth_session';

  function checkSession() {
    return localStorage.getItem(SESSION_KEY) === 'authenticated';
  }

  function showGate() {
    var gate = document.getElementById('login-gate');
    if (gate) gate.classList.remove('hidden');
  }

  function hideGate() {
    var gate = document.getElementById('login-gate');
    if (gate) gate.classList.add('hidden');
  }

  window.doLogin = function() {
    var pw = document.getElementById('login-pw').value;
    var err = document.getElementById('login-error');
    if (VALID_PASSWORDS.indexOf(pw) !== -1) {
      localStorage.setItem(SESSION_KEY, 'authenticated');
      err.classList.remove('visible');
      hideGate();
    } else {
      err.classList.add('visible');
      document.getElementById('login-pw').value = '';
      document.getElementById('login-pw').focus();
    }
  };

  // On page load, check session
  if (checkSession()) {
    hideGate();
  } else {
    showGate();
    setTimeout(function() {
      var pw = document.getElementById('login-pw');
      if (pw) pw.focus();
    }, 100);
  }
})();

// ==== CLOUD SYNC INIT ====
// Runs after all scripts are parsed; GatewaySync is defined in sync.js.
// If supabaseUrl / supabaseAnonKey are absent from config.js the call
// is a no-op, so the app works normally without sync configured.
(function() {
  if (window.GatewaySync && typeof window.GatewaySync.init === 'function') {
    window.GatewaySync.init();
  }
})();