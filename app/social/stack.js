// app/social/stack.js
// Layout engine for the dedicated (v2) Graphics templates: frame geometry per
// size, the Gateway lockup, the agent + brokerage footer, the key-number row and
// the photo-led "stack" layout. Pure drawing — templates live in templates-v2.js.

import { setFont, coverInto, vGradient, hairline, kicker, fitLine, wrapFit, drawBlock, circleImage } from './draw.js';

// ════════════════════════════════════════════════════════════════════════════
// Dedicated listing templates (v2). Bottom-up "stack" layout: the footer sits on
// the bottom safe line, the key-number row sits on the footer, the address block
// sits on the row, and the photo takes whatever height is left. Every size is
// derived from one type unit `u` (= canvas width for portrait/square/story), so
// 1080×1350 reproduces the approved Open House geometry and other sizes scale.
// ════════════════════════════════════════════════════════════════════════════

export const BROKERAGE = 'Gateway Real Estate Advisors';
// Smallest type we draw for labels / sub-lines (px at export size).
export const MIN_PX = 11;

export function resetSpacing(ctx) { try { ctx.letterSpacing = '0px'; } catch { /* older engines */ } }

// Frame geometry per size. Text stays inside a 6% safe area on every side; the
// 9:16 story also keeps the top 14% and bottom 20% clear for IG/FB UI overlays.
export function frameFor(W, H) {
  if (W / H > 1.4) {
    // Landscape (1200×628): photo left 55%, navy panel right with the same stack.
    const photoW = Math.round(W * 0.55);
    const x0 = photoW + W * 0.045, x1 = W - W * 0.06;
    return { landscape: true, photoW, x0, x1, u: (x1 - x0) / 0.7, top: H * 0.06, bottom: H * 0.94 };
  }
  const story = H / W > 1.6;
  return {
    landscape: false, x0: W * 0.07, x1: W * 0.93, u: W,
    top: story ? H * 0.14 : H * 0.06, bottom: story ? H * 0.80 : H * 0.94,
  };
}

// '#152229' -> 'rgba(21,34,41,0)': fade into the theme background without a grey band
export function clear(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},0)` : 'rgba(13,17,23,0)';
}

export function listingPhoto(ctx, W, H, f, theme, photo, photoBottom) {
  if (f.landscape) {
    if (photo) coverInto(ctx, photo, 0, 0, f.photoW, H);
    else vGradient(ctx, 0, 0, f.photoW, H, [[0, theme.bg2], [1, theme.bg1]]);
    // soft seam into the panel
    const sw = W * 0.08, g = ctx.createLinearGradient(f.photoW - sw, 0, f.photoW, 0);
    g.addColorStop(0, clear(theme.bg1)); g.addColorStop(1, theme.bg1);
    ctx.fillStyle = g; ctx.fillRect(f.photoW - sw, 0, sw + 1, H);
    return;
  }
  const ph = Math.max(0, Math.round(photoBottom));
  if (!ph) return;
  if (photo) coverInto(ctx, photo, 0, 0, W, ph);
  else vGradient(ctx, 0, 0, W, ph, [[0, theme.bg2], [1, theme.bg1]]);
  const fade = Math.min(H * 0.18, ph);
  vGradient(ctx, 0, ph - fade, W, fade, [[0, clear(theme.bg1)], [1, theme.bg1]]);
}

// ── Brand mark ───────────────────────────────────────────────────────────────
// The official horizontal lockup (arch + GATEWAY + REAL ESTATE ADVISORS) is the
// brand mark on every graphic. It replaced the round seal because the seal's
// ring text renders ~6px tall at footer size (≈2pt on a phone) — unreadable.
// In the lockup "GATEWAY" is 42% of the image height, so at MARK_H it reads
// at ≥ 2.2% of the canvas width (24px+ on a 1080 graphic, ≈ 9pt on a phone).
// Light themes get the dark lockup; dark themes the white one. Never stretched.
export const MARK_GATEWAY_RATIO = 77 / 183;   // "GATEWAY" cap height / lockup height
export const MARK_H = 0.078;                          // lockup height, in u (GATEWAY ≈ 3.3% of width)

export function markFor(theme, assets) {
  const light = !theme.lightBg;
  return (light ? assets.markLight : assets.markDark) || null;
}
export function markSize(img, h) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  return { w: h * (iw / ih), h };
}
export function drawMark(ctx, img, x, y, h) {          // (x,y) = top-left; aspect preserved
  const m = markSize(img, h);
  ctx.drawImage(img, x, y, m.w, m.h);
  return m;
}

// Footer metrics (heights in u) so the stack can be planned before drawing.
// Layout: [avatar] agent text ........ [Gateway lockup]. Two agents sit in two
// columns, or one per row ("stacked") when columns would squeeze the names.
export function footerPlan(ctx, data, assets, f, theme, opts = {}) {
  const u = f.u;
  const agents = (data.agents || []).filter((a) => a && a.name).slice(0, 2);
  const heads = opts.noAvatars ? [] : (assets.headshots || []).filter(Boolean).slice(0, Math.max(1, agents.length));
  const mark = f.landscape ? null : markFor(theme, assets);       // landscape: mark sits atop the panel
  const markW = mark ? markSize(mark, MARK_H * u).w : 0;
  const textR = f.x1 - (mark ? markW + u * 0.035 : 0);
  const ra = u * 0.034, avOff = ra * 2 + u * 0.02;                 // avatar radius + text offset
  const off = (i) => (heads[i] ? avOff : 0);

  let stacked = false;
  if (agents.length >= 2) {
    if (f.landscape) stacked = true;
    else if (!opts.compact) {
      const colW = (textR - f.x0) / 2;
      setFont(ctx, u * 0.025 * 0.8, 700);
      stacked = agents.some((a, i) => ctx.measureText(a.name).width > colW - off(i) - u * 0.025);
    }
  }
  const lines = [];                      // vertical advances after the hairline
  if (stacked) lines.push(0.050, 0.030, 0.046, 0.030, 0.036);      // name1, detail1, name2, detail2, brokerage
  else if (agents.length >= 2) {
    lines.push(0.050);                                             // names
    if (opts.compact) lines.push(0.030);                           // title · phone
    else {
      if (agents.some((a) => a.title)) lines.push(0.030);
      if (agents.some((a) => a.phone)) lines.push(0.030);
    }
    lines.push(0.034);                                             // brokerage (always)
  } else if (agents.length === 1) {
    lines.push(0.054);
    if (agents[0].title) lines.push(0.031);
    lines.push(0.0375);                                            // phone · brokerage
  } else lines.push(0.054);                                        // brokerage alone
  // the footer block is never shorter than the lockup it holds
  const need = mark ? MARK_H + 0.024 : 0, have = lines.reduce((s, v) => s + v, 0);
  if (have < need) lines.push(need - have);                        // trailing spacer (no text)
  return { agents, heads, mark, markW, textR, ra, off, stacked, compact: !!opts.compact, lines, height: lines.reduce((s, v) => s + v, 0) };
}

// Agent + brokerage footer. The brokerage name is ALWAYS printed next to the
// agent name(s) (Iowa 193E—10.1 advertising rule) — never dropped for space.
export function agentFooter(ctx, f, fy, plan, data, theme) {
  const { u, x0, x1 } = f;
  const brokerage = data.brokerage || BROKERAGE;
  hairline(ctx, x0, fy, x1, fy, theme.hairline, Math.max(1, u / 540));
  const bottomBase = fy + plan.height * u;
  const midY = (fy + bottomBase) / 2 + u * 0.004;

  // lockup: centred on the footer block, never above the hairline
  if (plan.mark) drawMark(ctx, plan.mark, x1 - plan.markW, Math.max(fy + u * 0.016, midY - (MARK_H * u) / 2), MARK_H * u);

  const { textR, ra, off, agents, heads } = plan;
  const small = Math.max(u * 0.016, MIN_PX), sp = 1.2 * u / 1080;
  const avatar = (i, x, top, bot) => heads[i] && circleImage(ctx, heads[i], x + ra, (top + bot) / 2 + u * 0.002, Math.min(ra, (bot - top) * 0.48), theme.accent);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  if (plan.stacked) {
    let y = fy;
    agents.forEach((a, i) => {
      const top = y + u * 0.012;
      y += plan.lines[i * 2] * u;
      const tx = x0 + off(i), tw = textR - tx;
      fitLine(ctx, a.name, tx, y, tw, u * 0.025, 700, theme.ink, 'left', 6);
      y += plan.lines[i * 2 + 1] * u;
      const det = [a.title, a.phone].filter(Boolean).join('  ·  ');
      if (det) fitLine(ctx, det, tx, y, tw, small, 600, theme.sub, 'left', 6);
      avatar(i, x0, top, y + u * 0.006);
    });
    y += plan.lines[4] * u;
    fitLine(ctx, brokerage, x0, y, textR - x0, small, 600, theme.sub, 'left', 6);
  } else if (agents.length >= 2) {
    const colW = (textR - x0) / 2;
    const yName = fy + plan.lines[0] * u;
    let y = yName, k = 1;
    const detailYs = [];
    if (plan.compact) { y += plan.lines[k++] * u; detailYs.push(['compact', y]); }
    else {
      if (agents.some((a) => a.title)) { y += plan.lines[k++] * u; detailYs.push(['title', y]); }
      if (agents.some((a) => a.phone)) { y += plan.lines[k++] * u; detailYs.push(['phone', y]); }
    }
    agents.forEach((a, i) => {
      const tx = x0 + colW * i + off(i), tw = colW - off(i) - u * 0.025;
      fitLine(ctx, a.name, tx, yName, tw, u * 0.025, 700, theme.ink, 'left', 6);
      detailYs.forEach(([kind, yy]) => {
        const t = kind === 'compact' ? [a.title, a.phone].filter(Boolean).join('  ·  ') : a[kind];
        if (t) fitLine(ctx, t, tx, yy, tw, kind === 'title' ? u * 0.0155 : small, 600, kind === 'title' ? theme.accent : theme.sub, 'left', 6);
      });
      avatar(i, x0 + colW * i, fy + u * 0.012, (detailYs.length ? detailYs[detailYs.length - 1][1] : yName) + u * 0.006);
    });
    y += plan.lines[k] * u;
    fitLine(ctx, brokerage, x0, y, textR - x0, small, 600, theme.sub, 'left', 6);
  } else if (agents.length === 1) {
    const a = agents[0];
    const tx = x0 + off(0), tw = textR - tx;
    let y = fy + plan.lines[0] * u;
    fitLine(ctx, a.name, tx, y, tw, u * 0.027, 700, theme.ink, 'left', 6);
    let k = 1;
    if (a.title) { y += plan.lines[k++] * u; fitLine(ctx, a.title, tx, y, tw, u * 0.018, 600, theme.accent, 'left', 6); }
    y += plan.lines[k] * u;
    const line = [a.phone, brokerage].filter(Boolean).join('  ·  ');
    let px = small; setFont(ctx, px, 600, sp);
    while (ctx.measureText(line).width > tw && px > 6) { px -= 1; setFont(ctx, px, 600, sp); }
    ctx.fillStyle = theme.sub; ctx.fillText(line, tx, y); resetSpacing(ctx);
    avatar(0, x0, fy + u * 0.014, y + u * 0.006);
  } else {
    fitLine(ctx, brokerage, x0, fy + plan.lines[0] * u, textR - x0, u * 0.022, 700, theme.sub, 'left', 6);
  }
}

// Key-number row: 1–4 columns, values auto-fit per column, labels below,
// hairline dividers between.
//   emphasis: index kept visibly the largest value (e.g. price)
//   uniform:  every value drawn at the same (smallest fitting) size — for
//             commercial metric rows where no figure should dominate
//   item.strike: value drawn muted with a strike-through (e.g. the old price)
export function keyRow(ctx, f, y, items, theme, emphasis = -1, uniform = false) {
  const { u, x0, x1 } = f;
  const n = items.length; if (!n) return;
  const w = x1 - x0, cellW = w / n, pad = cellW * 0.08;
  const v0 = u * 0.058, l0 = Math.max(u * 0.016, MIN_PX), lsp = 2 * u / 1080;
  const fit = items.map((it) => {
    let px = v0; setFont(ctx, px, 800);
    while (ctx.measureText(String(it.value)).width > cellW - pad * 2 && px > 6) { px -= 1; setFont(ctx, px, 800); }
    return px;
  });
  if (uniform) { const m = Math.min(...fit); fit.fill(m); }
  if (emphasis >= 0 && emphasis < n) {
    const cap = fit[emphasis] * 0.86;            // others stay visibly smaller
    fit.forEach((px, i) => { if (i !== emphasis) fit[i] = Math.min(px, cap); });
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  items.forEach((it, i) => {
    const cx = x0 + cellW * (i + 0.5);
    const val = String(it.value);
    setFont(ctx, fit[i], 800); ctx.fillStyle = it.strike ? theme.sub : theme.ink; ctx.fillText(val, cx, y);
    if (it.strike) {
      const tw = ctx.measureText(val).width;
      hairline(ctx, cx - tw / 2 - u * 0.004, y - fit[i] * 0.34, cx + tw / 2 + u * 0.004, y - fit[i] * 0.34, theme.sub, Math.max(2, fit[i] * 0.07));
    }
    const lab = String(it.label || '').toUpperCase();
    let lpx = l0; setFont(ctx, lpx, 600, lsp);
    while (ctx.measureText(lab).width > cellW - pad && lpx - 1 >= MIN_PX) { lpx -= 1; setFont(ctx, lpx, 600, lsp); }
    ctx.fillStyle = theme.sub;
    const ly = y + v0 * 0.5 + l0 * 1.5;
    if (ctx.measureText(lab).width > cellW - pad) {
      // still too wide at the floor: wrap (up to 3 lines) instead of shrinking further
      const wrapAt = () => {
        const out = []; let cur = '';
        for (const w of lab.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > cellW - pad) { out.push(cur); cur = w; } else cur = t; }
        if (cur) out.push(cur); return out;
      };
      let ls = wrapAt();
      while ((ls.length > 3 || ls.some((l) => ctx.measureText(l).width > cellW - pad)) && lpx > 6) { lpx -= 1; setFont(ctx, lpx, 600, lsp); ls = wrapAt(); }
      ls.forEach((l, k) => ctx.fillText(l, cx, ly + k * lpx * 1.25));
    } else ctx.fillText(lab, cx, ly);
    resetSpacing(ctx);
    if (i > 0) hairline(ctx, x0 + cellW * i, y - v0 * 0.72, x0 + cellW * i, y + l0 * 0.6, theme.hairline, Math.max(1, u / 540));
  });
  ctx.textAlign = 'left';
}

// Landscape sizing guard: at unit u, do the agent names fit at >= 80% of their
// nominal size? (Key values auto-fit per column on their own.)
export function widthsFit(ctx, u, f, data, plan) {
  setFont(ctx, u * 0.025 * 0.8, 700);
  return plan.agents.every((a, i) => ctx.measureText(a.name).width <= (f.x1 - f.x0) - (plan.heads[i] ? u * 0.088 : 0));
}

// Sub-lines under the headline. Sizes/gaps in u; gap = baseline-to-baseline
// distance from the line above.
const LINE = {
  city: { px: 0.028, gap: 0.055, weight: 600, color: 'sub', spacing: 0 },
  meta: { px: 0.022, gap: 0.042, weight: 600, color: 'sub', spacing: 0 },
  caps: { px: 0.0165, gap: 0.046, weight: 600, color: 'accent', spacing: 3, upper: true },
};

// Shared photo-led listing layout: status label → headline → sub-lines → key
// row → agent/brokerage footer. Planned bottom-up so nothing ever overlaps:
// the photo simply gets whatever height is left.
//   opts.label     status label ("Open House", "Just Sold" …)
//   opts.headline  big line (wraps to 2, auto-shrinks); default data.address
//   opts.lines     [{ text, kind: 'city'|'meta'|'caps' }] — blanks are dropped
//   opts.row       key-number items [{ value, label, strike? }] — blanks dropped
//   opts.emphasis  fn(items) -> index kept largest;  opts.uniform  bool
export function listingStack(ctx, W, H, data, theme, assets, opts) {
  const { label, row, emphasis, uniform } = opts;
  const headline = opts.headline || data.address || data.title || '123 Example St';
  const lines = (opts.lines || [{ text: data.city, kind: 'city' }]).filter((l) => l && String(l.text || '').trim());
  const items = (row || []).filter((it) => it && String(it.value || '').trim());
  const f = frameFor(W, H);
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);

  // landscape: the Gateway lockup sits at the top of the navy panel
  const lmark = f.landscape ? markFor(theme, assets) : null;
  const lmarkH = W * 0.024 / MARK_GATEWAY_RATIO;     // "GATEWAY" = 2.4% of width
  if (lmark) f.top = H * 0.06 + lmarkH + H * 0.05;
  let plan = footerPlan(ctx, data, assets, f, theme);
  const plan_ = (u) => {
    const tw = f.x1 - f.x0;
    const hl = wrapFit(ctx, headline, tw, u * 0.060, 800, 2, u * 0.038);
    const addrH = hl.px + (hl.lines.length - 1) * hl.lineHeight;
    const fy = f.bottom - u * 0.006 - plan.height * u;   // leave room for descenders
    const rowY = fy - u * 0.0875;
    // last sub-line (or the headline) sits on the row, or on the footer when there is no row
    let y = items.length ? rowY - u * 0.108 : fy - u * 0.075;
    const lineYs = [];
    for (let i = lines.length - 1; i >= 0; i--) { lineYs[i] = y; y -= LINE[lines[i].kind || 'city'].gap * u; }
    const addrLast = lines.length ? y : (items.length ? rowY - u * 0.11 : fy - u * 0.08);
    const addrTop = addrLast - addrH;
    const kickY = addrTop - u * 0.0275;
    const photoBottom = kickY - u * 0.0625;
    return { hl, fy, rowY, lineYs, addrTop, kickY, photoBottom, top: kickY - u * 0.03 };
  };
  let L = plan_(f.u);
  if (f.landscape) {
    // grow the type to use the panel height, but never past the safe area
    for (let u = (f.x1 - f.x0) / 0.5; u > f.u; u -= 8) {
      const T = plan_(u);
      if (T.top >= f.top && widthsFit(ctx, u, f, data, plan)) { f.u = u; L = T; break; }
    }
    // centre the stack vertically in the panel's safe area
    const slack = L.top - f.top;
    if (slack > 0) {
      const d = slack / 2;
      L = { ...L, fy: L.fy - d, rowY: L.rowY - d, lineYs: L.lineYs.map((v) => v - d), addrTop: L.addrTop - d, kickY: L.kickY - d };
    }
  }

  listingPhoto(ctx, W, H, f, theme, assets.photo, L.photoBottom);
  if (lmark) drawMark(ctx, lmark, f.x0, H * 0.06, lmarkH);
  if (f.landscape) plan = footerPlan(ctx, data, assets, f, theme);   // re-plan at the final u

  const { u, x0 } = f;
  statusLabel(ctx, x0, L.kickY, u, label, theme, 'left', f.x1 - x0);
  drawBlock(ctx, L.hl.lines, x0, L.addrTop, L.hl.px, L.hl.lineHeight, 800, theme.ink);
  lines.forEach((ln, i) => drawSubLine(ctx, ln, x0, L.lineYs[i], f.x1 - x0, u, theme));
  if (items.length) keyRow(ctx, f, L.rowY, items, theme, emphasis ? emphasis(items) : -1, !!uniform);
  agentFooter(ctx, f, L.fy, plan, data, theme);
}

// Status label: solid accent bar + letterspaced caps (baseline y).
export function statusLabel(ctx, x0, y, u, label, theme, align = 'left', maxW = Infinity) {
  const text = String(label).toUpperCase();
  let px = Math.max(u * 0.020, MIN_PX), sp = 5 * u / 1080;
  const room = align === 'center' ? maxW : maxW - u * 0.028;
  setFont(ctx, px, 600, sp);
  while (ctx.measureText(text).width > room && (px - 1 >= MIN_PX || sp > 1.5)) {
    if (sp > 1.5) sp *= 0.85; else px -= 1;
    setFont(ctx, px, 600, sp);
  }
  resetSpacing(ctx);
  if (align === 'center') { kicker(ctx, text, x0, y, theme.accent, px, sp, 'center'); return; }
  ctx.fillStyle = theme.accent; ctx.fillRect(x0, y - u * 0.028, u * 0.012, u * 0.034);
  kicker(ctx, text, x0 + u * 0.028, y, theme.accent, px, sp);
}

export function drawSubLine(ctx, ln, x, y, maxW, u, theme, align = 'left') {
  const k = LINE[ln.kind || 'city'];
  const text = k.upper ? String(ln.text).toUpperCase() : String(ln.text);
  const color = theme[k.color] || theme.sub;
  let px = Math.max(k.px * u, MIN_PX); const sp = k.spacing * u / 1080;
  setFont(ctx, px, k.weight, sp);
  while (ctx.measureText(text).width > maxW && px > 6) { px -= 1; setFont(ctx, px, k.weight, sp); }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y); resetSpacing(ctx); ctx.textAlign = 'left';
}
