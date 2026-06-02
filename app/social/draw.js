// app/social/draw.js
// Shared canvas helpers, tuned for premium, legible layouts. Pure drawing —
// no state. Templates orchestrate these against the design tokens.

import { FONT } from './design-tokens.js';

export function setFont(ctx, px, weight = 400, spacing = 0) {
  ctx.font = `${weight} ${Math.round(px)}px ${FONT}`;
  try { ctx.letterSpacing = spacing ? `${spacing}px` : '0px'; } catch { /* older engines */ }
}

// object-fit: cover an image into box (x,y,w,h).
export function coverInto(ctx, img, x, y, w, h) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  const ar = iw / ih, car = w / h; let dw, dh;
  if (ar > car) { dh = h; dw = dh * ar; } else { dw = w; dh = dw / ar; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

// Blur-extend: fill the box with a blurred, zoomed copy of the image so a photo
// of any aspect ratio fills cleanly behind a contained version — no ugly bars.
export function blurExtend(ctx, img, x, y, w, h, darken = 0.0) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  try { ctx.filter = 'blur(46px)'; } catch { /* ignore */ }
  coverInto(ctx, img, x - 40, y - 40, w + 80, h + 80);
  ctx.filter = 'none';
  if (darken > 0) { ctx.fillStyle = `rgba(13,17,23,${darken})`; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}

export function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundPath(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}
export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function vGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

export function hairline(ctx, x1, y1, x2, y2, color, lw = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// Letterspaced uppercase kicker. Returns its width.
export function kicker(ctx, text, x, y, color, px, spacing, align = 'left') {
  setFont(ctx, px, 600, spacing);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(text).toUpperCase(), x, y);
  const w = ctx.measureText(String(text).toUpperCase()).width;
  try { ctx.letterSpacing = '0px'; } catch {}
  return w;
}

// Single line auto-shrunk to fit maxW (never overflows). Draws at baseline y.
export function fitLine(ctx, text, x, y, maxW, startPx, weight, color, align = 'left', minPx = 14) {
  let px = startPx;
  setFont(ctx, px, weight);
  while (ctx.measureText(text).width > maxW && px > minPx) { px -= 2; setFont(ctx, px, weight); }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  return px;
}

// Wrap to <= maxLines, shrinking font until it fits. Returns {lines, px, lineHeight}.
export function wrapFit(ctx, text, maxW, startPx, weight, maxLines = 2, minPx = 24, lineRatio = 1.08) {
  let px = startPx;
  for (;;) {
    setFont(ctx, px, weight);
    const lines = wrapLines(ctx, text, maxW);
    if (lines.length <= maxLines || px <= minPx) {
      return { lines: lines.slice(0, maxLines), px, lineHeight: px * lineRatio };
    }
    px -= 3;
  }
}
export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/); let line = '', out = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// draw a wrapped block top-anchored at y (baseline of first line ~ y+px).
export function drawBlock(ctx, lines, x, y, px, lineHeight, weight, color, align = 'left') {
  setFont(ctx, px, weight);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + px + i * lineHeight));
  return y + px + (lines.length - 1) * lineHeight; // baseline of last line
}

// Circular image with a ring (agent headshot / logo coin).
export function circleImage(ctx, img, cx, cy, r, ring) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  coverInto(ctx, img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  if (ring) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, r * 0.05); ctx.strokeStyle = ring; ctx.stroke();
  }
}

// A row of big stat tiles separated by hairlines: [{value,label}].
// Each value AND label auto-shrinks to fit its column (with padding) so a long
// number like "$2,080,000" never overruns into the next column or the divider.
export function statRow(ctx, items, x, y, w, theme, opts = {}) {
  const n = items.length; if (!n) return;
  const valuePx0 = opts.valuePx || w * 0.085;
  const labelPx0 = opts.labelPx || w * 0.018;
  const cellW = w / n;
  const pad = cellW * 0.12;                 // keep clear of the dividers
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  items.forEach((it, i) => {
    const cx = x + cellW * (i + 0.5);
    // value — shrink to fit the cell
    const valStr = String(it.value || '—');
    let vpx = valuePx0; setFont(ctx, vpx, 800);
    while (ctx.measureText(valStr).width > cellW - pad * 2 && vpx > valuePx0 * 0.42) { vpx -= 2; setFont(ctx, vpx, 800); }
    ctx.fillStyle = theme.ink; ctx.fillText(valStr, cx, y);
    // label — shrink to fit too
    const lab = String(it.label || '').toUpperCase();
    let lpx = labelPx0; setFont(ctx, lpx, 600, 2);
    while (ctx.measureText(lab).width > cellW - pad && lpx > labelPx0 * 0.6) { lpx -= 1; setFont(ctx, lpx, 600, 2); }
    ctx.fillStyle = theme.sub; ctx.fillText(lab, cx, y + valuePx0 * 0.5 + labelPx0 * 1.5);
    try { ctx.letterSpacing = '0px'; } catch {}
    if (i > 0) hairline(ctx, x + cellW * i, y - valuePx0 * 0.72, x + cellW * i, y + labelPx0 * 0.6, theme.hairline, 2);
  });
}
