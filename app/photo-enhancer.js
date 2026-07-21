// ===================================================================
// PROFESSIONAL PHOTO ENHANCER
// Front-end for the photo-enhancer/ FastAPI backend. Uploads single or
// batch iPhone photos, applies MLS-grade corrections (+ optional
// generative edits), and returns downloadable high-res JPEGs.
//
// The heavy lifting (perspective, exposure/HDR, white balance, sky,
// declutter, staging, provider routing, MLS disclosure) all happens in
// the backend. This module is a thin, agent-friendly control surface.
// ===================================================================
var photoEnhancerInitialized = false;
var _peFiles = [];
var _pePollTimer = null;

function _peBackend() {
  var ai = window.AI_CONFIG || {};
  var cfg = window.CONFIG || {};
  return (ai.photoEnhancerUrl || cfg.photoEnhancerUrl || '').replace(/\/$/, '');
}

function initPhotoEnhancer() {
  photoEnhancerInitialized = true;
  _peFiles = [];
  var root = document.getElementById('pe-root');
  if (!root) return;

  var backend = _peBackend();
  if (!backend) {
    root.innerHTML =
      '<div class="pe-setup">' +
      '<h3>⚙️ Backend not configured</h3>' +
      '<p>The Photo Enhancer runs on a small Python service. Deploy <code>photo-enhancer/</code> ' +
      '(see its README), then set <code>photoEnhancerUrl</code> in <code>ai-config.js</code> ' +
      'or your local <code>config.js</code>.</p>' +
      '<p style="color:var(--brand-gray);font-size:12px">Corrections run without any AI keys. ' +
      'Sky replacement, declutter, and virtual staging require a generative provider ' +
      '(Imagen AI recommended) configured in the backend.</p>' +
      '</div>';
    return;
  }

  root.innerHTML = _peTemplate();
  _peWireEvents();
  _peLoadStyles(backend);
  _peCheckHealth(backend);
}

function _peTemplate() {
  return '' +
  '<div class="pe-drop" id="pe-drop">' +
    '<div class="pe-drop-icon">📸</div>' +
    '<div>Drop iPhone photos here, or <span style="color:var(--brand-gold)">click to choose</span></div>' +
    '<div style="font-size:12px;color:var(--brand-gray);margin-top:6px">Single or full listing gallery · JPG / HEIC / PNG</div>' +
    '<div id="pe-count" style="margin-top:8px;font-weight:600"></div>' +
    '<input type="file" id="pe-file" accept="image/jpeg,image/png,image/heic" multiple hidden>' +
  '</div>' +

  '<div class="pe-opts">' +
    '<div class="pe-col">' +
      '<h4>House Style</h4>' +
      '<select id="pe-style" class="pe-sel"></select>' +
      '<h4 style="margin-top:16px">Corrections <span class="pe-safe">MLS-safe</span></h4>' +
      _peCheck('pe-perspective_correction', 'Perspective / straighten', true) +
      _peCheck('pe-white_balance', 'Neutral white balance', true) +
      _peCheck('pe-exposure_balance', 'Exposure balance / HDR', true) +
      _peCheck('pe-window_pull', 'Window pull (recover views)', true) +
      _peCheck('pe-clarity_sharpen', 'Clarity & sharpen', true) +
    '</div>' +
    '<div class="pe-col">' +
      '<h4>Generative <span class="pe-disc-tag">disclosed</span></h4>' +
      '<label class="pe-row">Sky replacement' +
        '<select id="pe-sky" class="pe-sel" style="margin-left:auto;width:130px">' +
          '<option value="none">None</option><option value="blue">Blue</option>' +
          '<option value="golden_hour">Golden hour</option><option value="dramatic">Dramatic</option>' +
        '</select></label>' +
      _peCheck('pe-declutter', 'Declutter / remove personal items', false) +
      '<label class="pe-row"><input type="checkbox" id="pe-virtual_staging"> Stage empty rooms' +
        '<select id="pe-staging_style" class="pe-sel" style="margin-left:auto;width:130px">' +
          '<option>modern</option><option>transitional</option><option>farmhouse</option><option>luxury</option>' +
        '</select></label>' +
      '<div class="pe-warn" id="pe-disc" style="display:none">Generative edits are labeled on the ' +
        'delivered photo and logged in an <code>.mls.json</code> sidecar. Confirm your MLS’s ' +
        'disclosure rules before publishing.</div>' +
    '</div>' +
  '</div>' +

  '<div style="display:flex;align-items:center;gap:14px;margin:18px 0">' +
    '<button class="pe-go" id="pe-go" disabled>Enhance Photos</button>' +
    '<span id="pe-health" style="font-size:12px;color:var(--brand-gray)"></span>' +
  '</div>' +

  '<div class="pe-grid" id="pe-grid"></div>';
}

function _peCheck(id, label, checked) {
  return '<label class="pe-row"><input type="checkbox" id="' + id + '"' +
         (checked ? ' checked' : '') + '> ' + label + '</label>';
}

function _peWireEvents() {
  var drop = document.getElementById('pe-drop');
  var input = document.getElementById('pe-file');
  drop.onclick = function () { input.click(); };
  input.onchange = function () { _peSetFiles(input.files); };

  ['dragover', 'dragenter'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('hot'); });
  });
  ['dragleave', 'drop'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('hot'); });
  });
  drop.addEventListener('drop', function (ev) { _peSetFiles(ev.dataTransfer.files); });

  ['pe-sky', 'pe-declutter', 'pe-virtual_staging'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', _peRefreshDisclosure);
  });
  document.getElementById('pe-go').onclick = _peSubmit;
}

function _peSetFiles(list) {
  _peFiles = Array.prototype.slice.call(list || []);
  var c = document.getElementById('pe-count');
  c.textContent = _peFiles.length ? _peFiles.length + ' photo(s) ready' : '';
  document.getElementById('pe-go').disabled = !_peFiles.length;
}

function _peRefreshDisclosure() {
  var gen = document.getElementById('pe-sky').value !== 'none' ||
            document.getElementById('pe-declutter').checked ||
            document.getElementById('pe-virtual_staging').checked;
  document.getElementById('pe-disc').style.display = gen ? 'block' : 'none';
}

function _peLoadStyles(backend) {
  var sel = document.getElementById('pe-style');
  GW.fetchWithTimeout(backend + '/api/styles', {}, 8000)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      sel.innerHTML = (d.styles || []).map(function (s) {
        return '<option value="' + s.key + '" title="' + (s.description || '') + '">' + s.label + '</option>';
      }).join('');
    })
    .catch(function () {
      sel.innerHTML = '<option value="gateway_default">Gateway — Clean & Bright</option>';
    });
}

function _peCheckHealth(backend) {
  var el = document.getElementById('pe-health');
  GW.fetchWithTimeout(backend + '/api/health', {}, 8000)
    .then(function (r) { return r.json(); })
    .then(function (h) {
      var gen = h.provider_available
        ? '✓ ' + h.generative_provider + ' ready'
        : '⚠ generative provider (' + h.generative_provider + ') not configured — corrections only';
      el.textContent = gen;
      el.style.color = h.provider_available ? '#4CAF50' : '#FFC107';
    })
    .catch(function () {
      el.textContent = '⚠ backend unreachable';
      el.style.color = '#e07070';
    });
}

function _peOptions() {
  function ck(id) { return document.getElementById(id).checked; }
  return {
    perspective_correction: ck('pe-perspective_correction'),
    white_balance:          ck('pe-white_balance'),
    exposure_balance:       ck('pe-exposure_balance'),
    window_pull:            ck('pe-window_pull'),
    clarity_sharpen:        ck('pe-clarity_sharpen'),
    sky_replacement:        document.getElementById('pe-sky').value,
    declutter:              ck('pe-declutter'),
    virtual_staging:        ck('pe-virtual_staging'),
    staging_style:          document.getElementById('pe-staging_style').value,
    house_style:            document.getElementById('pe-style').value
  };
}

function _peSubmit() {
  var backend = _peBackend();
  if (!backend || !_peFiles.length) return;

  var go = document.getElementById('pe-go');
  go.disabled = true;
  go.textContent = 'Uploading…';

  var fd = new FormData();
  _peFiles.forEach(function (f) { fd.append('files', f, f.name); });
  fd.append('options', JSON.stringify(_peOptions()));

  GW.fetchWithTimeout(backend + '/api/enhance', { method: 'POST', body: fd }, 60000)
    .then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.detail || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(function (job) {
      showGlobalStatus('✓ Processing ' + job.total + ' photo(s)…');
      _pePoll(backend, job.job_id);
    })
    .catch(function (err) {
      showGlobalStatus('⚠️ ' + err.message);
      go.disabled = false;
      go.textContent = 'Enhance Photos';
    });
}

function _pePoll(backend, jobId) {
  if (_pePollTimer) clearTimeout(_pePollTimer);
  GW.fetchWithTimeout(backend + '/api/jobs/' + jobId, {}, 15000)
    .then(function (r) { return r.json(); })
    .then(function (job) {
      _peRenderGrid(backend, job);
      if (job.state === 'running' || job.state === 'queued') {
        _pePollTimer = setTimeout(function () { _pePoll(backend, jobId); }, 1500);
      } else {
        var go = document.getElementById('pe-go');
        go.disabled = false;
        go.textContent = 'Enhance Photos';
        if (job.state === 'done') showGlobalStatus('✓ Done — ' + job.completed + ' enhanced');
        if (job.state === 'error') showGlobalStatus('⚠️ ' + (job.error || 'Job failed'));
      }
    })
    .catch(function () {
      _pePollTimer = setTimeout(function () { _pePoll(backend, jobId); }, 2500);
    });
}

function _peRenderGrid(backend, job) {
  var grid = document.getElementById('pe-grid');
  if (!grid) return;
  grid.innerHTML = job.photos.map(function (p) {
    var done = p.status === 'done' && p.output_url;
    var img = done
      ? '<a href="' + backend + p.output_url + '" target="_blank" rel="noopener">' +
        '<img src="' + backend + p.output_url + '?t=' + Date.now() + '" loading="lazy"></a>'
      : '<div class="pe-ph">' + p.status + '…</div>';
    var badge = p.disclosure_required ? '<span class="pe-disc-tag" title="' +
      (p.disclosure_text || '') + '">🏷 disclosed</span>' : '';
    var meta = [p.room_type, (p.generative_steps || []).join(', ')].filter(Boolean).join(' · ');
    return '<div class="pe-card">' + img +
      '<div class="pe-fn">' + p.filename + ' ' + badge + '</div>' +
      '<div class="pe-meta">' + (p.error ? '⚠ ' + p.error : (meta || 'corrections')) + '</div>' +
      '</div>';
  }).join('');
}

// ── Self-init safety net ───────────────────────────────────────────
// The router calls initPhotoEnhancer() on navigation. This wrapper makes the
// tool initialize even if a stale/cached router.js lacks that call — it wraps
// the existing navigateTo and is idempotent (guarded by photoEnhancerInitialized).
(function () {
  if (typeof window.navigateTo === 'function' && !window._peNavWrapped) {
    var _origNav = window.navigateTo;
    window.navigateTo = function (page) {
      _origNav(page);
      if (page === 'photo-enhancer' && !photoEnhancerInitialized) {
        try { initPhotoEnhancer(); } catch (e) { /* never break navigation */ }
      }
    };
    window._peNavWrapped = true;
  }
})();
