// app/social/templates.js
// Premium commercial real-estate templates. Each render() paints one graphic to
// a canvas context at the given W×H, using the design tokens + draw helpers.
// Explicit per-template layout gives precise art-direction control.

import {
  setFont, coverInto, blurExtend, vGradient, hairline, kicker,
  fitLine, wrapFit, drawBlock, circleImage, statRow, fillRoundRect,
} from './draw.js';
import { footerPlan, agentFooter } from './stack.js';
import { V2_TEMPLATES, V2_ORDER, V2_GROUPS, LISTING_SIZES } from './templates-v2.js';
export { LISTING_SIZES };

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
  // second bracket top-right (bottom-right now holds the Gateway lockup — keep it clear)
  ctx.beginPath(); ctx.moveTo(W - M, H * 0.06 + 40); ctx.lineTo(W - M, H * 0.06); ctx.lineTo(W - M - 60, H * 0.06); ctx.stroke();

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

// Classic layouts: the original generic-stat templates. Kept renderable (and
// pickable under "Classic layouts") so nothing that already exists breaks;
// the dedicated templates in templates-v2.js replace them for new work.
const CLASSIC = {
  'cre-just-listed':  { name: 'Just Listed — For Sale (classic)', kind: 'photo', render: creJustListed },
  'cre-just-closed':  { name: 'Just Closed — Sold/Leased (classic)', kind: 'photo', render: creJustClosed },
  'cre-open-house':   { name: 'Open House (classic stats)', kind: 'photo', render: creJustListed },
  'cre-for-lease':    { name: 'For Lease (classic)', kind: 'photo', render: creJustListed },
  'cre-coming-soon':  { name: 'Coming Soon (classic)', kind: 'photo', render: creJustListed },
  'cre-stats':        { name: 'By the Numbers (classic)', kind: 'data', render: creStats },
  'cre-testimonial':  { name: 'Testimonial (classic)', kind: 'text', render: creTestimonial },
  'cre-meet-agent':   { name: 'Meet the Advisor (classic)', kind: 'agent', render: creMeetAgent },
};
Object.values(CLASSIC).forEach((t) => { t.group = 'Classic layouts'; t.classic = true; });

export const TEMPLATES = { ...V2_TEMPLATES, ...CLASSIC };
export const TEMPLATE_ORDER = [...V2_ORDER, ...Object.keys(CLASSIC)];
export const TEMPLATE_GROUPS = [...V2_GROUPS, 'Classic layouts'];
