// app/video/main.js
// UI controller for the client-side Listing Video Generator. Wires the
// #page-video form to the render engine: photos + details -> live canvas
// preview -> WebCodecs MP4 download. No server, no GitHub Actions.

import { buildModel, FORMATS } from './scene-model.js';
import { encode, detectSupport } from './encoder.js';
import { drawFrame, totalDuration } from './renderer.js';

const state = {
  photos: [],          // [{ bitmap, name }]
  music: null,         // AudioBuffer
  musicName: '',
  logo: null,          // HTMLImageElement | null
  model: null,
  playing: false,
  rafId: 0,
  playStart: 0,
};

const $ = (id) => document.getElementById(id);

// Module scripts run before DOMContentLoaded, but guard in case this loads late.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

async function init() {
  if (!$('v2-generate')) return; // video page not present

  // Populate format dropdown.
  const fmt = $('v2-format');
  Object.entries(FORMATS).forEach(([k, v]) => {
    const o = document.createElement('option'); o.value = k; o.textContent = v.label;
    if (k === 'reels') o.selected = true;
    fmt.appendChild(o);
  });

  // Capability badge.
  const support = await detectSupport();
  $('v2-support').textContent = support.mp4
    ? '✓ MP4 (H.264) rendering supported in this browser — videos export instantly, on your device.'
    : '⚠ This browser will export WebM instead of MP4 (still uploadable to most platforms). For MP4, use a recent Chrome, Edge, or Safari.';

  // Try to load the round brand submark for the closing card (global from assets/logos.js).
  if (window.LOGO_ROUND_SUBMARK) {
    const img = new Image();
    img.onload = () => { state.logo = img; rebuild(); };
    img.src = window.LOGO_ROUND_SUBMARK;
  }

  wirePhotos();
  wireMusic();
  wirePreview();
  $('v2-generate').addEventListener('click', generate);
  ['v2-address','v2-price','v2-eyebrow','v2-beds','v2-baths','v2-sqft','v2-feat1','v2-feat2','v2-feat3','v2-agent','v2-cta','v2-brokerage']
    .forEach((id) => $(id) && $(id).addEventListener('input', debounce(rebuild, 250)));
  fmt.addEventListener('change', rebuild);

  rebuild();
}

// ── Photos ──────────────────────────────────────────────────────────────────
function wirePhotos() {
  const drop = $('v2-drop'), file = $('v2-file');
  drop.addEventListener('click', () => file.click());
  file.addEventListener('change', (e) => addPhotos(e.target.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); addPhotos(e.dataTransfer.files); });
}

async function addPhotos(files) {
  for (const f of Array.from(files)) {
    if (!/^image\//.test(f.type)) continue;
    try { state.photos.push({ bitmap: await loadBitmap(f), name: f.name }); }
    catch (e) { console.warn('[video] skipped a photo that could not be decoded:', f.name, e && e.message); }
  }
  renderThumbs(); rebuild();
}

// Decode via an HTMLImageElement (works across all browsers — more compatible
// than createImageBitmap(File), which can fail in some engines), downscaling
// the longest side to 1920 to keep memory/encoding sane. Returns a drawable
// (HTMLImageElement or HTMLCanvasElement) the renderer can use directly.
function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const iw = img.naturalWidth, ih = img.naturalHeight, max = Math.max(iw, ih);
      if (!max) { reject(new Error('empty image')); return; }
      if (max <= 1920) { resolve(img); return; }
      const s = 1920 / max, w = Math.round(iw * s), h = Math.round(ih * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not decode image')); };
    img.src = url;
  });
}

function renderThumbs() {
  const wrap = $('v2-thumbs'); wrap.innerHTML = '';
  state.photos.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'v2-thumb';
    const c = document.createElement('canvas'); c.width = 80; c.height = 80;
    coverDraw(c.getContext('2d'), p.bitmap, 80, 80);
    d.appendChild(c);
    const num = document.createElement('span'); num.className = 'v2-thumb-num'; num.textContent = i + 1; d.appendChild(num);
    const del = document.createElement('button'); del.className = 'v2-thumb-x'; del.textContent = '✕';
    del.onclick = () => { state.photos.splice(i, 1); renderThumbs(); rebuild(); };
    d.appendChild(del);
    if (i > 0) { const lf = document.createElement('button'); lf.className = 'v2-thumb-mv v2-thumb-l'; lf.textContent = '‹'; lf.onclick = () => move(i, -1); d.appendChild(lf); }
    if (i < state.photos.length - 1) { const rt = document.createElement('button'); rt.className = 'v2-thumb-mv v2-thumb-r'; rt.textContent = '›'; rt.onclick = () => move(i, 1); d.appendChild(rt); }
    wrap.appendChild(d);
  });
}
function move(i, dir) { const j = i + dir; if (j < 0 || j >= state.photos.length) return; const t = state.photos[i]; state.photos[i] = state.photos[j]; state.photos[j] = t; renderThumbs(); rebuild(); }

function coverDraw(ctx, img, W, H) {
  const ar = img.width / img.height, car = W / H; let dw, dh;
  if (ar > car) { dh = H; dw = dh * ar; } else { dw = W; dh = dw / ar; }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// ── Music ─────────────────────────────────────────────────────────────────
function wireMusic() {
  $('v2-music').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const buf = await new AC().decodeAudioData(await f.arrayBuffer());
      state.music = buf; state.musicName = f.name;
      $('v2-music-label').textContent = '🎵 ' + f.name;
    } catch { $('v2-music-label').textContent = 'Could not read that audio file.'; }
  });
  $('v2-music-clear').addEventListener('click', () => {
    state.music = null; state.musicName = ''; $('v2-music').value = ''; $('v2-music-label').textContent = '';
  });
}

// ── Model + preview ─────────────────────────────────────────────────────────
function readData() {
  const v = (id) => ($(id)?.value || '').trim();
  return {
    format: $('v2-format')?.value || 'reels',
    address: v('v2-address'), price: v('v2-price'), eyebrow: v('v2-eyebrow'),
    beds: v('v2-beds'), baths: v('v2-baths'), sqft: v('v2-sqft'),
    agent: v('v2-agent'), brokerage: v('v2-brokerage') || 'Gateway Real Estate Advisors',
    cta: v('v2-cta') || 'Schedule a Showing',
    features: [v('v2-feat1'), v('v2-feat2'), v('v2-feat3')].filter(Boolean),
  };
}

function rebuild() {
  const data = readData();
  const images = state.photos.map((p) => p.bitmap);
  if (!images.length) { state.model = null; drawPlaceholder(); return; }
  state.model = buildModel(data, images, { logo: state.logo }, 'kenburns');
  const c = $('v2-canvas'); c.width = state.model.width; c.height = state.model.height;
  drawAt(currentScrubTime());
}

function wirePreview() {
  $('v2-scrub').addEventListener('input', () => { stopPlay(); drawAt(currentScrubTime()); });
  $('v2-play').addEventListener('click', togglePlay);
}
function currentScrubTime() {
  if (!state.model) return 0;
  return (Number($('v2-scrub').value) / 1000) * totalDuration(state.model);
}
function drawAt(t) {
  if (!state.model) return;
  const c = $('v2-canvas'); drawFrame(state.model, t, c.getContext('2d'), c.width, c.height);
}
function drawPlaceholder() {
  const c = $('v2-canvas'); const f = FORMATS[$('v2-format')?.value || 'reels'];
  c.width = f.w; c.height = f.h; const x = c.getContext('2d');
  x.fillStyle = '#0D1117'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(245,245,243,0.4)'; x.textAlign = 'center'; x.font = `${Math.round(c.height*0.03)}px system-ui, sans-serif`;
  x.fillText('Add photos to preview', c.width / 2, c.height / 2);
}
function togglePlay() { state.playing ? stopPlay() : startPlay(); }
function startPlay() {
  if (!state.model) return;
  state.playing = true; $('v2-play').textContent = '⏸ Pause';
  const dur = totalDuration(state.model);
  const begin = performance.now() - currentScrubTime() * 1000;
  const tick = (now) => {
    if (!state.playing) return;
    let t = (now - begin) / 1000;
    if (t >= dur) { t = 0; state.playStart = now; }
    $('v2-scrub').value = String(Math.round((t / dur) * 1000));
    drawAt(t);
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}
function stopPlay() { state.playing = false; cancelAnimationFrame(state.rafId); $('v2-play').textContent = '▶ Play'; }

// ── Generate + download ─────────────────────────────────────────────────────
async function generate() {
  if (!state.model) { alert('Add at least one photo first.'); return; }
  stopPlay();
  const btn = $('v2-generate'); btn.disabled = true;
  const prog = $('v2-progress'), bar = $('v2-bar'), status = $('v2-status'), out = $('v2-output');
  prog.style.display = 'block'; out.innerHTML = ''; bar.style.width = '0%';
  const onProgress = (frac, msg) => { bar.style.width = Math.round(frac * 100) + '%'; status.textContent = (msg || 'Rendering') + ' — ' + Math.round(frac * 100) + '%'; };

  try {
    const res = await encode(state.model, { quality: 'standard', onProgress, audioBuffer: state.music || undefined });
    const url = URL.createObjectURL(res.blob);
    const name = filename(res.ext);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    const sizeMB = (res.blob.size / 1048576).toFixed(1);
    out.innerHTML = `<div class="v2-done">✅ <strong>${res.ext.toUpperCase()} ready</strong> (${sizeMB} MB) — <a href="${url}" download="${name}">download again</a> · <a href="${url}" target="_blank">open</a><div style="font-size:11px;color:var(--brand-gray);margin-top:4px">Post it to Facebook, Instagram, or anywhere you like.</div></div>`;
    status.textContent = 'Done';
  } catch (e) {
    out.innerHTML = `<div class="v2-err">⚠️ ${escapeHtml(e.message || String(e))}</div>`;
    status.textContent = 'Failed';
  } finally {
    btn.disabled = false;
  }
}

function filename(ext) {
  const slug = (readData().address || 'listing').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'listing';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}_${$('v2-format').value}_${date}.${ext}`;
}

// ── utils ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
