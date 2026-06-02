// app/social/templates.js
// Premium commercial real-estate templates. Each render() paints one graphic to
// a canvas context at the given W×H, using the design tokens + draw helpers.
// Explicit per-template layout gives precise art-direction control.

import {
  setFont, coverInto, blurExtend, vGradient, hairline, kicker,
  fitLine, wrapFit, drawBlock, circleImage, statRow, fillRoundRect,
} from './draw.js';

// Shared footer band: up to TWO agents (co-listings) + brokerage left,
// one or two headshots right. Falls back to single-agent / logo.
function footer(ctx, W, H, data, theme, assets) {
  const M = W * 0.07;
  const fy = H - H * 0.13;
  hairline(ctx, M, fy, W - M, fy, theme.hairline, 2);

  const agents = (Array.isArray(data.agents) && data.agents.length)
    ? data.agents.filter(a => a && a.name)
    : (data.agent ? [{ name: data.agent, phone: data.phone }] : []);
  const heads = (Array.isArray(assets.headshots) && assets.headshots.length)
    ? assets.headshots.filter(Boolean)
    : (assets.headshot ? [assets.headshot] : []);

  // Headshots on the right (1–2 circles, side by side).
  const r = W * 0.052, cy = fy + H * 0.052;
  let rightEdge = W - M;
  for (let i = heads.length - 1; i >= 0 && i >= heads.length - 2; i--) {
    circleImage(ctx, heads[i], rightEdge - r, cy, r, theme.accent);
    rightEdge -= (r * 2 + W * 0.016);
  }
  if (!heads.length && assets.logo) circleImage(ctx, assets.logo, W - M - r, cy, r, theme.hairline);

  // Agent text on the left (auto-fit so two names never overflow).
  const textRight = (heads.length ? rightEdge : (W - M)) - W * 0.03;
  const maxW = textRight - M;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (agents.length) {
    const names = agents.map(a => a.name).join('   &   ');
    fitLine(ctx, names, M, fy + H * 0.05, maxW, W * 0.027, 700, theme.ink, 'left');
    const phones = agents.map(a => a.phone).filter(Boolean).join('   ·   ');
    const line2 = [phones, data.brokerage].filter(Boolean).join('   ·   ');
    if (line2) { setFont(ctx, W * 0.017, 600, 1.2); ctx.fillStyle = theme.sub; ctx.fillText(line2, M, fy + H * 0.05 + H * 0.030); }
  } else if (data.brokerage) {
    setFont(ctx, W * 0.02, 600, 2); ctx.fillStyle = theme.sub; ctx.fillText(data.brokerage.toUpperCase(), M, fy + H * 0.055);
  }
  try { ctx.letterSpacing = '0px'; } catch {}
}

function bg(ctx, W, H, theme) {
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);
}

// ── 1. Just Listed / For Sale (photo-led) ───────────────────────────────────
function creJustListed(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.07;
  const photoH = Math.round(H * 0.56);
  if (assets.photo) {
    blurExtend(ctx, assets.photo, 0, 0, W, photoH, 0.0);
    coverInto(ctx, assets.photo, 0, 0, W, photoH);
  } else { vGradient(ctx, 0, 0, W, photoH, [[0, theme.bg2], [1, theme.bg1]]); }
  // scrim fading photo into the panel
  vGradient(ctx, 0, photoH - H * 0.18, W, H * 0.18, [[0, 'rgba(13,17,23,0)'], [1, theme.bg1]]);

  // gold accent bar + kicker
  let y = photoH + H * 0.055;
  ctx.fillStyle = theme.accent; ctx.fillRect(M, y - W * 0.028, W * 0.012, W * 0.034);
  kicker(ctx, data.kicker || 'For Sale', M + W * 0.028, y, theme.accent, W * 0.020, 5);

  // headline (address / property name), auto-fit to 2 lines
  y += H * 0.012;
  const hl = wrapFit(ctx, data.title || 'Property Address', W - M * 2, W * 0.062, 800, 2, W * 0.04);
  drawBlock(ctx, hl.lines, M, y, hl.px, hl.lineHeight, 800, theme.ink);
  y += hl.px + (hl.lines.length - 1) * hl.lineHeight + H * 0.02;

  if (data.subtitle) { fitLine(ctx, data.subtitle, M, y + W * 0.022, W - M * 2, W * 0.026, 600, theme.sub); y += H * 0.04; }

  // stat row
  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) statRow(ctx, stats, M, H * 0.80, W - M * 2, theme, { valuePx: W * 0.06, labelPx: W * 0.016 });

  footer(ctx, W, H, data, theme, assets);
}

// ── 2. Just Closed / Sold (social proof) ────────────────────────────────────
function creJustClosed(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.07;
  const photoH = Math.round(H * 0.5);
  if (assets.photo) { blurExtend(ctx, assets.photo, 0, 0, W, photoH); coverInto(ctx, assets.photo, 0, 0, W, photoH); }
  // big translucent "CLOSED" sash badge
  const bw = W * 0.46, bh = H * 0.066, bx = M, by = photoH - bh - H * 0.03;
  fillRoundRect(ctx, bx, by, bw, bh, bh / 2, theme.accent);
  setFont(ctx, bh * 0.42, 800, 4); ctx.fillStyle = theme.accentInk; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText((data.kicker || 'JUST CLOSED').toUpperCase(), bx + bw * 0.08, by + bh / 2);
  try { ctx.letterSpacing = '0px'; } catch {}
  ctx.textBaseline = 'alphabetic';
  vGradient(ctx, 0, photoH - H * 0.16, W, H * 0.16, [[0, 'rgba(13,17,23,0)'], [1, theme.bg1]]);

  let y = photoH + H * 0.05;
  const hl = wrapFit(ctx, data.title || 'Property Address', W - M * 2, W * 0.058, 800, 2, W * 0.038);
  drawBlock(ctx, hl.lines, M, y, hl.px, hl.lineHeight, 800, theme.ink);
  y += hl.px + (hl.lines.length - 1) * hl.lineHeight + H * 0.022;
  if (data.subtitle) { fitLine(ctx, data.subtitle, M, y + W * 0.02, W - M * 2, W * 0.024, 600, theme.sub); }

  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) statRow(ctx, stats, M, H * 0.80, W - M * 2, theme, { valuePx: W * 0.06, labelPx: W * 0.016 });
  footer(ctx, W, H, data, theme, assets);
}

// ── 3. By the Numbers (data-led market/investment card) ─────────────────────
function creStats(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.08;
  // accent corner brackets for an institutional feel
  ctx.strokeStyle = theme.hairline; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, H * 0.06 + 40); ctx.lineTo(M, H * 0.06); ctx.lineTo(M + 60, H * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - M, H * 0.94 - 40); ctx.lineTo(W - M, H * 0.94); ctx.lineTo(W - M - 60, H * 0.94); ctx.stroke();

  let y = H * 0.16;
  kicker(ctx, data.kicker || 'By the Numbers', M, y, theme.accent, W * 0.022, 6);
  y += H * 0.045;
  const hl = wrapFit(ctx, data.title || 'Market Snapshot', W - M * 2, W * 0.066, 800, 2, W * 0.044);
  y = drawBlock(ctx, hl.lines, M, y, hl.px, hl.lineHeight, 800, theme.ink);
  if (data.subtitle) { y += H * 0.04; fitLine(ctx, data.subtitle, M, y, W - M * 2, W * 0.024, 600, theme.sub); }

  // 2×2 stat grid
  const stats = (data.stats || []).slice(0, 4);
  const gridTop = H * 0.42, gridH = H * 0.40, colW = (W - M * 2) / 2, rowH = gridH / 2;
  stats.forEach((it, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const cx = M + colW * col + colW * 0.5;
    const cyV = gridTop + rowH * row + rowH * 0.46;
    setFont(ctx, W * 0.10, 800); ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(it.value || '—'), cx, cyV);
    setFont(ctx, W * 0.018, 600, 3); ctx.fillStyle = theme.sub;
    ctx.fillText(String(it.label || '').toUpperCase(), cx, cyV + W * 0.05);
    try { ctx.letterSpacing = '0px'; } catch {}
  });
  // grid hairlines
  hairline(ctx, W / 2, gridTop, W / 2, gridTop + gridH, theme.hairline, 2);
  hairline(ctx, M, gridTop + rowH, W - M, gridTop + rowH, theme.hairline, 2);

  footer(ctx, W, H, data, theme, assets);
}

// ── 4. Testimonial / 5-star review (engagement content) ─────────────────────
function creTestimonial(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.09;
  // oversized quotation mark
  setFont(ctx, W * 0.34, 800); ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.22;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('“', M - W * 0.01, H * 0.30);
  ctx.globalAlpha = 1;

  let y = H * 0.16;
  kicker(ctx, data.kicker || 'Client Review', M, y, theme.accent, W * 0.020, 5);

  // stars
  y = H * 0.26;
  stars(ctx, M, y, W * 0.045, 5, theme.accent);

  // the quote — large, wraps up to 6 lines, auto-fit
  y += H * 0.03;
  const q = wrapFit(ctx, data.title || 'They made the whole process effortless and got us a great result.', W - M * 2, W * 0.058, 800, 6, W * 0.03, 1.18);
  y = drawBlock(ctx, q.lines, M, y, q.px, q.lineHeight, 800, theme.ink);

  // reviewer
  if (data.subtitle) { y += H * 0.05; fitLine(ctx, '— ' + data.subtitle, M, y, W - M * 2, W * 0.026, 600, theme.sub); }
  footer(ctx, W, H, data, theme, assets);
}

// ── 5. Meet the Advisor (personal brand) ────────────────────────────────────
function creMeetAgent(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.08;
  const portrait = (assets.headshots && assets.headshots[0]) || assets.photo;
  const r = W * 0.21, cx = W / 2, cy = H * 0.30;
  if (portrait) circleImage(ctx, portrait, cx, cy, r, theme.accent);
  else { ctx.fillStyle = theme.bg2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }

  let y = cy + r + H * 0.06;
  kicker(ctx, data.kicker || 'Meet Your Advisor', cx, y, theme.accent, W * 0.02, 5, 'center'); y += H * 0.035;
  const nm = wrapFit(ctx, data.title || (data.agents && data.agents[0] && data.agents[0].name) || 'Your Name', W - M * 2, W * 0.07, 800, 2, W * 0.05);
  setFont(ctx, nm.px, 800); ctx.fillStyle = theme.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  nm.lines.forEach((ln, i) => ctx.fillText(ln, cx, y + nm.px + i * nm.lineHeight));
  y += nm.px + (nm.lines.length - 1) * nm.lineHeight + H * 0.012;
  if (data.subtitle) { fitLine(ctx, data.subtitle, cx, y + W * 0.025, W - M * 2, W * 0.026, 600, theme.sub, 'center'); }

  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) statRow(ctx, stats, M, H * 0.80, W - M * 2, theme, { valuePx: W * 0.058, labelPx: W * 0.015 });
  footer(ctx, W, H, data, theme, assets);
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

export const TEMPLATES = {
  'cre-just-listed':  { name: 'Just Listed — For Sale', kind: 'photo', render: creJustListed },
  'cre-just-closed':  { name: 'Just Closed — Sold/Leased', kind: 'photo', render: creJustClosed },
  'cre-open-house':   { name: 'Open House', kind: 'photo', render: creJustListed },
  'cre-for-lease':    { name: 'For Lease', kind: 'photo', render: creJustListed },
  'cre-coming-soon':  { name: 'Coming Soon', kind: 'photo', render: creJustListed },
  'cre-stats':        { name: 'By the Numbers — Market', kind: 'data', render: creStats },
  'cre-testimonial':  { name: 'Testimonial / Review', kind: 'text', render: creTestimonial },
  'cre-meet-agent':   { name: 'Meet the Advisor', kind: 'agent', render: creMeetAgent },
};
export const TEMPLATE_ORDER = [
  'cre-just-listed', 'cre-just-closed', 'cre-open-house', 'cre-for-lease',
  'cre-coming-soon', 'cre-stats', 'cre-testimonial', 'cre-meet-agent',
];
