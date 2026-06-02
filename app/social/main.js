// app/social/main.js
// UI controller for the Social & Mailer Graphics Generator. Fields + photo +
// up to two agents -> live canvas preview -> PNG / all-sizes export. Templates
// adapt to residential vs commercial via the stat presets.

import { renderTemplate, TEMPLATE_ORDER, TEMPLATES, THEME_ORDER, THEMES, SIZES } from './renderer.js';
import { loadFonts } from './design-tokens.js';
import { exportPNG, exportAllSocial } from './export.js';
import { writeCaption } from './ai.js';

const $ = (id) => document.getElementById(id);
const state = { type: 'commercial', photo: null, heads: [null, null], logo: null, ready: false };

const SIZE_ORDER = ['ig-portrait', 'square', 'story', 'linkedin', 'postcard-6x4'];

// Default kicker + stat labels per template, by property type. Values start
// empty; the agent fills them. Switching template/type resets the labels.
const KICKER = {
  'cre-just-listed': 'For Sale', 'cre-just-closed': 'Just Closed', 'cre-open-house': 'Open House',
  'cre-for-lease': 'For Lease', 'cre-coming-soon': 'Coming Soon', 'cre-stats': 'By the Numbers',
  'cre-testimonial': 'Client Review', 'cre-meet-agent': 'Meet Your Advisor',
};
const STAT_LABELS = {
  'cre-just-listed': { commercial: ['Price', 'Building SF', 'Cap Rate'], residential: ['Price', 'Beds', 'Baths'] },
  'cre-just-closed': { commercial: ['Sale Price', 'Building SF', 'Cap Rate'], residential: ['Sale Price', 'Beds', 'Days on Mkt'] },
  'cre-open-house':  { commercial: ['Date', 'Time', 'Building SF'], residential: ['Date', 'Time', 'Price'] },
  'cre-for-lease':   { commercial: ['Lease Rate', 'SF Available', 'NNN'], residential: ['Rent / mo', 'Beds', 'Baths'] },
  'cre-coming-soon': { commercial: ['Price', 'Building SF', 'Cap Rate'], residential: ['Price', 'Beds', 'Baths'] },
  'cre-stats':       { commercial: ['Avg Cap Rate', 'Price / Unit', 'Occupancy', 'Rent Growth'], residential: ['Median Price', 'Days on Mkt', 'Homes Sold', 'YoY Change'] },
  'cre-testimonial': { commercial: [], residential: [] },
  'cre-meet-agent':  { commercial: ['Years Exp.', 'Closed', 'Specialty'], residential: ['Years Exp.', 'Homes Sold', 'Specialty'] },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

async function init() {
  if (!$('g-canvas')) return;

  fillSelect($('g-template'), TEMPLATE_ORDER.map((id) => [id, TEMPLATES[id].name]));
  fillSelect($('g-theme'), THEME_ORDER.map((id) => [id, THEMES[id].label]));
  fillSelect($('g-size'), SIZE_ORDER.map((id) => [id, SIZES[id].label]));

  if (window.LOGO_ROUND_SUBMARK) { const img = new Image(); img.onload = () => { state.logo = img; preview(); }; img.src = window.LOGO_ROUND_SUBMARK; }

  // type toggle
  document.querySelectorAll('.g-type-btn').forEach((b) => b.addEventListener('click', () => {
    state.type = b.dataset.type;
    document.querySelectorAll('.g-type-btn').forEach((x) => x.classList.toggle('on', x === b));
    resetStatLabels(); preview();
  }));

  $('g-template').addEventListener('change', () => { $('g-kicker').value = KICKER[$('g-template').value] || ''; resetStatLabels(); preview(); });
  ['g-theme', 'g-size'].forEach((id) => $(id).addEventListener('change', preview));
  ['g-title', 'g-subtitle', 'g-kicker', 'g-brokerage', 'g-a1n', 'g-a1p', 'g-a2n', 'g-a2p']
    .forEach((id) => $(id) && $(id).addEventListener('input', debounce(preview, 200)));

  wireImage('g-photo', 'g-photo-clear', (img) => { state.photo = img; }, 'g-photo-label');
  wireImage('g-head1', 'g-head1-clear', (img) => { state.heads[0] = img; }, 'g-head1-label');
  wireImage('g-head2', 'g-head2-clear', (img) => { state.heads[1] = img; }, 'g-head2-label');

  $('g-download').addEventListener('click', () => doExport(false));
  $('g-download-all').addEventListener('click', () => doExport(true));
  $('g-cap-btn') && $('g-cap-btn').addEventListener('click', aiCaption);
  $('g-cap-copy') && $('g-cap-copy').addEventListener('click', () => {
    const t = $('g-cap-out'); t.select(); navigator.clipboard?.writeText(t.value).then(() => { $('g-cap-status').textContent = 'Copied!'; }).catch(() => {});
  });

  $('g-kicker').value = KICKER['cre-just-listed'];
  resetStatLabels();
  await loadFonts('');               // sharp, consistent type before first paint
  state.ready = true;
  preview();
}

function fillSelect(sel, pairs) {
  if (!sel) return; sel.innerHTML = '';
  pairs.forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); });
}

// Build the stat-input rows for the current template/type (value + label each).
function resetStatLabels() {
  const tpl = $('g-template').value;
  const labels = (STAT_LABELS[tpl] && STAT_LABELS[tpl][state.type]) || [];
  const wrap = $('g-stats'); wrap.innerHTML = '';
  labels.forEach((label) => {
    const row = document.createElement('div'); row.className = 'g-stat-row';
    row.innerHTML = `<input class="g-in g-sv" placeholder="Value (e.g. $6.2M)"><input class="g-in g-sl" value="${label}" placeholder="Label">`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('input').forEach((i) => i.addEventListener('input', debounce(preview, 200)));
}

function collectData() {
  const v = (id) => ($(id)?.value || '').trim();
  const stats = [...$('g-stats').querySelectorAll('.g-stat-row')]
    .map((r) => ({ value: r.querySelector('.g-sv').value.trim(), label: r.querySelector('.g-sl').value.trim() }))
    .filter((s) => s.value || s.label);
  const agents = [
    { name: v('g-a1n'), phone: v('g-a1p') },
    { name: v('g-a2n'), phone: v('g-a2p') },
  ].filter((a) => a.name);
  return { kicker: v('g-kicker'), title: v('g-title'), subtitle: v('g-subtitle'), stats, agents, brokerage: v('g-brokerage') || 'Gateway Real Estate Advisors' };
}

function currentOpts() {
  return {
    templateId: $('g-template').value, theme: $('g-theme').value, sizeId: $('g-size').value,
    data: collectData(),
    assets: { photo: state.photo, headshots: state.heads.filter(Boolean), logo: state.logo },
  };
}

function preview() {
  if (!state.ready) return;
  renderTemplate($('g-canvas'), currentOpts());
}

async function doExport(all) {
  const status = $('g-status'); status.textContent = all ? 'Building all sizes…' : 'Exporting…';
  const base = (collectData().title || 'gateway-graphic').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'graphic';
  try {
    if (all) await exportAllSocial(currentOpts(), base);
    else await exportPNG(currentOpts(), base);
    status.textContent = '✓ Downloaded';
  } catch (e) { status.textContent = 'Export failed: ' + (e.message || e); }
}

// ── AI caption + hashtags ────────────────────────────────────────────────────
async function aiCaption() {
  const btn = $('g-cap-btn'); const status = $('g-cap-status'); const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '✨ Writing…'; status.textContent = '';
  try {
    const photoDataUrl = state.photo ? toJpegDataUrl(state.photo, 640) : null;
    const text = await writeCaption({
      platform: $('g-cap-platform').value, type: state.type, data: collectData(), photoDataUrl,
    });
    $('g-cap-out').value = text;
    status.textContent = text ? 'Done — review & copy.' : 'No caption returned.';
  } catch (e) {
    const msg = (e && e.message) || 'failed';
    status.textContent = /too large|413|no image|received no image/i.test(msg)
      ? 'AI server needs updating (run “supabase functions deploy gateway-api”).'
      : msg;
  } finally { btn.disabled = false; btn.textContent = orig; }
}

function toJpegDataUrl(img, max) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  const s = Math.min(1, max / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.72);
}

// ── image upload (HTMLImageElement decode, downscale longest side to 1920) ───
function wireImage(inputId, clearId, set, labelId) {
  const inp = $(inputId); if (!inp) return;
  inp.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { set(await loadImage(f)); $(labelId).textContent = f.name; preview(); }
    catch { $(labelId).textContent = 'Could not read that image.'; }
  });
  $(clearId) && $(clearId).addEventListener('click', () => { set(null); inp.value = ''; $(labelId).textContent = ''; preview(); });
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = Math.max(img.naturalWidth, img.naturalHeight);
      if (!max) return reject(new Error('empty'));
      if (max <= 1920) return resolve(img);
      const s = 1920 / max, w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
