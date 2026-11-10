// app/social/templates-v2.js
// Dedicated Graphics templates. Each entry declares its own form fields (the
// UI is built from `fields`), its picker group, sizes and defaults, and a
// render() that paints with the shared layout engine in stack.js.
//
// Rules every template follows (see docs/TOOLKIT_AUDIT_2026-11.md quality bar):
//  - hierarchy: status label → address/name → key numbers → agent + brokerage
//  - the brokerage name "Gateway Real Estate Advisors" is always printed next
//    to the agent name(s); the Gateway lockup is always visible
//  - blank optional fields are dropped with no empty gaps
//  - no emoji, no badges, no canned superlatives

import { setFont, vGradient, hairline, kicker, wrapFit, drawBlock, circleImage, fitLine } from './draw.js';
import {
  BROKERAGE, MIN_PX, resetSpacing, frameFor, listingStack, statusLabel, drawSubLine, keyRow, keyList,
  footerPlan, agentFooter, markFor, drawMark, MARK_GATEWAY_RATIO,
} from './stack.js';
import { formatEventDate, formatTimeRange } from './format.js';

export const LISTING_SIZES = ['ig-portrait', 'square', 'story', 'landscape'];

// ── Field formatting (shared with the form controller) ──────────────────────
const digits = (v) => String(v || '').replace(/[,\s$]/g, '');
const isNum = (v) => /^\d+(\.\d+)?$/.test(digits(v));
export function fmtPrice(v) {
  v = String(v || '').trim(); if (!v) return '';
  return isNum(v) ? '$' + Number(digits(v)).toLocaleString('en-US', { maximumFractionDigits: 2 }) : v;
}
export function fmtSF(v) {
  v = String(v || '').trim(); if (!v) return '';
  return isNum(v) ? Number(digits(v)).toLocaleString('en-US') + ' SF' : v;
}
function fmtPct(v) { v = String(v || '').trim(); if (!v) return ''; return isNum(v) ? digits(v) + '%' : v; }
function fmtInt(v) { v = String(v || '').trim(); if (!v) return ''; return isNum(v) ? Number(digits(v)).toLocaleString('en-US') : v; }
function fmtPerSF(v) { v = String(v || '').trim(); if (!v) return ''; return isNum(v) ? '$' + Number(digits(v)).toFixed(2) : v; }

// Commercial metric menu (Just Listed – Offering). key -> { label, format }
export const CRE_METRICS = {
  'Price':          { label: 'Price', fmt: fmtPrice },
  'Units':          { label: 'Units', fmt: fmtInt },
  'Price/Unit':     { label: 'Price / Unit', fmt: fmtPrice },
  'Cap Rate':       { label: 'Cap Rate', fmt: fmtPct },
  'NOI':            { label: 'NOI', fmt: fmtPrice },
  'Building SF':    { label: 'Building SF', fmt: fmtSF },
  'Price/SF':       { label: 'Price / SF', fmt: fmtPerSF },
  'Occupancy':      { label: 'Occupancy', fmt: fmtPct },
  'Year Built':     { label: 'Year Built', fmt: (v) => String(v || '').trim() },
  'Lease Rate/NNN': { label: 'Lease Rate', fmt: (v) => String(v || '').trim() },
};

const REPRESENTED = {
  Seller: 'Represented the Seller', Buyer: 'Represented the Buyer',
  Both: 'Represented the Buyer & Seller', None: '',
};
const ASSET_TYPES = ['', 'Multifamily', 'Retail', 'Office', 'Industrial', 'Mixed-Use', 'Medical Office', 'Self-Storage', 'Hospitality', 'Land', 'Other'];

// Field building blocks
const F = {
  address: { id: 'address', label: 'Street address', type: 'text', placeholder: '123 Example St', required: true },
  city:    { id: 'city', label: 'City, State ZIP', type: 'text', placeholder: 'Sioux City, IA 51106' },
  price:   { id: 'price', label: 'Price', type: 'price', placeholder: '$184,900', half: true },
  beds:    { id: 'beds', label: 'Beds', type: 'text', placeholder: '3', half: true, small: true },
  baths:   { id: 'baths', label: 'Baths', type: 'text', placeholder: '2', half: true, small: true },
  sf:      { id: 'sf', label: 'Square feet', type: 'sf', placeholder: '1,450', half: true },
  represented: { id: 'represented', label: 'Represented', type: 'segmented', options: ['Seller', 'Buyer', 'Both', 'None'], default: 'Seller' },
  propName: { id: 'propName', label: 'Property name', type: 'text', placeholder: 'Example Apartments', required: true },
  assetType: { id: 'assetType', label: 'Asset type', type: 'select', options: ASSET_TYPES, half: true },
  size:    { id: 'size', label: 'Units or size', type: 'text', placeholder: '24 Units  ·  or  48,000 SF', half: true },
};

const priceIdx = (label) => (items) => items.findIndex((it) => it.label === label);

// ════════════════════════════════════════════════════════════════════════════
// RESIDENTIAL
// ════════════════════════════════════════════════════════════════════════════

function openHouse(ctx, W, H, d, theme, assets) {
  listingStack(ctx, W, H, d, theme, assets, {
    label: 'Open House',
    row: [
      { value: d.dateText || formatEventDate(d.date), label: 'Date' },
      { value: d.timeText || formatTimeRange(d.start, d.end), label: 'Time' },
      { value: d.price, label: 'Price' },
    ],
    emphasis: priceIdx('Price'),
  });
}

// Just Listed / Coming Soon — same anatomy as Open House. A blank price is
// simply dropped (common for Coming Soon).
function justListed(ctx, W, H, d, theme, assets) {
  listingStack(ctx, W, H, d, theme, assets, {
    label: d.status || 'Just Listed',
    lines: [{ text: d.city, kind: 'city' }, { text: d.sf, kind: 'meta' }],
    row: [{ value: d.price, label: 'Price' }, { value: d.beds, label: 'Beds' }, { value: d.baths, label: 'Baths' }],
    emphasis: priceIdx('Price'),
  });
}

function underContract(ctx, W, H, d, theme, assets) {
  listingStack(ctx, W, H, d, theme, assets, {
    label: d.status || 'Under Contract',
    lines: [{ text: d.city, kind: 'city' }, { text: d.sf, kind: 'meta' }],
    row: [{ value: d.price, label: 'Price' }, { value: d.beds, label: 'Beds' }, { value: d.baths, label: 'Baths' }],
    emphasis: priceIdx('Price'),
  });
}

function justSold(ctx, W, H, d, theme, assets) {
  listingStack(ctx, W, H, d, theme, assets, {
    label: 'Just Sold',
    lines: [{ text: d.city, kind: 'city' }, { text: REPRESENTED[d.represented] || '', kind: 'caps' }],
    row: [{ value: d.price, label: 'Sale Price' }, { value: d.beds, label: 'Beds' }, { value: d.baths, label: 'Baths' }],
    emphasis: priceIdx('Sale Price'),
  });
}

function priceImprovement(ctx, W, H, d, theme, assets) {
  const hasOld = String(d.oldPrice || '').trim() && String(d.price || '').trim();
  listingStack(ctx, W, H, d, theme, assets, {
    label: 'Price Improvement',
    lines: [{ text: d.city, kind: 'city' }, { text: d.sf, kind: 'meta' }],
    row: [
      hasOld ? { value: d.oldPrice, label: 'Was', strike: true } : null,
      { value: d.price, label: hasOld ? 'Now' : 'Price' },
      { value: d.beds, label: 'Beds' }, { value: d.baths, label: 'Baths' },
    ],
    emphasis: (items) => items.findIndex((it) => it.label === 'Now' || it.label === 'Price'),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// COMMERCIAL / INVESTMENT
// ════════════════════════════════════════════════════════════════════════════

// JUST LISTED | <Property Name> | <Units> Units | <City, ST>
function creOffering(ctx, W, H, d, theme, assets) {
  const status = d.status || 'Just Listed';
  const label = [status, d.assetType].filter(Boolean).join('  ·  ');
  const headline = d.propName || d.address;
  listingStack(ctx, W, H, d, theme, assets, {
    label, headline,
    lines: [
      { text: [d.size, d.city].filter(Boolean).join('  |  '), kind: 'city' },
      { text: d.propName ? d.address : '', kind: 'meta' },
      { text: d.om ? 'Offering Memorandum available' : '', kind: 'caps' },
    ],
    row: (d.metrics || []).slice(0, 4).map((m) => ({ value: m.value, label: m.label })),
    uniform: true,
  });
}

// Just Closed – deal tombstone. With a photo: photo-led stack. Without: a
// large-type navy card in the institutional tombstone style.
function creTombstone(ctx, W, H, d, theme, assets) {
  const label = d.status || 'Just Closed';
  const row = [{ value: d.price, label: 'Sale Price' }, { value: d.capRate, label: 'Cap Rate' }];
  const rep = REPRESENTED[d.represented] || '';
  if (assets.photo) {
    listingStack(ctx, W, H, d, theme, assets, {
      label: [label, d.assetType].filter(Boolean).join('  ·  '), headline: d.propName || 'Property Name',
      lines: [{ text: [d.size, d.city].filter(Boolean).join('  |  '), kind: 'city' }, { text: rep, kind: 'caps' }],
      row, uniform: true,
    });
    return;
  }
  card(ctx, W, H, d, theme, assets, (c) => {
    const items = row.filter((it) => String(it.value || '').trim());
    // build the centred stack as measured blocks so it can be fit + centred
    const blocks = (u) => {
      const w = c.x1 - c.x0, out = [];
      out.push({ h: u * 0.03, draw: (y) => statusLabel(ctx, (c.x0 + c.x1) / 2, y + u * 0.03, u, label, theme, 'center') });
      if (d.assetType) out.push({ gap: u * 0.05, h: u * 0.022, draw: (y) => drawSubLine(ctx, { text: d.assetType, kind: 'caps' }, (c.x0 + c.x1) / 2, y + u * 0.02, w, u, theme, 'center') });
      const nm = wrapFit(ctx, d.propName || 'Property Name', w * 0.92, u * 0.085, 800, 3, u * 0.05, 1.1);
      const nmH = nm.px + (nm.lines.length - 1) * nm.lineHeight;
      out.push({ gap: u * 0.05, h: nmH, draw: (y) => centredBlock(ctx, nm, (c.x0 + c.x1) / 2, y, theme.ink) });
      const sub = [d.size, d.city].filter(Boolean).join('  |  ');
      if (sub) out.push({ gap: u * 0.035, h: u * 0.03, draw: (y) => drawSubLine(ctx, { text: sub, kind: 'city' }, (c.x0 + c.x1) / 2, y + u * 0.028, w, u, theme, 'center') });
      if (items.length) {
        out.push({ gap: u * 0.06, h: 2, draw: (y) => hairline(ctx, (c.x0 + c.x1) / 2 - w * 0.18, y, (c.x0 + c.x1) / 2 + w * 0.18, y, theme.hairline, Math.max(1, u / 540)) });
        const rw = Math.min(w, items.length * w * 0.36);
        const rf = { u, x0: (c.x0 + c.x1) / 2 - rw / 2, x1: (c.x0 + c.x1) / 2 + rw / 2 };
        out.push({ gap: u * 0.065, h: u * 0.058 + u * 0.05, draw: (y) => keyRow(ctx, rf, y + u * 0.058, items, theme, -1, true) });
      }
      if (rep) out.push({ gap: u * 0.045, h: u * 0.02, draw: (y) => drawSubLine(ctx, { text: rep, kind: 'caps' }, (c.x0 + c.x1) / 2, y + u * 0.018, w, u, theme, 'center') });
      return out;
    };
    if (!c.landscape) { layoutCentered(c, blocks, true); return; }
    // landscape: name block left, figures + represented line right
    const mid = c.x0 + (c.x1 - c.x0) * 0.54;
    const left = (u) => {
      const w = mid - c.x0 - u * 0.04, out = [];
      out.push({ h: u * 0.03, draw: (y) => statusLabel(ctx, c.x0, y + u * 0.03, u, label, theme, 'left', w) });
      if (d.assetType) out.push({ gap: u * 0.045, h: u * 0.022, draw: (y) => drawSubLine(ctx, { text: d.assetType, kind: 'caps' }, c.x0, y + u * 0.02, w, u, theme) });
      const nm = wrapFit(ctx, d.propName || 'Property Name', w, u * 0.07, 800, 3, u * 0.045, 1.1);
      out.push({ gap: u * 0.04, h: nm.px + (nm.lines.length - 1) * nm.lineHeight, draw: (y) => drawBlock(ctx, nm.lines, c.x0, y, nm.px, nm.lineHeight, 800, theme.ink) });
      const sub = [d.size, d.city].filter(Boolean).join('  |  ');
      if (sub) out.push({ gap: u * 0.035, h: u * 0.03, draw: (y) => drawSubLine(ctx, { text: sub, kind: 'city' }, c.x0, y + u * 0.028, w, u, theme) });
      return out;
    };
    const right = (u) => {
      const out = [], rf = { u, x0: mid + u * 0.02, x1: c.x1 };
      if (items.length) out.push({ h: u * 0.058 + u * 0.05, draw: (y) => keyRow(ctx, rf, y + u * 0.058, items, theme, -1, true) });
      if (rep) out.push({ gap: u * 0.05, h: u * 0.02, draw: (y) => drawSubLine(ctx, { text: rep, kind: 'caps' }, (rf.x0 + rf.x1) / 2, y + u * 0.018, rf.x1 - rf.x0, u, theme, 'center') });
      return out;
    };
    hairline(ctx, mid, c.top + (c.bodyBottom - c.top) * 0.15, mid, c.bodyBottom - (c.bodyBottom - c.top) * 0.15, theme.hairline, Math.max(1, c.u / 540));
    layoutCentered({ ...c, x1: mid }, left, true);
    if (items.length || rep) layoutCentered({ ...c, x0: mid }, right, true);
  });
}

// Market Snapshot — 4 metrics + a required source line.
function marketSnapshot(ctx, W, H, d, theme, assets) {
  card(ctx, W, H, d, theme, assets, (c) => {
    const { u } = c;
    // institutional corner brackets (top only — the bottom right holds the lockup)
    const bl = u * 0.055;
    ctx.strokeStyle = theme.hairline; ctx.lineWidth = Math.max(1, u / 540);
    ctx.beginPath(); ctx.moveTo(c.x0, c.top + bl); ctx.lineTo(c.x0, c.top); ctx.lineTo(c.x0 + bl * 1.4, c.top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x1, c.top + bl); ctx.lineTo(c.x1, c.top); ctx.lineTo(c.x1 - bl * 1.4, c.top); ctx.stroke();

    const metrics = (d.pairs || []).filter((p) => String(p.value || '').trim()).slice(0, 4);
    const label = ['Market Snapshot', d.period].filter(Boolean).join('  ·  ');
    const source = d.source ? `Source: ${d.source}${(d.sourceDate || d.period) ? ', ' + (d.sourceDate || d.period) : ''}` : 'Source required';

    // label + market name; returns the bottom y. `tight` = smaller/2-line headline
    // (used when a long name would squeeze the figure grid).
    const headFit = (x0, x1, tight) => wrapFit(ctx, d.market || 'Market Name', x1 - x0, u * (tight ? 0.052 : 0.066), 800, tight ? 2 : 3, u * 0.036);
    const headBottom = (y0, hl) => y0 + u * 0.075 + u * 0.03 + hl.px + (hl.lines.length - 1) * hl.lineHeight;
    const head = (x0, x1, y0, hl) => {
      const y = y0 + u * 0.075;
      statusLabel(ctx, x0, y, u, label, theme, 'left', x1 - x0);
      return drawBlock(ctx, hl.lines, x0, y + u * 0.03, hl.px, hl.lineHeight, 800, theme.ink);
    };
    const grid = (x0, x1, top, bottom) => {
      if (!metrics.length) return;
      const cols = metrics.length === 1 ? 1 : 2, rows = Math.ceil(metrics.length / cols);
      // few figures: a compact block centred in the space; one figure becomes a hero number
      const want = rows * u * (metrics.length === 1 ? 0.42 : metrics.length === 2 ? 0.3 : 0.24);
      if (bottom - top > want) { const mid = (top + bottom) / 2; top = mid - want / 2; bottom = mid + want / 2; }
      const cw = (x1 - x0) / cols, rh = (bottom - top) / rows;
      // label block height (up to 2 lines) is reserved first, so dividers never cross labels
      const lp = Math.max(u * 0.017, MIN_PX), labBlock = lp * 2.2 + lp * 1.3 + lp * 0.6;
      const vmax = metrics.length === 1 ? 0.2 : metrics.length === 2 ? 0.13 : 0.095;
      // one value size for the whole grid: the largest that fits every cell
      let vpx = Math.max(6, Math.min(u * vmax, rh * 0.42, (rh * 0.84 - labBlock) / 0.95)); setFont(ctx, vpx, 800);
      while (metrics.some((m) => ctx.measureText(String(m.value)).width > cw * 0.84) && vpx > 6) { vpx -= 1; setFont(ctx, vpx, 800); }
      let lpx = Math.max(u * 0.017, MIN_PX); const lsp = 2 * u / 1080;
      setFont(ctx, lpx, 600, lsp);
      while (metrics.some((m) => ctx.measureText(String(m.label || '').toUpperCase()).width > cw * 0.9) && lpx - 1 >= MIN_PX) { lpx -= 1; setFont(ctx, lpx, 600, lsp); }
      const wrapLab = (t) => {               // still too wide at the floor: two lines
        t = String(t || '').toUpperCase(); if (ctx.measureText(t).width <= cw * 0.9) return [t];
        const ws = t.split(/\s+/); let a = '';
        while (ws.length && ctx.measureText(a ? a + ' ' + ws[0] : ws[0]).width <= cw * 0.9) a = a ? a + ' ' + ws.shift() : ws.shift();
        return [a, ws.join(' ')].filter(Boolean);
      };
      resetSpacing(ctx);
      metrics.forEach((m, i) => {
        const col = i % cols, row = (i / cols) | 0;
        // value + labels as one block, centred in the cell
        const cx = x0 + cw * (col + 0.5), cy = top + rh * row + rh / 2 - labBlock * 0.35;
        setFont(ctx, vpx, 800); ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(m.value), cx, cy + vpx * 0.2);
        setFont(ctx, lpx, 600, lsp); ctx.fillStyle = theme.sub;
        wrapLab(m.label).forEach((ln, k) => ctx.fillText(ln, cx, cy + vpx * 0.2 + lpx * 2.2 + k * lpx * 1.3));
        resetSpacing(ctx);
      });
      const lw = Math.max(1, u / 540);
      if (cols === 2) hairline(ctx, (x0 + x1) / 2, top + rh * 0.12, (x0 + x1) / 2, bottom - rh * 0.12, theme.hairline, lw);
      for (let r = 1; r < rows; r++) hairline(ctx, x0 + cw * 0.08, top + rh * r, x1 - cw * 0.08, top + rh * r, theme.hairline, lw);
      ctx.textAlign = 'left';
    };
    const srcLine = (x0, x1, y) => {         // bottom-anchored; wraps to 2 lines at the floor size
      const px = Math.max(u * 0.022, MIN_PX);
      const sl = wrapFit(ctx, source, x1 - x0, px, 600, 2, px, 1.3);
      setFont(ctx, sl.px, 600); ctx.fillStyle = theme.sub; ctx.textAlign = 'left';
      sl.lines.forEach((ln, i) => ctx.fillText(ln, x0, y - (sl.lines.length - 1 - i) * sl.lineHeight));
      return (sl.lines.length - 1) * sl.lineHeight;
    };

    if (c.landscape) {
      const mid = c.x0 + (c.x1 - c.x0) * 0.46;
      head(c.x0, mid - u * 0.03, c.top, headFit(c.x0, mid - u * 0.03, false));
      srcLine(c.x0, mid - u * 0.03, c.bodyBottom - u * 0.01);   // (left column, under the headline)
      grid(mid + u * 0.02, c.x1, c.top + u * 0.02, c.bodyBottom);
    } else {
      const srcY = c.bodyBottom - u * 0.01;
      const rows = metrics.length > 2 ? 2 : 1;
      let hl = headFit(c.x0, c.x1, false);
      // keep ≥ 0.2u per grid row; otherwise use the tighter headline
      if (srcY - u * 0.13 - u * 0.06 - headBottom(c.top, hl) < rows * u * 0.2) hl = headFit(c.x0, c.x1, true);
      const y = head(c.x0, c.x1, c.top, hl);
      const extra = srcLine(c.x0, c.x1, srcY);
      grid(c.x0, c.x1, y + u * 0.06, srcY - extra - u * 0.07);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// BRAND
// ════════════════════════════════════════════════════════════════════════════

function testimonial(ctx, W, H, d, theme, assets) {
  card(ctx, W, H, d, theme, assets, (c) => {
    const n = d.stars === '5 stars' ? 5 : 0;
    const who = [d.reviewer, d.context].filter(Boolean).join(', ');
    const blocks = (u) => {
      const w = c.x1 - c.x0, out = [];
      out.push({ h: u * 0.03, draw: (y) => statusLabel(ctx, c.x0, y + u * 0.03, u, d.kicker || 'Client Review', theme, 'left', w) });
      if (n) out.push({ gap: u * 0.05, h: u * 0.05, draw: (y) => stars(ctx, c.x0, y + u * 0.025, u * 0.025, n, theme.accent) });
      out.push({ gap: u * 0.04, h: u * 0.09, draw: (y) => { setFont(ctx, u * 0.16, 800); ctx.fillStyle = theme.accent; ctx.textAlign = 'left'; ctx.fillText('“', c.x0, y + u * 0.13); } });
      const q = wrapFit(ctx, d.quote || 'Client quote goes here — use their exact, approved words.', w, u * 0.056, 800, 12, u * 0.022, 1.2);
      out.push({ gap: u * 0.015, h: q.px + (q.lines.length - 1) * q.lineHeight, draw: (y) => drawBlock(ctx, q.lines, c.x0, y, q.px, q.lineHeight, 800, theme.ink) });
      if (who) out.push({ gap: u * 0.05, h: u * 0.03, draw: (y) => drawSubLine(ctx, { text: '— ' + who, kind: 'city' }, c.x0, y + u * 0.028, w, u, theme) });
      return out;
    };
    layoutCentered(c, blocks, false);
  });
}

function meetAdvisor(ctx, W, H, d, theme, assets) {
  const a = (d.agents || [])[0] || {};
  const portrait = (assets.headshots || []).filter(Boolean)[0] || null;
  card(ctx, W, H, d, theme, assets, (c) => {
    const stats = (d.pairs || []).filter((p) => String(p.value || '').trim()).slice(0, 3);
    const textBlocks = (u, x0, x1, align) => {
      const w = x1 - x0, cx = align === 'center' ? (x0 + x1) / 2 : x0, out = [];
      out.push({ h: u * 0.03, draw: (y) => statusLabel(ctx, cx, y + u * 0.03, u, d.kicker || 'Meet Your Advisor', theme, align, w) });
      const nm = wrapFit(ctx, a.name || 'Agent Name', w, u * 0.075, 800, 2, u * 0.045, 1.08);
      out.push({ gap: u * 0.045, h: nm.px + (nm.lines.length - 1) * nm.lineHeight, draw: (y) => (align === 'center' ? centredBlock(ctx, nm, cx, y, theme.ink) : drawBlock(ctx, nm.lines, x0, y, nm.px, nm.lineHeight, 800, theme.ink)) });
      if (a.title) out.push({ gap: u * 0.03, h: u * 0.03, draw: (y) => drawSubLine(ctx, { text: a.title, kind: 'city' }, cx, y + u * 0.028, w, u, theme, align) });
      if (d.license) out.push({ gap: u * 0.035, h: u * 0.02, draw: (y) => drawSubLine(ctx, { text: d.license, kind: 'caps' }, cx, y + u * 0.018, w, u, theme, align) });
      if (d.bio) {
        const b = wrapFit(ctx, d.bio, w, Math.max(u * 0.024, MIN_PX), 600, 4, MIN_PX, 1.35);
        out.push({ gap: u * 0.04, h: b.px + (b.lines.length - 1) * b.lineHeight, draw: (y) => { setFont(ctx, b.px, 600); ctx.fillStyle = theme.sub; ctx.textAlign = align; b.lines.forEach((ln, i) => ctx.fillText(ln, cx, y + b.px + i * b.lineHeight)); ctx.textAlign = 'left'; } });
      }
      if (stats.length) {
        const rf = { u, x0, x1 };
        if (align === 'left') {          // landscape text column: labelled list (full width per value)
          const adv = Math.max(u * 0.042, MIN_PX * 1.45) * 1.5;
          out.push({ gap: u * 0.05, h: adv * stats.length, draw: (y) => keyList(ctx, rf, y + adv * 0.72, stats, theme, -1) });
        } else out.push({ gap: u * 0.06, h: u * 0.058 + u * 0.06, draw: (y) => keyRow(ctx, rf, y + u * 0.058, stats, theme, -1, true) });
      }
      return out;
    };
    const avatar = (cx, cy, r) => {
      if (portrait) { circleImage(ctx, portrait, cx, cy, r, theme.accent); return; }
      // no headshot: initials monogram (never the listing photo)
      ctx.fillStyle = theme.bg2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.03); ctx.strokeStyle = theme.accent; ctx.stroke();
      const ini = String(a.name || '').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'G';
      setFont(ctx, r * 0.8, 800); ctx.fillStyle = theme.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ini, cx, cy + r * 0.04); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    };
    if (c.landscape) {
      const r = Math.min((c.bodyBottom - c.top) * 0.42, (c.x1 - c.x0) * 0.17);
      const cx = c.x0 + r, cy = (c.top + c.bodyBottom) / 2;
      avatar(cx, cy, r);
      const tx0 = c.x0 + r * 2 + c.u * 0.06;
      layoutCentered({ ...c, x0: tx0 }, (u) => textBlocks(u, tx0, c.x1, 'left'), false);
    } else {
      const r = Math.min(c.u * 0.17, (c.bodyBottom - c.top) * 0.2);
      const blocks = (u) => [{ h: r * 2, draw: (y) => avatar((c.x0 + c.x1) / 2, y + r, r) }, ...textBlocks(u, c.x0, c.x1, 'center').map((b, i) => (i === 0 ? { ...b, gap: u * 0.06 } : b))];
      layoutCentered(c, blocks, false);
    }
  });
}

// ── card helpers ────────────────────────────────────────────────────────────
// Navy card (no photo): background, footer with lockup + agent/brokerage, and a
// body box handed to `body(c)`. Landscape uses u = 1.35×H and the full width.
function card(ctx, W, H, d, theme, assets, body) {
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);
  const fr = frameFor(W, H);
  const landscape = fr.landscape;
  const c = landscape
    ? { landscape: true, u: H * 1.35, x0: W * 0.06, x1: W * 0.94, top: H * 0.07, bottom: H * 0.93 }
    : { landscape: false, u: W, x0: W * 0.08, x1: W * 0.92, top: fr.top, bottom: fr.bottom };
  const f = { landscape: false, u: c.u, x0: c.x0, x1: c.x1 };      // footer: lockup at right on every size
  const plan = footerPlan(ctx, d, assets, f, theme, { noAvatars: !!d.noFooterAvatars });
  const fy = c.bottom - c.u * 0.006 - plan.height * c.u;
  c.bodyBottom = fy - c.u * 0.05;
  body(c);
  agentFooter(ctx, f, fy, plan, d, theme);
}

// Lay out measured blocks [{gap?, h, draw(yTop)}] between c.top and
// c.bodyBottom, shrinking the type unit until they fit, then centring them.
function layoutCentered(c, blocksAt, centre) {
  const avail = c.bodyBottom - c.top;
  let u = c.u, bl;
  for (;;) {
    bl = blocksAt(u);
    const h = bl.reduce((s, b, i) => s + (i ? (b.gap || 0) : 0) + b.h, 0);
    if (h <= avail || u < c.u * 0.45) { bl.total = h; break; }
    u *= 0.95;
  }
  let y = c.top + Math.max(0, (avail - bl.total) / (centre ? 2 : 2.4));
  bl.forEach((b, i) => { if (i) y += b.gap || 0; b.draw(y); y += b.h; });
}

function centredBlock(ctx, fit, cx, y, color) {
  setFont(ctx, fit.px, 800); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  fit.lines.forEach((ln, i) => ctx.fillText(ln, cx, y + fit.px + i * fit.lineHeight));
  ctx.textAlign = 'left';
}

function stars(ctx, x, cy, size, n, color) {
  ctx.fillStyle = color;
  for (let s = 0; s < n; s++) {
    const cx = x + size + s * (size * 2.4);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? size : size * 0.45, a = -Math.PI / 2 + i * Math.PI / 5;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Registry
// ════════════════════════════════════════════════════════════════════════════
const RES = { type: 'residential', theme: 'slate', sizeId: 'ig-portrait' };
const CRE = { type: 'commercial', theme: 'slate', sizeId: 'ig-portrait' };

export const V2_TEMPLATES = {
  'open-house': {
    name: 'Open House', group: 'Residential', render: openHouse, sizes: LISTING_SIZES, defaults: RES, photo: 'required',
    fields: [F.address, F.city,
      { id: 'date', label: 'Date', type: 'date', half: true, required: true },
      { ...F.price, half: true },
      { id: 'start', label: 'Start time', type: 'time', half: true, required: true },
      { id: 'end', label: 'End time', type: 'time', half: true, required: true }],
  },
  'just-listed': {
    name: 'Just Listed / Coming Soon', group: 'Residential', render: justListed, sizes: LISTING_SIZES, defaults: RES, photo: 'required',
    fields: [{ id: 'status', label: 'Status', type: 'segmented', options: ['Just Listed', 'Coming Soon'], default: 'Just Listed' },
      F.address, F.city, { ...F.price, note: 'Leave blank to hide (e.g. Coming Soon)' }, F.sf, F.beds, F.baths],
  },
  'under-contract': {
    name: 'Under Contract / Pending', group: 'Residential', render: underContract, sizes: LISTING_SIZES, defaults: RES, photo: 'required',
    fields: [{ id: 'status', label: 'Status', type: 'segmented', options: ['Under Contract', 'Pending'], default: 'Under Contract' },
      F.address, F.city, { ...F.price, label: 'Price (optional)' }, F.sf, F.beds, F.baths],
  },
  'just-sold': {
    name: 'Just Sold', group: 'Residential', render: justSold, sizes: LISTING_SIZES, defaults: RES, photo: 'required',
    fields: [F.address, F.city, { ...F.price, label: 'Sale price (optional)' }, F.represented, F.beds, F.baths],
  },
  'price-improvement': {
    name: 'Price Improvement', group: 'Residential', render: priceImprovement, sizes: LISTING_SIZES, defaults: RES, photo: 'required',
    fields: [F.address, F.city,
      { id: 'oldPrice', label: 'Previous price', type: 'price', placeholder: '$199,900', half: true },
      { ...F.price, label: 'New price', required: true, half: true },
      F.sf, F.beds, F.baths],
  },
  'cre-offering': {
    name: 'Just Listed – Offering', group: 'Commercial / Investment', render: creOffering, sizes: LISTING_SIZES, defaults: CRE, photo: 'required',
    fields: [{ id: 'status', label: 'Status', type: 'segmented', options: ['Just Listed', 'For Sale', 'For Lease', 'Coming Soon'], default: 'Just Listed' },
      F.propName, F.assetType, F.size,
      { ...F.address, required: false, label: 'Street address (optional)' }, { ...F.city, placeholder: 'Sioux City, IA' },
      { id: 'metrics', label: 'Key figures (pick 3–4)', type: 'metrics', count: 4, options: Object.keys(CRE_METRICS), defaults: ['Price', 'Units', 'Price/Unit', 'Cap Rate'] },
      { id: 'om', label: 'Show “Offering Memorandum available”', type: 'checkbox' }],
  },
  'cre-tombstone': {
    name: 'Just Closed – Deal Tombstone', group: 'Commercial / Investment', render: creTombstone, sizes: LISTING_SIZES, defaults: CRE, photo: 'optional',
    fields: [{ id: 'status', label: 'Status', type: 'segmented', options: ['Just Closed', 'Sold', 'Leased'], default: 'Just Closed' },
      F.propName, F.assetType, F.size, { ...F.city, placeholder: 'Sioux City, IA' },
      { ...F.price, label: 'Sale price (optional)', placeholder: '$4,250,000' },
      { id: 'capRate', label: 'Cap rate (optional)', type: 'pct', placeholder: '7.25%', half: true },
      { ...F.represented, options: ['Seller', 'Buyer', 'Both', 'None'] }],
  },
  'market-snapshot': {
    name: 'Market Snapshot', group: 'Commercial / Investment', render: marketSnapshot, sizes: LISTING_SIZES, defaults: CRE, photo: 'none',
    fields: [{ id: 'market', label: 'Market or submarket', type: 'text', placeholder: 'Sioux City Multifamily', required: true },
      { id: 'period', label: 'Period', type: 'text', placeholder: 'Q3 2026', required: true, half: true },
      { id: 'pairs', label: 'Figures (value + label)', type: 'pairs', count: 4,
        placeholders: [['5.8%', 'Vacancy'], ['$1,045', 'Avg Asking Rent'], ['+212', 'Net Absorption (Units)'], ['7.1%', 'Avg Cap Rate']] },
      { id: 'source', label: 'Source (required)', type: 'text', placeholder: 'CoStar', required: true, half: true },
      { id: 'sourceDate', label: 'Source date', type: 'text', placeholder: 'Oct 2026 (defaults to period)', half: true }],
  },
  'testimonial': {
    name: 'Testimonial', group: 'Brand', render: testimonial, sizes: LISTING_SIZES, defaults: { theme: 'slate', sizeId: 'ig-portrait' }, photo: 'none',
    fields: [{ id: 'quote', label: 'Client quote (their exact, approved words)', type: 'textarea', required: true, placeholder: 'Paste the review exactly as the client wrote it.', note: 'Reads best under ~250 characters.' },
      { id: 'reviewer', label: 'Client name', type: 'text', placeholder: 'First name + last initial', half: true },
      { id: 'context', label: 'Context', type: 'text', placeholder: 'Home seller, Sioux City', half: true },
      { id: 'stars', label: 'Star rating', type: 'segmented', options: ['5 stars', 'None'], default: '5 stars', note: 'Only show stars if the client actually left a 5-star review.' },
      { id: 'kicker', label: 'Label', type: 'text', default: 'Client Review', half: true }],
  },
  'meet-advisor': {
    name: 'Meet the Advisor', group: 'Brand', render: meetAdvisor, sizes: LISTING_SIZES, defaults: { theme: 'slate', sizeId: 'ig-portrait' }, photo: 'none',
    note: 'Uses Agent 1 (name, title, headshot) below.', noFooterAvatars: true,
    fields: [{ id: 'kicker', label: 'Label', type: 'text', default: 'Meet Your Advisor' },
      { id: 'license', label: 'License line', type: 'text', placeholder: 'Licensed in IA, SD, NE' },
      { id: 'bio', label: 'Short bio (1–2 sentences)', type: 'textarea', placeholder: 'What you focus on and where you work.' },
      { id: 'pairs', label: 'Figures (optional — only verifiable facts)', type: 'pairs', count: 3, note: 'Keep labels short (2–3 words). No “#1” or “top” claims unless you can cite the source.',
        placeholders: [['12', 'Years in Real Estate'], ['IA · SD · NE', 'Licensed'], ['Multifamily', 'Focus']] }],
  },
};

export const V2_GROUPS = ['Residential', 'Commercial / Investment', 'Brand'];
export const V2_ORDER = Object.keys(V2_TEMPLATES);

// Format raw form values per field type into what the renderer draws.
export function formatFields(tpl, raw) {
  const out = { ...raw };
  for (const fd of tpl.fields || []) {
    const v = raw[fd.id];
    if (fd.type === 'price') out[fd.id] = fmtPrice(v);
    else if (fd.type === 'sf') out[fd.id] = fmtSF(v);
    else if (fd.type === 'pct') out[fd.id] = fmtPct(v);
    else if (fd.type === 'metrics') out[fd.id] = (v || []).filter((m) => m && String(m.value || '').trim())
      .map((m) => { const def = CRE_METRICS[m.key] || { label: m.key, fmt: (x) => x }; return { label: def.label, value: def.fmt(m.value) }; });
  }
  if (tpl.noFooterAvatars) out.noFooterAvatars = true;
  return out;
}
