// app/social/main.js
// UI controller for the Social & Mailer Graphics Generator. Fields + photo +
// up to two agents -> live canvas preview -> PNG / all-sizes export. Templates
// adapt to residential vs commercial via the stat presets.

import { renderTemplate, TEMPLATE_ORDER, TEMPLATES, THEME_ORDER, THEMES, SIZES } from './renderer.js';
import { loadFonts } from './design-tokens.js';
import { exportPNG, exportAllSocial } from './export.js';
import { writeCaption } from './ai.js';
import { slugify } from './format.js';

const $ = (id) => document.getElementById(id);
const state = { type: 'commercial', photo: null, photoLowRes: false, heads: [null, null], markLight: null, markDark: null, ready: false };
const BROKERAGE = 'Gateway Real Estate Advisors';

const SIZE_ORDER = ['ig-portrait', 'square', 'story', 'linkedin', 'landscape', 'postcard-6x4'];

// Default kicker + stat labels per template, by property type. Values start
// empty; the agent fills them. Switching template/type resets the labels.
const KICKER = {
  'open-house': 'Open House',
  'cre-just-listed': 'For Sale', 'cre-just-closed': 'Just Closed', 'cre-open-house': 'Open House',
  'cre-for-lease': 'For Lease', 'cre-coming-soon': 'Coming Soon', 'cre-stats': 'By the Numbers',
  'cre-testimonial': 'Client Review', 'cre-meet-agent': 'Meet Your Advisor',
};
const STAT_LABELS = {
  'open-house':      { commercial: [], residential: [] },   // dedicated fields instead
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

  // Official horizontal lockups (assets/logos.js): white for dark themes, dark for light.
  const loadMark = (src, key) => { if (!src) return; const img = new Image(); img.onload = () => { state[key] = img; preview(); }; img.src = src; };
  loadMark(window.LOGO_PRIMARY_LIGHT, 'markLight');
  loadMark(window.LOGO_PRIMARY_DARK, 'markDark');

  // type toggle
  document.querySelectorAll('.g-type-btn').forEach((b) => b.addEventListener('click', () => {
    state.type = b.dataset.type;
    document.querySelectorAll('.g-type-btn').forEach((x) => x.classList.toggle('on', x === b));
    resetStatLabels(); preview();
  }));

  $('g-template').addEventListener('change', () => { applyTemplate(); preview(); });
  ['g-theme', 'g-size'].forEach((id) => $(id).addEventListener('change', preview));
  ['g-oh-date', 'g-oh-start', 'g-oh-end'].forEach((id) => $(id) && $(id).addEventListener('change', preview));
  ['g-title', 'g-city', 'g-subtitle', 'g-kicker', 'g-brokerage', 'g-a1n', 'g-a1t', 'g-a1p', 'g-a2n', 'g-a2t', 'g-a2p', 'g-oh-price']
    .forEach((id) => $(id) && $(id).addEventListener('input', debounce(preview, 200)));

  wireImage('g-photo', 'g-photo-clear', (img, natural) => {
    state.photo = img;
    // Low-res check on the ORIGINAL pixels (before any downscale): short side < 1080.
    state.photoLowRes = !!(img && natural && Math.min(natural.w, natural.h) < 1080);
    const warn = $('g-photo-warn');
    if (warn) {
      warn.hidden = !state.photoLowRes;
      warn.textContent = state.photoLowRes ? `⚠ Low-res photo (${natural.w}×${natural.h}). Use one at least 1080px on the short side so it stays sharp.` : '';
    }
  }, 'g-photo-label');
  wireImage('g-head1', 'g-head1-clear', (img) => { state.heads[0] = img; }, 'g-head1-label');
  wireImage('g-head2', 'g-head2-clear', (img) => { state.heads[1] = img; }, 'g-head2-label');

  $('g-download').addEventListener('click', () => doExport(false));
  $('g-download-all').addEventListener('click', () => doExport(true));
  $('g-cap-btn') && $('g-cap-btn').addEventListener('click', aiCaption);
  $('g-cap-copy') && $('g-cap-copy').addEventListener('click', () => {
    const t = $('g-cap-out'); t.select(); navigator.clipboard?.writeText(t.value).then(() => { $('g-cap-status').textContent = 'Copied!'; }).catch(() => {});
  });

  applyTemplate();
  await loadFonts('');               // sharp, consistent type before first paint
  state.ready = true;
  preview();
}

// Show the right fields for the chosen template and apply its defaults
// (Open House -> Residential, Slate, 1080×1350) so it takes zero setup.
function applyTemplate() {
  const id = $('g-template').value;
  const tpl = TEMPLATES[id] || {};
  const dedicated = id === 'open-house';
  if (tpl.defaults) {
    if (tpl.defaults.type) setType(tpl.defaults.type);
    if (tpl.defaults.theme) $('g-theme').value = tpl.defaults.theme;
  }
  // sizes this template supports
  const sizes = tpl.sizes || SIZE_ORDER.filter((k) => k !== 'landscape');
  const keep = $('g-size').value;
  fillSelect($('g-size'), sizes.map((k) => [k, `${SIZES[k].label}`]));
  $('g-size').value = sizes.includes(keep) ? keep : sizes[0];
  if (tpl.defaults && tpl.defaults.sizeId) $('g-size').value = tpl.defaults.sizeId;

  $('g-oh').hidden = !dedicated;
  $('g-generic-text').hidden = dedicated;
  $('g-stats-wrap').hidden = dedicated;
  $('g-title-label').textContent = dedicated ? 'Address' : 'Headline';
  $('g-title').placeholder = dedicated ? '123 Example St' : '2600 Dodge Street';
  $('g-city').placeholder = dedicated ? 'City, State ZIP — Sioux City, IA 51106' : 'City, State — Sioux City, IA';
  const brk = $('g-brokerage');
  if (dedicated) { brk.value = BROKERAGE; brk.readOnly = true; brk.title = 'Required on every graphic (Iowa 193E—10.1)'; }
  else { brk.readOnly = false; brk.title = ''; }
  $('g-kicker').value = KICKER[id] || '';
  resetStatLabels();
}

function setType(type) {
  state.type = type;
  document.querySelectorAll('.g-type-btn').forEach((x) => x.classList.toggle('on', x.dataset.type === type));
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
    { name: v('g-a1n'), title: v('g-a1t'), phone: v('g-a1p') },
    { name: v('g-a2n'), title: v('g-a2t'), phone: v('g-a2p') },
  ].filter((a) => a.name);
  const base = { kicker: v('g-kicker'), title: v('g-title'), city: v('g-city'), subtitle: v('g-subtitle'), stats, agents, brokerage: v('g-brokerage') || BROKERAGE };
  if ($('g-template').value === 'open-house') {
    return { ...base, address: v('g-title'), date: v('g-oh-date'), start: v('g-oh-start'), end: v('g-oh-end'), price: formatPrice(v('g-oh-price')), brokerage: BROKERAGE };
  }
  return base;
}

// '184900' -> '$184,900'; anything already formatted is left alone.
function formatPrice(p) {
  if (!p) return '';
  if (/^\d+$/.test(p.replace(/[,\s]/g, ''))) return '$' + Number(p.replace(/[,\s]/g, '')).toLocaleString('en-US');
  return p;
}

function currentOpts() {
  return {
    templateId: $('g-template').value, theme: $('g-theme').value, sizeId: $('g-size').value,
    data: collectData(),
    assets: { photo: state.photo, headshots: state.heads.filter(Boolean), markLight: state.markLight, markDark: state.markDark },
  };
}

function preview() {
  if (!state.ready) return;
  renderTemplate($('g-canvas'), currentOpts());
}

async function doExport(all) {
  const status = $('g-status');
  if ($('g-template').value === 'open-house' && !state.photo) { status.textContent = 'Add a listing photo first — it is required for Open House.'; $('g-photo').focus(); return; }
  status.textContent = all ? 'Building all sizes…' : 'Exporting…';
  // gateway_<template>_<address-slug>  (+ _<W>x<H>.png added per size)
  const tplSlug = $('g-template').value.replace(/^cre-/, '');
  const base = `gateway_${tplSlug}_${slugify(collectData().title, 'graphic')}`;
  const sizes = (TEMPLATES[$('g-template').value] || {}).sizes;
  try {
    if (all) await exportAllSocial(currentOpts(), base, sizes);
    else await exportPNG(currentOpts(), base);
    status.textContent = '✓ Downloaded' + (state.photoLowRes ? ' — note: photo is low-res' : '');
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
    try { const img = await loadImage(f); set(img, img.__natural); $(labelId).textContent = f.name; preview(); }
    catch { $(labelId).textContent = 'Could not read that image.'; }
  });
  $(clearId) && $(clearId).addEventListener('click', () => { set(null, null); inp.value = ''; $(labelId).textContent = ''; preview(); });
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = Math.max(img.naturalWidth, img.naturalHeight);
      if (!max) return reject(new Error('empty'));
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      // Keep the short side >= 1920 so the largest export (1080×1920 story) is never upscaled.
      const short = Math.min(natural.w, natural.h);
      if (short <= 1920) { img.__natural = natural; return resolve(img); }
      const s = 1920 / short, w = Math.round(natural.w * s), h = Math.round(natural.h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h); c.__natural = natural; resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
