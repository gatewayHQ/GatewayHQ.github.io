// ================================================================
// GW — Gateway Performance Engine
// Shared utilities used by every module. Load before all app scripts.
// ================================================================
(function () {
  'use strict';

  window.GW = window.GW || {};

  // ── 1. DEBOUNCE & THROTTLE ────────────────────────────────────
  GW.debounce = function (fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  };

  GW.throttle = function (fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
    };
  };

  // ── 2. IMAGE CACHE ────────────────────────────────────────────
  // Prevents canvas renders from re-fetching / re-decoding the same
  // image on every keystroke. LRU eviction at 40 entries.
  var IMG_CACHE = {};
  var IMG_CACHE_ORDER = [];
  var IMG_CACHE_MAX = 40;

  GW.loadImage = function (src) {
    if (!src) return Promise.resolve(null);
    if (IMG_CACHE[src]) return Promise.resolve(IMG_CACHE[src]);

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        // LRU eviction
        if (IMG_CACHE_ORDER.length >= IMG_CACHE_MAX) {
          var evict = IMG_CACHE_ORDER.shift();
          delete IMG_CACHE[evict];
        }
        IMG_CACHE[src] = img;
        IMG_CACHE_ORDER.push(src);
        resolve(img);
      };
      img.onerror = function () { resolve(null); }; // never hard-reject; canvas draws are best-effort
      img.src = src;
    });
  };

  GW.clearImageCache = function () {
    IMG_CACHE = {};
    IMG_CACHE_ORDER = [];
  };

  // Invalidate a single key (call after photo is replaced)
  GW.evictImage = function (src) {
    if (!src) return;
    delete IMG_CACHE[src];
    var i = IMG_CACHE_ORDER.indexOf(src);
    if (i !== -1) IMG_CACHE_ORDER.splice(i, 1);
  };

  // ── 3. IMAGE COMPRESSION ─────────────────────────────────────
  // Resize + re-encode before storing as base64.
  // maxW: max dimension (default 1200px), quality: 0-1 (default 0.82)
  GW.compressImage = function (file, maxW, quality) {
    maxW = maxW || 1200;
    quality = quality !== undefined ? quality : 0.82;
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW || h > maxW) {
            if (w >= h) { h = Math.round(h * maxW / w); w = maxW; }
            else        { w = Math.round(w * maxW / h); h = maxW; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = function () { resolve(e.target.result); }; // fallback: original
        img.src = e.target.result;
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsDataURL(file);
    });
  };

  // ── 4. FETCH WITH TIMEOUT & RETRY ────────────────────────────
  GW.fetchWithTimeout = function (url, options, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options, { signal: controller.signal });
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  };

  // Retry with exponential backoff. fn must return a Promise.
  GW.retry = function (fn, maxAttempts, baseDelayMs) {
    maxAttempts = maxAttempts || 3;
    baseDelayMs = baseDelayMs || 400;
    function attempt(n) {
      return fn().catch(function (err) {
        if (n >= maxAttempts) throw err;
        var delay = baseDelayMs * Math.pow(2, n - 1) + Math.random() * 200;
        return new Promise(function (res) { setTimeout(res, delay); }).then(function () {
          return attempt(n + 1);
        });
      });
    }
    return attempt(1);
  };

  // ── 5. AGENT PROFILE CACHE ───────────────────────────────────
  // multifamily.js and social.js both iterate ALL localStorage keys
  // on every render. This caches the results and invalidates on write.
  var _agentCache = null;

  GW.getAgentProfiles = function () {
    if (_agentCache) return _agentCache;
    var profiles = {};
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k && k.indexOf('gateway_agent_profile_') === 0) {
          try { profiles[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {}
        }
      }
    } catch (e) {}
    _agentCache = profiles;
    return profiles;
  };

  GW.invalidateAgentCache = function () { _agentCache = null; };

  // ── 6. SAFE LOCALSTORAGE (quota-aware) ───────────────────────
  GW.safeSet = function (key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Storage quota exceeded — warn once, never crash
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        if (!GW._quotaWarned) {
          GW._quotaWarned = true;
          console.warn('[GW] localStorage quota exceeded — some data may not be saved. Consider exporting your data.');
          if (typeof showGlobalStatus === 'function') {
            showGlobalStatus('⚠ Storage nearly full — export your data to avoid losing it.');
          }
        }
      }
    }
  };

  // ── 7. LOADING OVERLAY ───────────────────────────────────────
  var _loadingEl = null;

  GW.showLoading = function (msg) {
    msg = msg || 'Working…';
    if (!_loadingEl) {
      _loadingEl = document.createElement('div');
      _loadingEl.id = 'gw-loading-overlay';
      _loadingEl.innerHTML =
        '<div class="gw-loading-card">' +
          '<div class="gw-loading-spinner"></div>' +
          '<div class="gw-loading-msg" id="gw-loading-msg"></div>' +
        '</div>';
      document.body.appendChild(_loadingEl);
    }
    var msgEl = document.getElementById('gw-loading-msg');
    if (msgEl) msgEl.textContent = msg;
    _loadingEl.style.display = 'flex';
  };

  GW.hideLoading = function () {
    if (_loadingEl) _loadingEl.style.display = 'none';
  };

  GW.updateLoading = function (msg) {
    var msgEl = document.getElementById('gw-loading-msg');
    if (msgEl) msgEl.textContent = msg;
  };

  // ── 8. NUMBER FORMATTING (shared across all modules) ─────────
  GW.fmt = function (n) {
    var num = parseFloat(n);
    if (isNaN(num)) return '$0';
    return '$' + Math.round(num).toLocaleString();
  };

  GW.fmtK = function (n) {
    var num = parseFloat(n);
    if (isNaN(num)) return '$0';
    if (Math.abs(num) >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M';
    if (Math.abs(num) >= 1000)    return '$' + Math.round(num / 1000) + 'K';
    return '$' + Math.round(num).toLocaleString();
  };

  GW.fmtNum = function (n) {
    var num = parseFloat(n);
    return isNaN(num) ? '0' : Math.round(num).toLocaleString();
  };

  GW.pct = function (n) {
    var num = parseFloat(n);
    return isNaN(num) ? '0.00%' : num.toFixed(2) + '%';
  };

  // ── 9. DOCUMENT FRAGMENT HELPER ──────────────────────────────
  // Batch DOM appends — prevents layout thrashing from multiple appends.
  GW.buildFragment = function (items, renderFn) {
    var frag = document.createDocumentFragment();
    var temp = document.createElement('div');
    for (var i = 0; i < items.length; i++) {
      temp.innerHTML = renderFn(items[i], i);
      while (temp.firstChild) frag.appendChild(temp.firstChild);
    }
    return frag;
  };

  // ── 10. PENDING REQUEST TRACKER (abort on page change) ───────
  var _pendingControllers = [];

  GW.trackedFetch = function (url, options, timeoutMs) {
    var controller = new AbortController();
    _pendingControllers.push(controller);
    var opts = Object.assign({}, options, { signal: controller.signal });
    timeoutMs = timeoutMs || 30000;
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, opts)
      .finally(function () {
        clearTimeout(timer);
        var idx = _pendingControllers.indexOf(controller);
        if (idx !== -1) _pendingControllers.splice(idx, 1);
      });
  };

  GW.abortPendingRequests = function () {
    _pendingControllers.forEach(function (c) { try { c.abort(); } catch (e) {} });
    _pendingControllers = [];
  };

  // ── 11. INJECT LOADING OVERLAY CSS ───────────────────────────
  (function injectCSS() {
    var style = document.createElement('style');
    style.textContent = [
      '#gw-loading-overlay{display:none;position:fixed;inset:0;z-index:99999;',
      'background:rgba(0,0,0,0.65);align-items:center;justify-content:center;',
      'backdrop-filter:blur(3px)}',
      '.gw-loading-card{background:#1a2830;border:1px solid rgba(162,182,192,0.2);',
      'border-radius:16px;padding:32px 40px;text-align:center;',
      'box-shadow:0 24px 64px rgba(0,0,0,0.5);min-width:220px}',
      '.gw-loading-spinner{width:36px;height:36px;border:3px solid rgba(162,182,192,0.15);',
      'border-top-color:#A2B6C0;border-radius:50%;animation:gw-spin 0.7s linear infinite;',
      'margin:0 auto 16px}',
      '.gw-loading-msg{font-family:"Montserrat",sans-serif;font-size:13px;',
      'font-weight:600;color:#C8D8E0;letter-spacing:0.5px}',
      '@keyframes gw-spin{to{transform:rotate(360deg)}}'
    ].join('');
    document.head.appendChild(style);
  })();

})();
