// ===================================================================
// GATEWAY API MODULE
// Central hub for all external API calls.
// Automatically routes through the Vercel proxy when configured,
// falls back to direct browser calls with local keys.
//
// Usage (any module):
//   GatewayAPI.claude(system, user).then(text => ...)
//   GatewayAPI.bufferProfiles().then(profiles => ...)
//   GatewayAPI.bufferPost(profileIds, text).then(result => ...)
// ===================================================================

var GatewayAPI = (function () {

  // ── Config readers ──────────────────────────────────────────────

  function proxyUrl() {
    return ((window.CONFIG && window.CONFIG.proxyUrl) || '').replace(/\/$/, '');
  }

  function proxySecret() {
    return (window.CONFIG && window.CONFIG.proxySecret) || '';
  }

  function localClaudeKey() {
    return (localStorage.getItem('gw_claude_api_key') ||
            (window.CONFIG && window.CONFIG.claudeApiKey) || '').trim();
  }

  function localBufferToken() {
    return (localStorage.getItem('gw_buffer_token') ||
            (window.CONFIG && window.CONFIG.bufferAccessToken) || '').trim();
  }

  function proxyHeaders() {
    var h = { 'Content-Type': 'application/json' };
    if (proxySecret()) h['x-gateway-secret'] = proxySecret();
    return h;
  }

  // ── Availability checks ─────────────────────────────────────────

  function claudeAvailable() {
    return !!(proxyUrl() || localClaudeKey());
  }

  function bufferAvailable() {
    return !!(proxyUrl() || localBufferToken());
  }

  // ── Claude ──────────────────────────────────────────────────────

  // Returns a Promise<string> — the assistant's text reply.
  function claude(systemPrompt, userPrompt, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (!claudeAvailable()) {
        reject(new Error('Claude not configured. Add claudeApiKey to config.js or deploy the API proxy.'));
        return;
      }

      if (proxyUrl()) {
        // ── Proxy path ──
        fetch(proxyUrl() + '/api/gw-claude', {
          method: 'POST',
          headers: proxyHeaders(),
          body: JSON.stringify({
            system: systemPrompt || '',
            user: userPrompt,
            max_tokens: opts.max_tokens || 1000,
            model: opts.model || 'claude-sonnet-4-6'
          })
        })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || ('HTTP ' + r.status)); });
            return r.json();
          })
          .then(function (data) {
            resolve((data.content && data.content[0] && data.content[0].text || '').trim());
          })
          .catch(reject);

      } else {
        // ── Direct browser path ──
        var key = localClaudeKey();
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: opts.model || 'claude-sonnet-4-6',
            max_tokens: opts.max_tokens || 1000,
            system: systemPrompt || '',
            messages: [{ role: 'user', content: userPrompt }]
          })
        })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error && e.error.message || ('HTTP ' + r.status)); });
            return r.json();
          })
          .then(function (data) {
            resolve((data.content && data.content[0] && data.content[0].text || '').trim());
          })
          .catch(reject);
      }
    });
  }

  // Legacy callback wrapper — keeps older code working unchanged.
  // claudeRequest(system, user, onResult, onError)
  function claudeRequest(systemPrompt, userPrompt, onResult, onError) {
    claude(systemPrompt, userPrompt)
      .then(onResult)
      .catch(function (err) { onError(err.message || String(err)); });
  }

  // ── Buffer ──────────────────────────────────────────────────────

  // Returns Promise<{ profiles: Profile[] }>
  function bufferProfiles() {
    return new Promise(function (resolve, reject) {
      if (!bufferAvailable()) {
        reject(new Error('Buffer not configured.'));
        return;
      }

      if (proxyUrl()) {
        fetch(proxyUrl() + '/api/gw-buffer-profiles', { headers: proxyHeaders() })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || ('HTTP ' + r.status)); });
            return r.json();
          })
          .then(resolve)
          .catch(reject);

      } else {
        var token = localBufferToken();
        // Direct call (may require a CORS proxy in some browsers)
        _bufferFetch('https://api.buffer.com/1/profiles.json', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!Array.isArray(data)) throw new Error(data.error || 'Buffer error');
            var profiles = data.map(function (p) {
              return { id: p.id, service: p.service, handle: p.formatted_username || p.handle || p.id, avatar: p.avatar || '' };
            });
            resolve({ profiles: profiles });
          })
          .catch(reject);
      }
    });
  }

  // Returns Promise<{ results, errors, success }>
  function bufferPost(profileIds, text, mediaUrl, scheduledAt) {
    return new Promise(function (resolve, reject) {
      if (!bufferAvailable()) {
        reject(new Error('Buffer not configured.'));
        return;
      }

      if (proxyUrl()) {
        fetch(proxyUrl() + '/api/gw-buffer', {
          method: 'POST',
          headers: proxyHeaders(),
          body: JSON.stringify({ profileIds: profileIds, text: text, mediaUrl: mediaUrl || null, scheduledAt: scheduledAt || null })
        })
          .then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || ('HTTP ' + r.status)); });
            return r.json();
          })
          .then(resolve)
          .catch(reject);

      } else {
        // Direct calls per profile
        var token = localBufferToken();
        var promises = (profileIds || []).map(function (pid) {
          var params = new URLSearchParams({ text: text, 'profile_ids[]': pid });
          if (mediaUrl) params.append('media[link]', mediaUrl);
          if (scheduledAt) params.append('scheduled_at', scheduledAt);
          return _bufferFetch('https://api.buffer.com/1/updates/create.json', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.error) return { profileId: pid, error: data.error };
              return { profileId: pid, updateId: data.updates && data.updates[0] && data.updates[0].id };
            })
            .catch(function (e) { return { profileId: pid, error: e.message }; });
        });

        Promise.all(promises).then(function (results) {
          var errors = results.filter(function (r) { return r.error; });
          resolve({ results: results.filter(function (r) { return !r.error; }), errors: errors, success: errors.length === 0 });
        });
      }
    });
  }

  // ── Buffer health check ─────────────────────────────────────────

  function bufferUser() {
    return new Promise(function (resolve, reject) {
      if (!bufferAvailable()) { reject(new Error('Buffer not configured.')); return; }
      var url = 'https://api.buffer.com/1/user.json';
      if (proxyUrl()) {
        // Re-use profiles endpoint as a user signal; full user endpoint would need its own proxy route
        bufferProfiles().then(function(d){ resolve({ profiles: d.profiles }); }).catch(reject);
      } else {
        var token = localBufferToken();
        _bufferFetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function(r){ return r.json(); })
          .then(resolve).catch(reject);
      }
    });
  }

  // ── Proxy health check ─────────────────────────────────────────

  function healthCheck() {
    var url = proxyUrl();
    if (!url) return Promise.resolve({ ok: false, error: 'No proxy configured' });
    return fetch(url + '/api/gw-health', { headers: proxyHeaders() })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  // ── Internal: CORS-fallback Buffer fetch (direct mode only) ────

  function _bufferFetch(url, options) {
    var isPost = options && options.method && options.method.toUpperCase() === 'POST';
    return fetch(url, options).catch(function () {
      if (!isPost) {
        return fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)).catch(function () {
          return fetch('https://corsproxy.io/?' + encodeURIComponent(url), options);
        });
      }
      return fetch('https://corsproxy.io/?' + encodeURIComponent(url), options);
    });
  }

  // ── Public surface ──────────────────────────────────────────────

  return {
    // Claude
    claude:          claude,
    claudeRequest:   claudeRequest,
    claudeAvailable: claudeAvailable,

    // Buffer
    bufferProfiles:  bufferProfiles,
    bufferPost:      bufferPost,
    bufferUser:      bufferUser,
    bufferAvailable: bufferAvailable,

    // Utilities
    healthCheck:     healthCheck,
    proxyUrl:        proxyUrl
  };

})();

window.GatewayAPI = GatewayAPI;
