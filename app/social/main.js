// app/social/main.js
// UI controller for the Social & Mailer Graphics Generator.
//  - Dedicated templates (templates-v2.js) declare their own fields; this file
//    builds the form from that list. Simple values (address, city, price …) are
//    shared across templates, so switching Just Listed -> Under Contract keeps
//    what the agent already typed.
//  - Classic layouts keep the original generic headline + stat rows.
//  - Live canvas preview -> PNG / all-sizes zip export.

import { renderTemplate, TEMPLATE_ORDER, TEMPLATES, TEMPLATE_GROUPS, THEME_ORDER, THEMES, SIZES } from './renderer.js';
import { loadFonts } from './design-tokens.js';
import { exportPNG, exportAllSocial } from './export.js';
import { writeCaption } from './ai.js';
import { slugify } from './format.js';
import { formatFields, fmtPrice } from './templates-v2.js';

const $ = (id) => document.getElementById(id);
const state = {
  type: 'commercial', photo: null, photoLowRes: false, heads: [null, null],
  markLight: null, markDark: null, ready: false,
  values: {},            // dedicated-template field values (scalars shared by id)
};
const BROKERAGE = 'Gateway Real Estate Advisors';
const SIZE_ORDER = ['ig-portrait', 'square', 'story', 'linkedin', 'landscape', 'postcard-6x4'];
const CLASSIC_SIZES = ['ig-portrait', 'square', 'story', 'linkedin', 'postcard-6x4'];
// Property facts that carry over between dedicated templates (see key()).
const SHARED_FIELDS = new Set(['address', 'city', 'price', 'beds', 'baths', 'sf', 'propName', 'assetType', 'size', 'capRate']);

// Classic layouts: default kicker + stat labels per template, by property type.
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

  buildTemplatePicker();
  fillSelect($('g-theme'), THEME_ORDER.map((id) => [id, THEMES[id].label]));
  fillSelect($('g-size'), SIZE_ORDER.map((id) => [id, SIZES[id].label]));

  // Official horizontal lockups (assets/logos.js): white for dark themes, dark for light.
  const loadMark = (src, key) => { if (!src) return; const img = new Image(); img.onload = () => { state[key] = img; preview(); }; img.src = src; };
  loadMark(window.LOGO_PRIMARY_LIGHT, 'markLight');
  loadMark(window.LOGO_PRIMARY_DARK, 'markDark');

  // classic: property type toggle
  document.querySelectorAll('.g-type-btn').forEach((b) => b.addEventListener('click', () => {
    setType(b.dataset.type); resetStatLabels(); preview();
  }));

  $('g-template').addEventListener('change', () => { applyTemplate(); preview(); });
  ['g-theme', 'g-size'].forEach((id) => $(id).addEventListener('change', preview));
  ['g-title', 'g-city', 'g-subtitle', 'g-kicker', 'g-brokerage', 'g-a1n', 'g-a1t', 'g-a1p', 'g-a2n', 'g-a2t', 'g-a2p']
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

// Template picker grouped as Residential / Commercial / Brand / Classic.
function buildTemplatePicker() {
  const sel = $('g-template'); sel.innerHTML = '';
  TEMPLATE_GROUPS.forEach((g) => {
    const og = document.createElement('optgroup'); og.label = g;
    TEMPLATE_ORDER.filter((id) => TEMPLATES[id].group === g).forEach((id) => {
      const o = document.createElement('option'); o.value = id; o.textContent = TEMPLATES[id].name; og.appendChild(o);
    });
    if (og.children.length) sel.appendChild(og);
  });
  sel.value = TEMPLATE_ORDER[0];
}

function isDedicated(id) { return !!(TEMPLATES[id] && TEMPLATES[id].fields); }

// Show the right fields for the chosen template and apply its defaults so a
// template takes zero setup (e.g. Open House -> Residential, Slate, 1080×1350).
function applyTemplate() {
  const id = $('g-template').value;
  const tpl = TEMPLATES[id] || {};
  const dedicated = isDedicated(id);
  if (tpl.defaults) {
    if (tpl.defaults.type) setType(tpl.defaults.type);
    if (tpl.defaults.theme) $('g-theme').value = tpl.defaults.theme;
  }
  const sizes = tpl.sizes || CLASSIC_SIZES;
  const keep = $('g-size').value;
  fillSelect($('g-size'), sizes.map((k) => [k, SIZES[k].label]));
  $('g-size').value = sizes.includes(keep) ? keep : sizes[0];
  if (tpl.defaults && tpl.defaults.sizeId) $('g-size').value = tpl.defaults.sizeId;

  $('g-legacy').hidden = dedicated;
  $('g-fields').hidden = !dedicated;
  const note = $('g-tpl-note'); note.hidden = !tpl.note; note.textContent = tpl.note || '';

  // photo: required / optional / not used
  const photoMode = dedicated ? (tpl.photo || 'optional') : 'optional';
  $('g-photo-wrap').hidden = photoMode === 'none';
  $('g-photo-title').innerHTML = photoMode === 'required' ? 'Photo<span class="g-req">*</span>' : 'Photo (optional)';

  const brk = $('g-brokerage');
  if (dedicated) { brk.value = BROKERAGE; brk.readOnly = true; brk.title = 'Required on every graphic (Iowa 193E—10.1)'; }
  else { brk.readOnly = false; brk.title = ''; }

  if (dedicated) buildFields(tpl, id);
  else { $('g-fields').innerHTML = ''; $('g-kicker').value = KICKER[id] || ''; resetStatLabels(); }
}

function setType(type) {
  state.type = type;
  document.querySelectorAll('.g-type-btn').forEach((x) => x.classList.toggle('on', x.dataset.type === type));
}

function fillSelect(sel, pairs) {
  if (!sel) return; sel.innerHTML = '';
  pairs.forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); });
}

// ── Dedicated fields ─────────────────────────────────────────────────────────
// Property facts carry over between templates (Just Listed -> Under Contract
// keeps the address); everything else (status, labels, lists) is per template.
function key(tplId, fd) { return SHARED_FIELDS.has(fd.id) ? fd.id : `${tplId}:${fd.id}`; }

function buildFields(tpl, tplId) {
  const wrap = $('g-fields'); wrap.innerHTML = '';
  const onChange = debounce(preview, 150);
  let row = null;
  for (const fd of tpl.fields) {
    const k = key(tplId, fd);
    if (state.values[k] === undefined && fd.default !== undefined) state.values[k] = fd.default;
    const box = document.createElement('div');
    box.className = 'g-field'; box.dataset.field = fd.id;
    const lab = document.createElement('label'); lab.className = 'g-label';
    lab.innerHTML = esc(fd.label) + (fd.required ? '<span class="g-req">*</span>' : '');
    const inputId = `g-f-${fd.id}`;
    lab.htmlFor = inputId;
    if (fd.type !== 'checkbox') box.appendChild(lab);
    box.appendChild(fieldControl(fd, k, inputId, onChange));
    if (fd.note) { const n = document.createElement('div'); n.className = 'g-note'; n.style.marginTop = '-4px'; n.textContent = fd.note; box.appendChild(n); }
    // two half-width fields share a row
    if (fd.half) {
      if (row && row.children.length === 1) { row.appendChild(box); row = null; continue; }
      row = document.createElement('div'); row.className = 'g-row'; row.appendChild(box); wrap.appendChild(row); continue;
    }
    row = null; wrap.appendChild(box);
  }
}

function fieldControl(fd, k, inputId, onChange) {
  const v = state.values[k];
  const input = (type, val, ph) => {
    const el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') el.type = type;
    el.className = 'g-in'; el.value = val ?? ''; if (ph) el.placeholder = ph;
    if (type === 'textarea') { el.rows = 3; el.style.resize = 'vertical'; }
    return el;
  };
  switch (fd.type) {
    case 'segmented': {
      const seg = document.createElement('div'); seg.className = 'g-seg'; seg.id = inputId; seg.setAttribute('role', 'group');
      fd.options.forEach((opt) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = opt;
        b.classList.toggle('on', (v ?? fd.default) === opt); b.setAttribute('aria-pressed', String((v ?? fd.default) === opt));
        b.addEventListener('click', () => {
          state.values[k] = opt;
          seg.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
          preview();
        });
        seg.appendChild(b);
      });
      return seg;
    }
    case 'select': {
      const sel = document.createElement('select'); sel.className = 'g-in'; sel.id = inputId;
      fd.options.forEach((opt) => { const o = document.createElement('option'); o.value = opt; o.textContent = opt || '—'; sel.appendChild(o); });
      sel.value = v ?? ''; sel.addEventListener('change', () => { state.values[k] = sel.value; preview(); });
      return sel;
    }
    case 'checkbox': {
      const l = document.createElement('label'); l.className = 'g-check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = inputId; cb.checked = !!v;
      cb.addEventListener('change', () => { state.values[k] = cb.checked; preview(); });
      l.appendChild(cb); l.appendChild(document.createTextNode(fd.label)); return l;
    }
    case 'metrics': {
      const box = document.createElement('div'); box.id = inputId;
      const list = Array.isArray(v) ? v : (fd.defaults || []).map((key) => ({ key, value: '' }));
      state.values[k] = list;
      for (let i = 0; i < fd.count; i++) {
        const m = list[i] || (list[i] = { key: fd.options[i] || fd.options[0], value: '' });
        const r = document.createElement('div'); r.className = 'g-pair';
        const sel = document.createElement('select'); sel.className = 'g-in';
        fd.options.forEach((opt) => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o); });
        sel.value = m.key; sel.setAttribute('aria-label', `Figure ${i + 1} type`);
        const val = input('text', m.value, 'Value'); val.setAttribute('aria-label', `Figure ${i + 1} value`);
        sel.addEventListener('change', () => { m.key = sel.value; preview(); });
        val.addEventListener('input', () => { m.value = val.value; onChange(); });
        r.appendChild(sel); r.appendChild(val); box.appendChild(r);
      }
      return box;
    }
    case 'pairs': {
      const box = document.createElement('div'); box.id = inputId;
      const list = Array.isArray(v) ? v : Array.from({ length: fd.count }, () => ({ value: '', label: '' }));
      state.values[k] = list;
      for (let i = 0; i < fd.count; i++) {
        const p = list[i] || (list[i] = { value: '', label: '' });
        const ph = (fd.placeholders || [])[i] || ['Value', 'Label'];
        const r = document.createElement('div'); r.className = 'g-pair';
        const val = input('text', p.value, ph[0]); val.setAttribute('aria-label', `Figure ${i + 1} value`);
        const labl = input('text', p.label, ph[1]); labl.setAttribute('aria-label', `Figure ${i + 1} label`);
        val.addEventListener('input', () => { p.value = val.value; onChange(); });
        labl.addEventListener('input', () => { p.label = labl.value; onChange(); });
        r.appendChild(val); r.appendChild(labl); box.appendChild(r);
      }
      return box;
    }
    default: {
      const type = { date: 'date', time: 'time', textarea: 'textarea' }[fd.type] || 'text';
      const el = input(type, v, fd.placeholder); el.id = inputId;
      if (fd.type === 'time') el.step = 900;
      if (['price', 'sf', 'pct'].includes(fd.type)) el.inputMode = 'decimal';
      if (fd.type === 'price') el.addEventListener('blur', () => { if (el.value) { el.value = fmtPrice(el.value); state.values[k] = el.value; preview(); } });
      el.addEventListener(type === 'date' || type === 'time' ? 'change' : 'input', () => { state.values[k] = el.value; el.classList.remove('g-missing'); onChange(); });
      if (type === 'date' || type === 'time') el.addEventListener('input', () => { state.values[k] = el.value; onChange(); });
      return el;
    }
  }
}

function dedicatedValues(tplId) {
  const tpl = TEMPLATES[tplId]; const raw = {};
  for (const fd of tpl.fields) {
    const v = state.values[key(tplId, fd)];
    raw[fd.id] = typeof v === 'string' ? v.trim() : v;
  }
  return formatFields(tpl, raw);
}

// Required fields (and photo) still empty for the current template.
function missingRequired() {
  const id = $('g-template').value, tpl = TEMPLATES[id];
  if (!isDedicated(id)) return [];
  const miss = [];
  if (tpl.photo === 'required' && !state.photo) miss.push({ id: 'photo', label: 'Photo' });
  for (const fd of tpl.fields) {
    if (!fd.required) continue;
    const v = state.values[key(id, fd)];
    if (v === undefined || v === null || String(v).trim() === '') miss.push({ id: fd.id, label: fd.label.replace(/\s*\(.*\)$/, '') });
  }
  return miss;
}

// ── Classic stat rows ────────────────────────────────────────────────────────
function resetStatLabels() {
  const tpl = $('g-template').value;
  const labels = (STAT_LABELS[tpl] && STAT_LABELS[tpl][state.type]) || [];
  const wrap = $('g-stats'); wrap.innerHTML = '';
  labels.forEach((label) => {
    const row = document.createElement('div'); row.className = 'g-stat-row';
    row.innerHTML = `<input class="g-in g-sv" placeholder="Value (e.g. $6.2M)"><input class="g-in g-sl" value="${esc(label)}" placeholder="Label">`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('input').forEach((i) => i.addEventListener('input', debounce(preview, 200)));
}

function collectData() {
  const v = (id) => ($(id)?.value || '').trim();
  const agents = [
    { name: v('g-a1n'), title: v('g-a1t'), phone: v('g-a1p') },
    { name: v('g-a2n'), title: v('g-a2t'), phone: v('g-a2p') },
  ].filter((a) => a.name);
  const id = $('g-template').value;
  if (isDedicated(id)) return { ...dedicatedValues(id), agents, brokerage: BROKERAGE };
  const stats = [...$('g-stats').querySelectorAll('.g-stat-row')]
    .map((r) => ({ value: r.querySelector('.g-sv').value.trim(), label: r.querySelector('.g-sl').value.trim() }))
    .filter((s) => s.value || s.label);
  return { kicker: v('g-kicker'), title: v('g-title'), city: v('g-city'), subtitle: v('g-subtitle'), stats, agents, brokerage: v('g-brokerage') || BROKERAGE };
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
  const opts = currentOpts();
  if (TEMPLATES[opts.templateId] && TEMPLATES[opts.templateId].photo === 'none') opts.assets.photo = null;
  renderTemplate($('g-canvas'), opts);
}

// File-name subject: the address / property / market / reviewer.
function subjectOf(d) {
  return d.address || d.propName || d.market || d.title || d.reviewer || (d.agents && d.agents[0] && d.agents[0].name) || 'graphic';
}

async function doExport(all) {
  const status = $('g-status');
  document.querySelectorAll('#g-fields .g-missing').forEach((el) => el.classList.remove('g-missing'));
  const miss = missingRequired();
  if (miss.length) {
    status.textContent = 'Still needed: ' + miss.map((m) => m.label).join(', ') + '.';
    miss.forEach((m) => { const el = m.id === 'photo' ? $('g-photo') : $('g-f-' + m.id); el && el.classList.add('g-missing'); });
    const first = miss[0].id === 'photo' ? $('g-photo') : $('g-f-' + miss[0].id);
    first && first.focus();
    return;
  }
  status.textContent = all ? 'Building all sizes…' : 'Exporting…';
  const opts = currentOpts();
  if (TEMPLATES[opts.templateId].photo === 'none') opts.assets.photo = null;
  // gateway_<template>_<subject>  (+ _<W>x<H>.png added per size)
  const tplSlug = TEMPLATES[opts.templateId].classic ? opts.templateId + '-classic' : opts.templateId;
  const base = `gateway_${tplSlug}_${slugify(subjectOf(opts.data), 'graphic')}`;
  const sizes = (TEMPLATES[opts.templateId] || {}).sizes;
  try {
    if (all) await exportAllSocial(opts, base, sizes);
    else await exportPNG(opts, base);
    status.textContent = '✓ Downloaded' + (state.photoLowRes && opts.assets.photo ? ' — note: photo is low-res' : '');
  } catch (e) { status.textContent = 'Export failed: ' + (e.message || e); }
}

// ── AI caption + hashtags ────────────────────────────────────────────────────
// Facts sent to the caption writer: the filled-in fields, labelled.
function captionFacts() {
  const id = $('g-template').value, tpl = TEMPLATES[id], d = collectData();
  if (!isDedicated(id)) return null;
  const lines = [`Post type: ${tpl.name}${d.status ? ' (' + d.status + ')' : ''}`];
  for (const fd of tpl.fields) {
    const v = d[fd.id];
    if (fd.type === 'metrics' || fd.type === 'pairs') {
      const list = (v || []).filter((m) => m && String(m.value || '').trim());
      if (list.length) lines.push(`${fd.label.replace(/\s*\(.*\)$/, '')}: ` + list.map((m) => `${m.value} ${m.label || ''}`.trim()).join(', '));
    } else if (fd.type === 'checkbox') { if (v) lines.push(fd.label.replace(/[“”]/g, '')); }
    else if (v && fd.id !== 'status') lines.push(`${fd.label.replace(/\s*\(.*\)$/, '')}: ${v}`);
  }
  if (d.agents.length) lines.push('Agent(s): ' + d.agents.map((a) => a.name).join(' & '));
  lines.push('Brokerage: ' + BROKERAGE);
  return lines.join('\n');
}

async function aiCaption() {
  const btn = $('g-cap-btn'); const status = $('g-cap-status'); const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '✨ Writing…'; status.textContent = '';
  try {
    const usePhoto = state.photo && TEMPLATES[$('g-template').value].photo !== 'none';
    const photoDataUrl = usePhoto ? toJpegDataUrl(state.photo, 640) : null;
    const tpl = TEMPLATES[$('g-template').value];
    const type = !isDedicated($('g-template').value) ? state.type
      : ({ Residential: 'residential', 'Commercial / Investment': 'commercial investment', Brand: 'agent brand' })[tpl.group] || 'real estate';
    const text = await writeCaption({
      platform: $('g-cap-platform').value, type, data: collectData(), facts: captionFacts(), photoDataUrl,
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

// ── image upload (HTMLImageElement decode; keep short side <= 1920) ──────────
function wireImage(inputId, clearId, set, labelId) {
  const inp = $(inputId); if (!inp) return;
  inp.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const img = await loadImage(f); set(img, img.__natural); $(labelId).textContent = f.name; inp.classList.remove('g-missing'); preview(); }
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

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
