// app/social/templates.js
// Premium commercial real-estate templates. Each render() paints one graphic to
// a canvas context at the given W×H, using the design tokens + draw helpers.
// Explicit per-template layout gives precise art-direction control.

import {
  setFont, coverInto, blurExtend, vGradient, hairline, kicker,
  fitLine, wrapFit, drawBlock, circleImage, statRow, fillRoundRect,
} from './draw.js';
import { formatEventDate, formatTimeRange } from './format.js';

// Shared footer for the classic templates — delegates to agentFooter below.
// (Lockup right, agent text + optional avatars left, brokerage always shown.)
function footer(ctx, W, H, data, theme, assets, opts = {}) {
  // Same footer as the dedicated templates (lockup always visible, brokerage
  // always printed), at the classic templates' fixed 87% hairline.
  const f = { landscape: false, u: Math.min(W, H), x0: W * 0.07, x1: W * 0.93 };
  const plan = footerPlan(ctx, data, assets, f, theme, { compact: true, ...opts });
  const fy = H - H * 0.13;
  // fixed hairline: tighten line spacing (not type size) so the block ends by 96.5% H
  const room = H * 0.965 - fy - f.u * 0.006;
  if (plan.height * f.u > room) {
    const k = room / (plan.height * f.u);
    plan.lines = plan.lines.map((v) => v * k); plan.height *= k;
  }
  agentFooter(ctx, f, fy, plan, data, theme);
}

function bg(ctx, W, H, theme) {
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);
}

// Shared lower block for listing templates: address headline -> City, State ->
// detail subtitle -> stat row. Uses a flowing cursor and an adaptive stat-row
// position so lines never overlap regardless of how long the address is.
function listingBody(ctx, W, H, data, theme, startY) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  const M = W * 0.07;
  const hl = wrapFit(ctx, data.title || 'Property Address', W - M * 2, T * 0.060, 800, 2, T * 0.038);
  let y = drawBlock(ctx, hl.lines, M, startY, hl.px, hl.lineHeight, 800, theme.ink);
  if (data.city) { y += H * 0.044; fitLine(ctx, data.city, M, y, W - M * 2, T * 0.028, 600, theme.sub, 'left'); }
  if (data.subtitle) { y += H * 0.036; fitLine(ctx, data.subtitle, M, y, W - M * 2, T * 0.022, 600, theme.faint || theme.sub, 'left'); }
  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) {
    let statY = Math.min(H * 0.815, Math.max(H * 0.80, y + H * 0.085));
    // wide print sizes: keep the stat labels above the footer hairline at 87%
    if (W / H > 1.2) statY = Math.min(statY, H * 0.86 - (T * 0.058 * 0.5 + T * 0.016 * 1.8));
    statRow(ctx, stats, M, statY, W - M * 2, theme, { valuePx: T * 0.058, labelPx: T * 0.016 });
  }
}

// ── 1. Just Listed / For Sale (photo-led) ───────────────────────────────────
function creJustListed(ctx, W, H, data, theme, assets) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  bg(ctx, W, H, theme);
  const M = W * 0.07;
  const photoH = Math.round(H * 0.55);
  if (assets.photo) {
    blurExtend(ctx, assets.photo, 0, 0, W, photoH, 0.0);
    coverInto(ctx, assets.photo, 0, 0, W, photoH);
  } else { vGradient(ctx, 0, 0, W, photoH, [[0, theme.bg2], [1, theme.bg1]]); }
  vGradient(ctx, 0, photoH - H * 0.18, W, H * 0.18, [[0, 'rgba(13,17,23,0)'], [1, theme.bg1]]);

  // gold accent bar + kicker
  const ky = photoH + H * 0.05;
  ctx.fillStyle = theme.accent; ctx.fillRect(M, ky - T * 0.028, T * 0.012, T * 0.034);
  kicker(ctx, data.kicker || 'For Sale', M + T * 0.028, ky, theme.accent, T * 0.020, 5);

  listingBody(ctx, W, H, data, theme, ky + H * 0.022);
  footer(ctx, W, H, data, theme, assets);
}

// ── 2. Just Closed / Sold (social proof) ────────────────────────────────────
function creJustClosed(ctx, W, H, data, theme, assets) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  bg(ctx, W, H, theme);
  const M = W * 0.07;
  const photoH = Math.round(H * 0.5);
  if (assets.photo) { blurExtend(ctx, assets.photo, 0, 0, W, photoH); coverInto(ctx, assets.photo, 0, 0, W, photoH); }
  // pill badge
  const bw = T * 0.46, bh = H * 0.062, bx = M, by = photoH - bh - H * 0.03;
  fillRoundRect(ctx, bx, by, bw, bh, bh / 2, theme.accent);
  setFont(ctx, bh * 0.42, 800, 4); ctx.fillStyle = theme.accentInk; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText((data.kicker || 'JUST CLOSED').toUpperCase(), bx + bw * 0.08, by + bh / 2);
  try { ctx.letterSpacing = '0px'; } catch {}
  ctx.textBaseline = 'alphabetic';
  vGradient(ctx, 0, photoH - H * 0.16, W, H * 0.16, [[0, 'rgba(13,17,23,0)'], [1, theme.bg1]]);

  listingBody(ctx, W, H, data, theme, photoH + H * 0.07);
  footer(ctx, W, H, data, theme, assets);
}

// ── 3. By the Numbers (data-led market/investment card) ─────────────────────
function creStats(ctx, W, H, data, theme, assets) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  bg(ctx, W, H, theme);
  const M = W * 0.08;
  // accent corner brackets for an institutional feel
  ctx.strokeStyle = theme.hairline; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, H * 0.06 + 40); ctx.lineTo(M, H * 0.06); ctx.lineTo(M + 60, H * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - M, H * 0.94 - 40); ctx.lineTo(W - M, H * 0.94); ctx.lineTo(W - M - 60, H * 0.94); ctx.stroke();

  let y = H * 0.16;
  kicker(ctx, data.kicker || 'By the Numbers', M, y, theme.accent, T * 0.022, 6);
  y += H * 0.045;
  const hl = wrapFit(ctx, data.title || 'Market Snapshot', W - M * 2, T * 0.066, 800, 2, T * 0.044);
  y = drawBlock(ctx, hl.lines, M, y, hl.px, hl.lineHeight, 800, theme.ink);
  if (data.subtitle) { y += H * 0.04; fitLine(ctx, data.subtitle, M, y, W - M * 2, T * 0.024, 600, theme.sub); }

  // 2×2 stat grid
  const stats = (data.stats || []).slice(0, 4);
  const gridTop = H * 0.42, gridH = H * 0.40, colW = (W - M * 2) / 2, rowH = gridH / 2;
  stats.forEach((it, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const cx = M + colW * col + colW * 0.5;
    const cyV = gridTop + rowH * row + rowH * 0.46;
    setFont(ctx, T * 0.10, 800); ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(it.value || '—'), cx, cyV);
    setFont(ctx, T * 0.018, 600, 3); ctx.fillStyle = theme.sub;
    ctx.fillText(String(it.label || '').toUpperCase(), cx, cyV + T * 0.05);
    try { ctx.letterSpacing = '0px'; } catch {}
  });
  // grid hairlines
  hairline(ctx, W / 2, gridTop, W / 2, gridTop + gridH, theme.hairline, 2);
  hairline(ctx, M, gridTop + rowH, W - M, gridTop + rowH, theme.hairline, 2);

  footer(ctx, W, H, data, theme, assets);
}

// ── 4. Testimonial / 5-star review (engagement content) ─────────────────────
function creTestimonial(ctx, W, H, data, theme, assets) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  bg(ctx, W, H, theme);
  const M = W * 0.09;
  // oversized quotation mark
  setFont(ctx, T * 0.34, 800); ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.22;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('“', M - T * 0.01, H * 0.30);
  ctx.globalAlpha = 1;

  let y = H * 0.16;
  kicker(ctx, data.kicker || 'Client Review', M, y, theme.accent, T * 0.020, 5);

  // stars
  y = H * 0.26;
  stars(ctx, M, y, T * 0.045, 5, theme.accent);

  // the quote — large, wraps up to 6 lines, auto-fit
  y += H * 0.03;
  const q = wrapFit(ctx, data.title || 'They made the whole process effortless and got us a great result.', W - M * 2, T * 0.058, 800, 6, T * 0.03, 1.18);
  y = drawBlock(ctx, q.lines, M, y, q.px, q.lineHeight, 800, theme.ink);

  // reviewer
  if (data.subtitle) { y += H * 0.05; fitLine(ctx, '— ' + data.subtitle, M, y, W - M * 2, T * 0.026, 600, theme.sub); }
  footer(ctx, W, H, data, theme, assets);
}

// ── 5. Meet the Advisor (personal brand) ────────────────────────────────────
function creMeetAgent(ctx, W, H, data, theme, assets) {
  const T = Math.min(W, H);   // type unit: = W on portrait/square/story; = H on wide print sizes
  bg(ctx, W, H, theme);
  const M = W * 0.08;
  const portrait = (assets.headshots && assets.headshots[0]) || assets.photo;
  const r = T * 0.21, cx = W / 2, cy = H * 0.30;
  if (portrait) circleImage(ctx, portrait, cx, cy, r, theme.accent);
  else { ctx.fillStyle = theme.bg2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }

  let y = cy + r + H * 0.06;
  kicker(ctx, data.kicker || 'Meet Your Advisor', cx, y, theme.accent, T * 0.02, 5, 'center'); y += H * 0.035;
  const nm = wrapFit(ctx, data.title || (data.agents && data.agents[0] && data.agents[0].name) || 'Your Name', W - M * 2, T * 0.07, 800, 2, T * 0.05);
  setFont(ctx, nm.px, 800); ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  nm.lines.forEach((ln, i) => ctx.fillText(ln, cx, y + nm.px + i * nm.lineHeight));
  y += nm.px + (nm.lines.length - 1) * nm.lineHeight + H * 0.012;
  if (data.subtitle) { fitLine(ctx, data.subtitle, cx, y + T * 0.025, W - M * 2, T * 0.026, 600, theme.sub, 'center'); }

  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) statRow(ctx, stats, M, W / H > 1.2 ? Math.min(H * 0.80, H * 0.86 - T * 0.058 * 0.5 - T * 0.015 * 1.8) : H * 0.80, W - M * 2, theme, { valuePx: T * 0.058, labelPx: T * 0.015 });
  footer(ctx, W, H, data, theme, assets, { noAvatars: true });   // portrait is already the hero
}

// 5-pointed star row in gold.
function stars(ctx, x, y, size, n, color) {
  ctx.fillStyle = color;
  for (let s = 0; s < n; s++) {
    const cx = x + size + s * (size * 2.3), cy = y;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? size : size * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Dedicated listing templates (v2). Bottom-up "stack" layout: the footer sits on
// the bottom safe line, the key-number row sits on the footer, the address block
// sits on the row, and the photo takes whatever height is left. Every size is
// derived from one type unit `u` (= canvas width for portrait/square/story), so
// 1080×1350 reproduces the approved Open House geometry and other sizes scale.
// ════════════════════════════════════════════════════════════════════════════

const BROKERAGE = 'Gateway Real Estate Advisors';

function resetSpacing(ctx) { try { ctx.letterSpacing = '0px'; } catch { /* older engines */ } }

// Frame geometry per size. Text stays inside a 6% safe area on every side; the
// 9:16 story also keeps the top 14% and bottom 20% clear for IG/FB UI overlays.
function frameFor(W, H) {
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
function clear(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},0)` : 'rgba(13,17,23,0)';
}

function listingPhoto(ctx, W, H, f, theme, photo, photoBottom) {
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
const MARK_H = 0.078;                          // lockup height, in u (GATEWAY ≈ 3.3% of width)

function markFor(theme, assets) {
  const light = !theme.lightBg;
  return (light ? assets.markLight : assets.markDark) || null;
}
function markSize(img, h) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  return { w: h * (iw / ih), h };
}
function drawMark(ctx, img, x, y, h) {          // (x,y) = top-left; aspect preserved
  const m = markSize(img, h);
  ctx.drawImage(img, x, y, m.w, m.h);
  return m;
}

// Footer metrics (heights in u) so the stack can be planned before drawing.
// Layout: [avatar] agent text ........ [Gateway lockup]. Two agents sit in two
// columns, or one per row ("stacked") when columns would squeeze the names.
function footerPlan(ctx, data, assets, f, theme, opts = {}) {
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
function agentFooter(ctx, f, fy, plan, data, theme) {
  const { u, x0, x1 } = f;
  const brokerage = data.brokerage || BROKERAGE;
  hairline(ctx, x0, fy, x1, fy, theme.hairline, Math.max(1, u / 540));
  const bottomBase = fy + plan.height * u;
  const midY = (fy + bottomBase) / 2 + u * 0.004;

  // lockup: centred on the footer block, never above the hairline
  if (plan.mark) drawMark(ctx, plan.mark, x1 - plan.markW, Math.max(fy + u * 0.016, midY - (MARK_H * u) / 2), MARK_H * u);

  const { textR, ra, off, agents, heads } = plan;
  const small = u * 0.016, sp = 1.2 * u / 1080;
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

// Key-number row: up to 3 columns, values auto-fit per column, labels below,
// hairline dividers between. `emphasis` (index) is kept the largest value.
function keyRow(ctx, f, y, items, theme, emphasis = -1) {
  const { u, x0, x1 } = f;
  const n = items.length; if (!n) return;
  const w = x1 - x0, cellW = w / n, pad = cellW * 0.08;
  const v0 = u * 0.058, l0 = u * 0.016, lsp = 2 * u / 1080;
  const fit = items.map((it) => {
    let px = v0; setFont(ctx, px, 800);
    while (ctx.measureText(String(it.value)).width > cellW - pad * 2 && px > 6) { px -= 1; setFont(ctx, px, 800); }
    return px;
  });
  if (emphasis >= 0 && emphasis < n) {
    const cap = fit[emphasis] * 0.86;            // others stay visibly smaller
    fit.forEach((px, i) => { if (i !== emphasis) fit[i] = Math.min(px, cap); });
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  items.forEach((it, i) => {
    const cx = x0 + cellW * (i + 0.5);
    setFont(ctx, fit[i], 800); ctx.fillStyle = theme.ink; ctx.fillText(String(it.value), cx, y);
    const lab = String(it.label || '').toUpperCase();
    let lpx = l0; setFont(ctx, lpx, 600, lsp);
    while (ctx.measureText(lab).width > cellW - pad && lpx > 6) { lpx -= 1; setFont(ctx, lpx, 600, lsp); }
    ctx.fillStyle = theme.sub; ctx.fillText(lab, cx, y + v0 * 0.5 + l0 * 1.5); resetSpacing(ctx);
    if (i > 0) hairline(ctx, x0 + cellW * i, y - v0 * 0.72, x0 + cellW * i, y + l0 * 0.6, theme.hairline, Math.max(1, u / 540));
  });
  ctx.textAlign = 'left';
}

// Landscape sizing guard: at unit u, do the agent names fit at >= 80% of their
// nominal size? (Key values auto-fit per column on their own.)
function widthsFit(ctx, u, f, data, plan) {
  setFont(ctx, u * 0.025 * 0.8, 700);
  return plan.agents.every((a, i) => ctx.measureText(a.name).width <= (f.x1 - f.x0) - (plan.heads[i] ? u * 0.088 : 0));
}

// Shared photo-led listing layout: status label → address → city → key row →
// agent/brokerage footer. Used by Open House now; Slice 2 templates reuse it.
function listingStack(ctx, W, H, data, theme, assets, { label, row, emphasis }) {
  const f = frameFor(W, H);
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);

  // landscape: the Gateway lockup sits at the top of the navy panel
  const lmark = f.landscape ? markFor(theme, assets) : null;
  const lmarkH = W * 0.024 / MARK_GATEWAY_RATIO;     // "GATEWAY" = 2.4% of width
  if (lmark) f.top = H * 0.06 + lmarkH + H * 0.05;
  let plan = footerPlan(ctx, data, assets, f, theme);
  const plan_ = (u) => {
    const tw = f.x1 - f.x0;
    const hl = wrapFit(ctx, data.address || data.title || '123 Example St', tw, u * 0.060, 800, 2, u * 0.038);
    const addrH = hl.px + (hl.lines.length - 1) * hl.lineHeight;
    const fy = f.bottom - u * 0.006 - plan.height * u;   // leave room for descenders
    const rowY = fy - u * 0.0875;
    const cityY = rowY - u * 0.108;
    const addrLast = data.city ? cityY - u * 0.055 : rowY - u * 0.11;
    const addrTop = addrLast - addrH;
    const kickY = addrTop - u * 0.0275;
    const photoBottom = kickY - u * 0.0625;
    return { hl, fy, rowY, cityY, addrTop, kickY, photoBottom, top: kickY - u * 0.03 };
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
      L = { ...L, fy: L.fy - d, rowY: L.rowY - d, cityY: L.cityY - d, addrTop: L.addrTop - d, kickY: L.kickY - d };
    }
  }

  listingPhoto(ctx, W, H, f, theme, assets.photo, L.photoBottom);
  if (lmark) drawMark(ctx, lmark, f.x0, H * 0.06, lmarkH);
  if (f.landscape) plan = footerPlan(ctx, data, assets, f, theme);   // re-plan at the final u

  const { u, x0 } = f;
  // status label: solid accent bar + letterspaced caps
  ctx.fillStyle = theme.accent; ctx.fillRect(x0, L.kickY - u * 0.028, u * 0.012, u * 0.034);
  kicker(ctx, label, x0 + u * 0.028, L.kickY, theme.accent, u * 0.020, 5 * u / 1080);

  drawBlock(ctx, L.hl.lines, x0, L.addrTop, L.hl.px, L.hl.lineHeight, 800, theme.ink);
  if (data.city) fitLine(ctx, data.city, x0, L.cityY, f.x1 - x0, u * 0.028, 600, theme.sub, 'left', u * 0.018);
  const items = (row || []).filter((it) => it && String(it.value || '').trim());
  if (items.length) keyRow(ctx, f, L.rowY, items, theme, emphasis ? emphasis(items) : -1);
  agentFooter(ctx, f, L.fy, plan, data, theme);
}

// ── Open House (dedicated) ──────────────────────────────────────────────────
// data: { address, city, dateText|date, timeText|start+end, price, agents[], brokerage }
function openHouse(ctx, W, H, data, theme, assets) {
  const dateText = data.dateText || formatEventDate(data.date);
  const timeText = data.timeText || formatTimeRange(data.start, data.end);
  listingStack(ctx, W, H, data, theme, assets, {
    label: 'Open House',
    row: [
      { value: dateText, label: 'Date' },
      { value: timeText, label: 'Time' },
      { value: data.price, label: 'Price' },
    ],
    emphasis: (items) => items.findIndex((it) => it.label === 'Price'),
  });
}

export const LISTING_SIZES = ['ig-portrait', 'square', 'story', 'landscape'];

export const TEMPLATES = {
  'open-house':       { name: 'Open House', kind: 'photo', render: openHouse, sizes: LISTING_SIZES,
                        defaults: { type: 'residential', theme: 'slate', sizeId: 'ig-portrait' } },
  'cre-just-listed':  { name: 'Just Listed — For Sale', kind: 'photo', render: creJustListed },
  'cre-just-closed':  { name: 'Just Closed — Sold/Leased', kind: 'photo', render: creJustClosed },
  'cre-open-house':   { name: 'Open House (classic stats)', kind: 'photo', render: creJustListed },
  'cre-for-lease':    { name: 'For Lease', kind: 'photo', render: creJustListed },
  'cre-coming-soon':  { name: 'Coming Soon', kind: 'photo', render: creJustListed },
  'cre-stats':        { name: 'By the Numbers — Market', kind: 'data', render: creStats },
  'cre-testimonial':  { name: 'Testimonial / Review', kind: 'text', render: creTestimonial },
  'cre-meet-agent':   { name: 'Meet the Advisor', kind: 'agent', render: creMeetAgent },
};
export const TEMPLATE_ORDER = [
  'open-house', 'cre-just-listed', 'cre-just-closed', 'cre-open-house', 'cre-for-lease',
  'cre-coming-soon', 'cre-stats', 'cre-testimonial', 'cre-meet-agent',
];
