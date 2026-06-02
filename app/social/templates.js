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

  // Agent text on the left.
  const textRight = ((heads.length || assets.logo) ? rightEdge : (W - M)) - W * 0.03;
  const maxW = textRight - M;
  const nameY = fy + H * 0.044;
  const anyTitle = agents.some(a => a.title);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  if (agents.length >= 2) {
    // Two columns — each agent's title (accent/highlighted) and phone sit
    // directly under their name, so there's no ambiguity about whose is whose.
    const colW = (textRight - M) / 2;
    agents.slice(0, 2).forEach((a, i) => {
      const cx = M + colW * i, cw = colW - W * 0.025;
      let yy = nameY;
      fitLine(ctx, a.name, cx, yy, cw, W * 0.023, 700, theme.ink, 'left'); yy += H * 0.026;
      if (a.title) { fitLine(ctx, a.title, cx, yy, cw, W * 0.0155, 700, theme.accent, 'left'); yy += H * 0.024; }
      if (a.phone) { setFont(ctx, W * 0.016, 600); ctx.fillStyle = theme.sub; ctx.textAlign = 'left'; ctx.fillText(a.phone, cx, yy); }
    });
    // Brokerage line only when there's vertical room (no titles crowding it).
    if (data.brokerage && !anyTitle) { setFont(ctx, W * 0.014, 600, 2); ctx.fillStyle = theme.faint || theme.sub; ctx.fillText(data.brokerage.toUpperCase(), M, nameY + H * 0.058); }
  } else if (agents.length === 1) {
    const a = agents[0]; let yy = nameY;
    fitLine(ctx, a.name, M, yy, maxW, W * 0.027, 700, theme.ink, 'left'); yy += H * 0.030;
    if (a.title) { fitLine(ctx, a.title, M, yy, maxW, W * 0.018, 700, theme.accent, 'left'); yy += H * 0.026; }
    const line2 = [a.phone, data.brokerage].filter(Boolean).join('   ·   ');
    if (line2) { setFont(ctx, W * 0.016, 600, 1.2); ctx.fillStyle = theme.sub; ctx.fillText(line2, M, yy); }
  } else if (data.brokerage) {
    setFont(ctx, W * 0.02, 600, 2); ctx.fillStyle = theme.sub; ctx.fillText(data.brokerage.toUpperCase(), M, fy + H * 0.055);
  }
  try { ctx.letterSpacing = '0px'; } catch {}
}

function bg(ctx, W, H, theme) {
  vGradient(ctx, 0, 0, W, H, [[0, theme.bg1], [0.55, theme.bg2], [1, theme.bg1]]);
}

// Shared lower block for listing templates: address headline -> City, State ->
// detail subtitle -> stat row. Uses a flowing cursor and an adaptive stat-row
// position so lines never overlap regardless of how long the address is.
function listingBody(ctx, W, H, data, theme, startY) {
  const M = W * 0.07;
  const hl = wrapFit(ctx, data.title || 'Property Address', W - M * 2, W * 0.060, 800, 2, W * 0.038);
  let y = drawBlock(ctx, hl.lines, M, startY, hl.px, hl.lineHeight, 800, theme.ink);
  if (data.city) { y += H * 0.044; fitLine(ctx, data.city, M, y, W - M * 2, W * 0.028, 600, theme.sub, 'left'); }
  if (data.subtitle) { y += H * 0.036; fitLine(ctx, data.subtitle, M, y, W - M * 2, W * 0.022, 600, theme.faint || theme.sub, 'left'); }
  const stats = (data.stats || []).slice(0, 3);
  if (stats.length) {
    const statY = Math.min(H * 0.815, Math.max(H * 0.80, y + H * 0.085));
    statRow(ctx, stats, M, statY, W - M * 2, theme, { valuePx: W * 0.058, labelPx: W * 0.016 });
  }
}

// ── 1. Just Listed / For Sale (photo-led) ───────────────────────────────────
function creJustListed(ctx, W, H, data, theme, assets) {
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
  ctx.fillStyle = theme.accent; ctx.fillRect(M, ky - W * 0.028, W * 0.012, W * 0.034);
  kicker(ctx, data.kicker || 'For Sale', M + W * 0.028, ky, theme.accent, W * 0.020, 5);

  listingBody(ctx, W, H, data, theme, ky + H * 0.022);
  footer(ctx, W, H, data, theme, assets);
}

// ── 2. Just Closed / Sold (social proof) ────────────────────────────────────
function creJustClosed(ctx, W, H, data, theme, assets) {
  bg(ctx, W, H, theme);
  const M = W * 0.07;
  const photoH = Math.round(H * 0.5);
  if (assets.photo) { blurExtend(ctx, assets.photo, 0, 0, W, photoH); coverInto(ctx, assets.photo, 0, 0, W, photoH); }
  // pill badge
  const bw = W * 0.46, bh = H * 0.062, bx = M, by = photoH - bh - H * 0.03;
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
