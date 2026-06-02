// app/social/templates.js
// Premium commercial real-estate templates. Each render() paints one graphic to
// a canvas context at the given W×H, using the design tokens + draw helpers.
// Explicit per-template layout gives precise art-direction control.

import {
  setFont, coverInto, blurExtend, vGradient, hairline, kicker,
  fitLine, wrapFit, drawBlock, circleImage, statRow, fillRoundRect,
} from './draw.js';

// Shared footer band: agent + phone left, brokerage kicker, headshot/logo right.
function footer(ctx, W, H, data, theme, assets, onLight) {
  const M = W * 0.07;
  const fy = H - H * 0.13;
  hairline(ctx, M, fy, W - M, fy, theme.hairline, 2);
  const baseY = fy + H * 0.055;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (data.agent) { setFont(ctx, W * 0.027, 700); ctx.fillStyle = theme.ink; ctx.fillText(data.agent, M, baseY); }
  const line2 = [data.phone, data.brokerage].filter(Boolean).join('   ·   ');
  if (line2) { setFont(ctx, W * 0.018, 600, 1.5); ctx.fillStyle = theme.sub; ctx.fillText(line2, M, baseY + H * 0.032); }
  // right side: headshot circle, else logo coin
  const r = W * 0.055, cx = W - M - r, cy = fy + H * 0.052;
  if (assets.headshot) circleImage(ctx, assets.headshot, cx, cy, r, theme.accent);
  else if (assets.logo) circleImage(ctx, assets.logo, cx, cy, r, theme.hairline);
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

export const TEMPLATES = {
  'cre-just-listed': { name: 'Just Listed — For Sale', kind: 'photo', render: creJustListed },
  'cre-just-closed': { name: 'Just Closed — Sold/Leased', kind: 'photo', render: creJustClosed },
  'cre-stats':       { name: 'By the Numbers — Market', kind: 'data', render: creStats },
};
export const TEMPLATE_ORDER = ['cre-just-listed', 'cre-just-closed', 'cre-stats'];
