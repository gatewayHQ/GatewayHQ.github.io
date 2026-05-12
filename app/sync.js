// ================================================================
// GatewaySync — Cross-Device Data Sync via Supabase
// ================================================================
//
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────
// 1. Agent clicks "☁ Sync" in the nav and logs in with their email.
// 2. On login: all their cloud data is pulled into localStorage.
// 3. An interceptor wraps localStorage.setItem so every subsequent
//    save (invoices, templates, OMs, agent profiles, API keys)
//    automatically mirrors to Supabase — no changes needed in any
//    other module.
// 4. On any other device, the agent logs in → pull → instant sync.
//
// KEYS THAT SYNC (syncable namespace)
// ─────────────────────────────────────────────────────────────────
// gw_claude_api_key, gw_buffer_token, gw_invoices,
// gw_template_presets, gw_saved_agents, gateway_about_company,
// gatewayOMs, gateway_om_template_selection, gh_pat, gh_branch
// + any key starting with "gateway_agent_profile_"
//
// KEYS THAT DO NOT SYNC (device-local)
// ─────────────────────────────────────────────────────────────────
// gw_auth_session, gw_admin_pass, gw_sync_session
// ================================================================

(function () {
  'use strict';

  // ── Syncable key registry ─────────────────────────────────────
  var SYNC_KEYS = [
    'gw_claude_api_key',
    'gw_buffer_token',
    'gw_invoices',
    'gw_template_presets',
    'gw_saved_agents',
    'gateway_about_company',
    'gatewayOMs',
    'gateway_om_template_selection',
    'gh_pat',
    'gh_branch'
  ];

  // Dynamic prefixes — any localStorage key with these prefixes also syncs
  var SYNC_PREFIXES = ['gateway_agent_profile_'];

  function isSyncable(key) {
    if (!key) return false;
    if (SYNC_KEYS.indexOf(key) !== -1) return true;
    for (var i = 0; i < SYNC_PREFIXES.length; i++) {
      if (key.indexOf(SYNC_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  // ── Push queue: debounce rapid saves (e.g. typing in a form) ──
  var pushQueue = {};
  var DEBOUNCE_MS = 800;

  function enqueuePush(key, value) {
    if (pushQueue[key]) clearTimeout(pushQueue[key].timer);
    pushQueue[key] = {
      value: value,
      timer: setTimeout(function () {
        delete pushQueue[key];
        GatewaySync._pushNow(key, value);
      }, DEBOUNCE_MS)
    };
  }

  // ── localStorage interceptor ───────────────────────────────────
  // Wraps the native setItem so every module auto-syncs on save.
  var _nativeSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _nativeSetItem(key, value);
    if (isSyncable(key) && GatewaySync.isLoggedIn()) {
      enqueuePush(key, value);
    }
  };

  // ── Main sync object ───────────────────────────────────────────
  var GatewaySync = {
    _client: null,
    _session: null,
    _initError: null,   // 'no_config' | 'cdn_failed' | 'client_error'

    // ── Initialise (called from core.js after DOM ready) ─────────
    init: function () {
      // SYNC_CONFIG (sync-config.js, committed) takes priority;
      // falls back to CONFIG (config.js, gitignored) for local dev.
      var syncCfg = window.SYNC_CONFIG || {};
      var cfg     = window.CONFIG      || {};
      var url = syncCfg.supabaseUrl     || cfg.supabaseUrl     || '';
      var key = syncCfg.supabaseAnonKey || cfg.supabaseAnonKey || '';

      console.log('[Sync] init — url:', url ? url.slice(0, 30) + '…' : '(empty)',
                  '| key:', key ? key.slice(0, 18) + '…' : '(empty)');

      if (!url || !key) {
        this._initError = 'no_config';
        console.warn('[Sync] No Supabase credentials found in SYNC_CONFIG or CONFIG');
        return;
      }

      // Supabase JS v2 CDN must expose window.supabase.createClient
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        this._initError = 'cdn_failed';
        console.error('[Sync] Supabase JS library not available on window.supabase — CDN may have failed to load');
        return;
      }

      try {
        this._client = window.supabase.createClient(url, key);
        console.log('[Sync] Client created OK');
        this._restoreSession();
      } catch (e) {
        this._initError = 'client_error';
        this._client    = null;
        console.error('[Sync] createClient threw:', e);
      }
    },

    isLoggedIn: function () {
      return !!(this._session && this._session.user);
    },

    // ── Auth ──────────────────────────────────────────────────────
    _restoreSession: function () {
      var self = this;
      this._client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) {
          self._session = res.data.session;
          self._updateUI(res.data.session.user.email);
          self._pullAll();
        }
      });

      // Keep session fresh via auth state changes
      this._client.auth.onAuthStateChange(function (event, session) {
        self._session = session;
        if (session) {
          self._updateUI(session.user.email);
        } else {
          self._updateUI(null);
        }
      });
    },

    login: function (email, password) {
      var self = this;
      return this._client.auth
        .signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) throw res.error;
          self._session = res.data.session;
          self._updateUI(email);
          return self._pullAll();
        });
    },

    signup: function (email, password) {
      var self = this;
      return this._client.auth
        .signUp({ email: email, password: password })
        .then(function (res) {
          if (res.error) throw res.error;
          // signUp auto-logs in when email confirmation is disabled
          if (res.data.session) {
            self._session = res.data.session;
            self._updateUI(email);
            return self._pushAll();
          }
          return Promise.resolve();
        });
    },

    logout: function () {
      var self = this;
      return this._client.auth.signOut().then(function () {
        self._session = null;
        self._updateUI(null);
      });
    },

    // ── Pull all keys from cloud → localStorage ───────────────────
    _pullAll: function () {
      var self = this;
      if (!this.isLoggedIn()) return Promise.resolve();

      return this._client
        .from('agent_sync_data')
        .select('data_key, data_value')
        .eq('user_id', this._session.user.id)
        .then(function (res) {
          if (res.error) {
            console.error('[Sync] Pull error:', res.error);
            return;
          }
          var rows = res.data || [];

          // Cloud is empty — if this device has local data, upload it automatically.
          // This handles first-login on the device that already has all your work.
          if (rows.length === 0) {
            var hasLocal = SYNC_KEYS.some(function (k) {
              return localStorage.getItem(k) !== null;
            });
            if (hasLocal) {
              self._showToast('Cloud is empty — uploading your data now…');
              return self._pushAll();
            }
            self._showToast('Signed in. No cloud data yet.');
            return;
          }

          var count = 0;
          rows.forEach(function (row) {
            if (!row.data_key || !isSyncable(row.data_key)) return;
            var serialized = row.data_value !== null
              ? JSON.stringify(row.data_value)
              : null;
            if (serialized !== null) {
              _nativeSetItem(row.data_key, serialized);
              count++;
            }
          });
          self._setLastSync(new Date());
          self._showToast('Synced ' + count + ' item(s) from cloud ✓');
          // Refresh any live UI that reads localStorage on load
          self._refreshModules();
        });
    },

    // ── Push a single key to cloud ────────────────────────────────
    _pushNow: function (key, rawValue) {
      if (!this.isLoggedIn()) return;
      var parsed;
      try { parsed = JSON.parse(rawValue); } catch (e) { parsed = rawValue; }

      this._client
        .from('agent_sync_data')
        .upsert({
          user_id: this._session.user.id,
          data_key: key,
          data_value: parsed,
          client_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,data_key' })
        .then(function (res) {
          if (res.error) console.error('[Sync] Push error (' + key + '):', res.error);
        });
    },

    // ── Push ALL current localStorage sync keys to cloud ─────────
    _pushAll: function () {
      var self = this;
      if (!this.isLoggedIn()) return Promise.resolve();

      // Collect all keys including dynamic prefixed ones
      var keys = SYNC_KEYS.slice();
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && !keys.includes(k)) {
          for (var p = 0; p < SYNC_PREFIXES.length; p++) {
            if (k.indexOf(SYNC_PREFIXES[p]) === 0) { keys.push(k); break; }
          }
        }
      }

      var rows = [];
      keys.forEach(function (key) {
        var raw = localStorage.getItem(key);
        if (raw === null) return;
        var parsed;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        rows.push({
          user_id: self._session.user.id,
          data_key: key,
          data_value: parsed,
          client_updated_at: new Date().toISOString()
        });
      });

      if (!rows.length) return Promise.resolve();

      return this._client
        .from('agent_sync_data')
        .upsert(rows, { onConflict: 'user_id,data_key' })
        .then(function (res) {
          if (res.error) {
            console.error('[Sync] Push-all error:', res.error);
            return;
          }
          self._setLastSync(new Date());
          self._showToast('All data pushed to cloud ✓');
        });
    },

    // ── Manual actions exposed to the UI ─────────────────────────
    manualPull: function () {
      return this._pullAll();
    },

    manualPush: function () {
      return this._pushAll();
    },

    // ── Notify live modules to reload their localStorage data ─────
    _refreshModules: function () {
      // Social presets dropdown
      if (typeof window.populateSMPresets === 'function') window.populateSMPresets();
      // Invoice list
      if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
      // OM saved list
      if (typeof window.populateOMList === 'function') window.populateOMList();
      // Agent picker
      if (typeof window.loadSavedAgents === 'function') window.loadSavedAgents();
      // AI badge (api key may have changed)
      if (typeof window.renderAIStatusBadge === 'function') window.renderAIStatusBadge();
    },

    // ── Last-sync timestamp ───────────────────────────────────────
    _setLastSync: function (date) {
      var el = document.getElementById('sync-last-time');
      if (el) {
        el.textContent = 'Last synced ' + date.toLocaleTimeString();
      }
    },

    // ── UI helpers ────────────────────────────────────────────────
    _updateUI: function (email) {
      var btn = document.getElementById('sync-nav-btn');
      var dot = document.getElementById('sync-nav-dot');
      var userEl = document.getElementById('sync-modal-user');
      var loggedInPanel = document.getElementById('sync-logged-in');
      var loginPanel = document.getElementById('sync-login-panel');

      if (email) {
        if (btn) btn.title = 'Synced as ' + email;
        if (dot) { dot.className = 'sync-dot on'; dot.title = 'Cloud sync active'; }
        if (userEl) userEl.textContent = email;
        if (loggedInPanel) loggedInPanel.style.display = '';
        if (loginPanel) loginPanel.style.display = 'none';
      } else {
        if (btn) btn.title = 'Cloud sync — click to log in';
        if (dot) { dot.className = 'sync-dot off'; dot.title = 'Not synced'; }
        if (userEl) userEl.textContent = '';
        if (loggedInPanel) loggedInPanel.style.display = 'none';
        if (loginPanel) loginPanel.style.display = '';
      }
    },

    _showToast: function (msg) {
      if (typeof window.showGlobalStatus === 'function') {
        window.showGlobalStatus(msg);
      }
    }
  };

  // ── Modal open / close (global) ───────────────────────────────
  window.openSyncModal = function () {
    if (!GatewaySync._client) {
      var msgs = {
        cdn_failed:   'The Supabase JS library failed to load from the CDN.\n\nCheck your internet connection and refresh the page.',
        client_error: 'Supabase client failed to initialise.\n\nOpen the browser console (F12 → Console) and look for a [Sync] error to see the exact cause.',
        no_config:    'Cloud sync credentials not found.\n\nCheck that sync-config.js is deployed and contains supabaseUrl and supabaseAnonKey.'
      };
      alert(msgs[GatewaySync._initError] || 'Cloud sync is not available. Open the browser console (F12) for details.');
      return;
    }
    var modal = document.getElementById('sync-modal');
    if (modal) modal.style.display = 'flex';
    // Reflect current login state
    GatewaySync._updateUI(
      GatewaySync.isLoggedIn() ? GatewaySync._session.user.email : null
    );
  };

  window.closeSyncModal = function () {
    var modal = document.getElementById('sync-modal');
    if (modal) modal.style.display = 'none';
    var err = document.getElementById('sync-error');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
  };

  window.doSyncLogin = function () {
    var email = (document.getElementById('sync-email') || {}).value || '';
    var pw    = (document.getElementById('sync-pw')    || {}).value || '';
    var err   = document.getElementById('sync-error');
    var btn   = document.getElementById('sync-login-btn');

    if (!email || !pw) {
      if (err) { err.textContent = 'Enter your email and password.'; err.style.display = ''; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    if (err) { err.textContent = ''; err.style.display = 'none'; }

    GatewaySync.login(email.trim(), pw)
      .then(function () {
        window.closeSyncModal();
      })
      .catch(function (e) {
        if (err) { err.textContent = e.message || 'Login failed.'; err.style.display = ''; }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
      });
  };

  window.doSyncSignup = function () {
    var email = (document.getElementById('sync-email') || {}).value || '';
    var pw    = (document.getElementById('sync-pw')    || {}).value || '';
    var err   = document.getElementById('sync-error');
    var btn   = document.getElementById('sync-signup-btn');

    if (!email || !pw) {
      if (err) { err.textContent = 'Enter your email and password.'; err.style.display = ''; }
      return;
    }
    if (pw.length < 8) {
      if (err) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = ''; }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    if (err) { err.textContent = ''; err.style.display = 'none'; }

    GatewaySync.signup(email.trim(), pw)
      .then(function () {
        window.closeSyncModal();
      })
      .catch(function (e) {
        if (err) { err.textContent = e.message || 'Signup failed.'; err.style.display = ''; }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
      });
  };

  window.doSyncLogout = function () {
    GatewaySync.logout().then(function () {
      window.closeSyncModal();
    });
  };

  window.doSyncPull = function () {
    var btn = document.getElementById('sync-pull-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Pulling…'; }
    GatewaySync.manualPull().finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '↓ Pull from Cloud'; }
    });
  };

  window.doSyncPush = function () {
    var btn = document.getElementById('sync-push-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Pushing…'; }
    GatewaySync.manualPush().finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '↑ Push to Cloud'; }
    });
  };

  window.GatewaySync = GatewaySync;
})();
