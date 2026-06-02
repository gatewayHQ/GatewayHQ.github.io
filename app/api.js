// ================================================================
// GATEWAY API MODULE — v2
// Central hub for all external API calls.
// Routes through the Vercel proxy when configured,
// falls back to direct browser calls with local keys.
//
// Fixes vs v1:
//   • AbortController timeout on every fetch (default 30s)
//   • Exponential backoff retry (3 attempts, 400ms base)
//   • Promise.all().catch() on Buffer batch — no more silent hangs
//   • Outdated anthropic-version header updated
//   • Meaningful error messages per failure mode
//   • Removed insecure public CORS proxies (allorigins / corsproxy.io)
//   • Request deduplication for Claude (same prompt = same in-flight request)
//
// Usage (any module):
//   GatewayAPI.claude(system, user).then(text => ...)
//   GatewayAPI.bufferProfiles().then(profiles => ...)
//   GatewayAPI.bufferPost(profileIds, text).then(result => ...)
// ================================================================

var GatewayAPI = (function () {
  'use strict';

  var TIMEOUT_MS      = 45000;  // 45s — generous for long AI responses
  var RETRY_ATTEMPTS  = 3;
  var RETRY_BASE_MS   = 400;
  var ANTHROPIC_VER   = '2023-06-01'; // keep stable; update only on breaking changes
  var DEFAULT_MODEL   = 'claude-sonnet-4-6';
  var DEFAULT_TOKENS  = 2000;   // raised from 1000 — prevents truncated OM/social content

  // ── Lightweight FNV-inspired hash (keeps dedup keys small) ──────
  function _hash32(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (Math.imul(h, 0x01000193)) >>> 0;
    }
    return h.toString(36);
  }

  // ── Config readers ──────────────────────────────────────────────

  function proxyUrl() {
    // Check AI_CONFIG (committed team config) first, then CONFIG (local)
    var ai = window.AI_CONFIG || {};
    var cfg = window.CONFIG   || {};
    return ((ai.proxyUrl || cfg.proxyUrl || '')).replace(/\/$/, '');
  }

  function proxySecret() {
    var ai = window.AI_CONFIG || {};
    var cfg = window.CONFIG   || {};
    return (ai.proxySecret || cfg.proxySecret || '');
  }

  function localClaudeKey() {
    var ai  = window.AI_CONFIG || {};
    var cfg = window.CONFIG    || {};
    return (
      window._gwTeamClaudeKey  ||          // shared key from Supabase team_secrets (login required)
      localStorage.getItem('gw_claude_api_key') ||  // personal key entered via ✦ AI
      ai.claudeApiKey  ||
      cfg.claudeApiKey || ''
    ).trim();
  }

  function localBufferToken() {
    var cfg = window.CONFIG || {};
    return (
      localStorage.getItem('gw_buffer_token') ||
      cfg.bufferAccessToken || ''
    ).trim();
  }

  function supabaseJwt() {
    // Pull the live JWT from GatewaySync session (set after ☁ Sync login)
    var sync = window.GatewaySync;
    return (sync && sync._session && sync._session.access_token) || '';
  }

  function proxyHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var secret = proxySecret();
    if (secret) h['x-gateway-secret'] = secret;
    // When the proxy is a Supabase Edge Function, include the agent's
    // JWT so Supabase's built-in JWT verification passes.
    var jwt = supabaseJwt();
    if (jwt && proxyUrl().indexOf('supabase.co') !== -1) {
      h['Authorization'] = 'Bearer ' + jwt;
    }
    return h;
  }

  // ── Availability checks ─────────────────────────────────────────

  function claudeAvailable() {
    if (proxyUrl()) {
      // Supabase Edge Function proxy requires an active sync session (JWT)
      if (proxyUrl().indexOf('supabase.co') !== -1) {
        return !!(supabaseJwt() || localClaudeKey());
      }
      return true;
    }
    return !!localClaudeKey();
  }

  function bufferAvailable() {
    return !!(proxyUrl() || localBufferToken());
  }

  // ── Internal: fetch with timeout ────────────────────────────────
  // Delegates to GW.fetchWithTimeout (utils.js) — single implementation.

  function _fetch(url, options, timeoutMs) {
    return GW.fetchWithTimeout(url, options || {}, timeoutMs || TIMEOUT_MS);
  }

  // ── Internal: retry with exponential backoff ────────────────────
  // Keeps API-specific non-retry conditions (AbortError, 4xx) on top of GW.retry.

  function _withRetry(fn) {
    function attempt(n) {
      return fn().catch(function (err) {
        // Don't retry aborts (timeout) or 4xx client errors
        var isAbort  = err && err.name === 'AbortError';
        var msg      = (err && err.message) || '';
        var isClient = msg.indexOf('HTTP 4') !== -1;
        if (isAbort || isClient || n >= RETRY_ATTEMPTS) throw err;
        var delay = RETRY_BASE_MS * Math.pow(2, n - 1) + Math.random() * 150;
        return new Promise(function (res) { setTimeout(res, delay); }).then(function () {
          return attempt(n + 1);
        });
      });
    }
    return attempt(1);
  }

  // ── In-flight deduplication for Claude ──────────────────────────
  // Prevents double-firing when the user clicks "Generate" twice.
  // Keys are hashed so large OM/social prompts don't bloat memory.

  var _inFlight = {};

  function _dedupeKey(system, user, opts) {
    var imgSig = '';
    if (opts && opts.images && opts.images.length) {
      var s = opts.images.map(function (im) { return typeof im === 'string' ? im : (im.data || ''); }).join('');
      imgSig = '|i' + _hash32(s);
    }
    return (opts && opts.model || DEFAULT_MODEL) + '|' + _hash32((system || '') + '\x00' + user) + imgSig;
  }

  // ── Claude ──────────────────────────────────────────────────────

  // Normalize opts.images (array of data URLs or {media_type,data}) into the
  // {media_type,data} blocks our proxy expects. Returns undefined if none.
  function _imagesToBlocks(images) {
    if (!images || !images.length) return undefined;
    return images.map(function (im) {
      if (typeof im === 'string') {
        var m = /^data:([^;]+);base64,(.*)$/.exec(im) || [];
        return { media_type: m[1] || 'image/jpeg', data: m[2] || '' };
      }
      return { media_type: im.media_type || 'image/jpeg', data: im.data || '' };
    });
  }
  // For the direct-to-Anthropic path: build a multimodal content array.
  function _imagesToContent(images, userPrompt) {
    var blocks = _imagesToBlocks(images);
    if (!blocks) return userPrompt;
    var content = blocks.map(function (b) {
      return { type: 'image', source: { type: 'base64', media_type: b.media_type, data: b.data } };
    });
    content.push({ type: 'text', text: userPrompt });
    return content;
  }

  function claude(systemPrompt, userPrompt, opts) {
    opts = opts || {};

    if (!claudeAvailable()) {
      return Promise.reject(new Error(
        'AI not configured. Click ✦ AI in the nav to add your Claude API key, ' +
        'or ask your admin to set up the team proxy.'
      ));
    }

    var key = _dedupeKey(systemPrompt, userPrompt, opts);
    if (_inFlight[key]) return _inFlight[key];

    var promise = _withRetry(function () {
      if (proxyUrl()) {
        // ── Proxy path ──────────────────────────────────────────
        return _fetch(proxyUrl() + '/api/claude', {
          method:  'POST',
          headers: proxyHeaders(),
          body:    JSON.stringify({
            system:     systemPrompt || '',
            user:       userPrompt,
            max_tokens: opts.max_tokens || DEFAULT_TOKENS,
            model:      opts.model     || DEFAULT_MODEL,
            images:     _imagesToBlocks(opts.images)
          })
        })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) {
              if (r.status === 401 || r.status === 403) {
                throw new Error('Sign in via ☁ Sync to use shared AI, or click ✦ AI to add a personal key.');
              }
              throw new Error(e.error || 'Proxy error HTTP ' + r.status);
            });
            return r.json();
          })
          .then(function (data) {
            return (data.content && data.content[0] && data.content[0].text || '').trim();
          });

      } else {
        // ── Direct browser path ─────────────────────────────────
        var k = localClaudeKey();
        if (!k || k.length < 10) {
          throw new Error('Claude API key missing or invalid. Click ✦ AI to configure.');
        }
        return _fetch('https://api.anthropic.com/v1/messages', {
          method:  'POST',
          headers: {
            'x-api-key':                              k,
            'anthropic-version':                      ANTHROPIC_VER,
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type':                           'application/json'
          },
          body: JSON.stringify({
            model:      opts.model     || DEFAULT_MODEL,
            max_tokens: opts.max_tokens || DEFAULT_TOKENS,
            system:     systemPrompt   || '',
            messages:   [{ role: 'user', content: _imagesToContent(opts.images, userPrompt) }]
          })
        })
          .then(function (r) {
            if (r.status === 401) {
              console.error('[API] 401 from Anthropic — key prefix used:', k ? k.slice(0, 14) + '…' : '(empty)');
              throw new Error('Invalid Claude API key. Check ✦ AI Setup.');
            }
            if (r.status === 429) throw new Error('Claude rate limit reached. Wait a moment and try again.');
            if (!r.ok) return r.json().then(function (e) {
              throw new Error((e.error && e.error.message) || 'Claude API error ' + r.status);
            });
            return r.json();
          })
          .then(function (data) {
            var text = data.content && data.content[0] && data.content[0].text;
            if (!text) throw new Error('Unexpected response from Claude API.');
            return text.trim();
          });
      }
    }).finally(function () { delete _inFlight[key]; });

    _inFlight[key] = promise;
    return promise;
  }

  // Legacy callback wrapper — keeps older calling code unchanged.
  function claudeRequest(systemPrompt, userPrompt, onResult, onError) {
    claude(systemPrompt, userPrompt)
      .then(onResult)
      .catch(function (err) { (onError || function () {})(err.message || String(err)); });
  }

  // ── Buffer ──────────────────────────────────────────────────────

  function bufferProfiles() {
    if (!bufferAvailable()) {
      return Promise.reject(new Error('Buffer not configured. Add your access token.'));
    }

    return _withRetry(function () {
      if (proxyUrl()) {
        return _fetch(proxyUrl() + '/api/buffer-profiles', { headers: proxyHeaders() })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'HTTP ' + r.status); });
            return r.json();
          });
      }

      var token = localBufferToken();
      // Direct call — works in most browsers; users should configure proxy for teams
      return _fetch('https://api.buffer.com/1/profiles.json', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!Array.isArray(data)) throw new Error(data.error || 'Buffer profiles error');
          return {
            profiles: data.map(function (p) {
              return {
                id:      p.id,
                service: p.service,
                handle:  p.formatted_username || p.handle || p.id,
                avatar:  p.avatar || ''
              };
            })
          };
        });
    });
  }

  function bufferPost(profileIds, text, mediaUrl, scheduledAt) {
    if (!bufferAvailable()) {
      return Promise.reject(new Error('Buffer not configured.'));
    }

    return _withRetry(function () {
      if (proxyUrl()) {
        return _fetch(proxyUrl() + '/api/buffer', {
          method:  'POST',
          headers: proxyHeaders(),
          body:    JSON.stringify({
            profileIds:  profileIds,
            text:        text,
            mediaUrl:    mediaUrl    || null,
            scheduledAt: scheduledAt || null
          })
        })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'HTTP ' + r.status); });
            return r.json();
          });
      }

      // Direct per-profile posts — wrapped so Promise.all never hangs
      var token    = localBufferToken();
      var promises = (profileIds || []).map(function (pid) {
        var params = new URLSearchParams({ text: text, 'profile_ids[]': pid });
        if (mediaUrl)    params.append('media[link]', mediaUrl);
        if (scheduledAt) params.append('scheduled_at', scheduledAt);
        return _fetch('https://api.buffer.com/1/updates/create.json', {
          method:  'POST',
          headers: {
            'Authorization':  'Bearer ' + token,
            'Content-Type':   'application/x-www-form-urlencoded'
          },
          body: params.toString()
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) return { profileId: pid, error: data.error };
            return {
              profileId: pid,
              updateId:  data.updates && data.updates[0] && data.updates[0].id
            };
          })
          .catch(function (e) { return { profileId: pid, error: e.message }; });
      });

      // Fixed: .catch() so a rejection can never leave Promise.all hanging
      return Promise.all(promises).catch(function (e) {
        return [{ error: e.message }];
      }).then(function (results) {
        var errors = results.filter(function (r) { return r.error; });
        return {
          results: results.filter(function (r) { return !r.error; }),
          errors:  errors,
          success: errors.length === 0
        };
      });
    });
  }

  // Buffer user / health signal
  function bufferUser() {
    if (!bufferAvailable()) {
      return Promise.reject(new Error('Buffer not configured.'));
    }
    if (proxyUrl()) {
      return bufferProfiles().then(function (d) { return { profiles: d.profiles }; });
    }
    var token = localBufferToken();
    return _withRetry(function () {
      return _fetch('https://api.buffer.com/1/user.json', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
        .then(function (r) { return r.json(); });
    });
  }

  // ── Proxy health check ──────────────────────────────────────────

  function healthCheck() {
    var url = proxyUrl();
    if (!url) return Promise.resolve({ ok: false, error: 'No proxy configured' });
    return _fetch(url + '/api/health', { headers: proxyHeaders() }, 8000)
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  // ── Public surface ──────────────────────────────────────────────

  return {
    claude:           claude,
    claudeRequest:    claudeRequest,
    claudeAvailable:  claudeAvailable,
    resolveClaudeKey: localClaudeKey,   // exposed so core.js avoids duplicate resolution logic
    bufferProfiles:   bufferProfiles,
    bufferPost:       bufferPost,
    bufferUser:       bufferUser,
    bufferAvailable:  bufferAvailable,
    healthCheck:      healthCheck,
    proxyUrl:         proxyUrl
  };

})();

window.GatewayAPI = GatewayAPI;
