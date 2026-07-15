// app/video/renderer.js
// The canvas engine. drawFrame() is a pure function of (model, timeSeconds):
// it paints exactly one frame. The same function powers the live preview
// scrubber AND the final encode, so the agent's preview === the download.

import { cameraFor, boundaryBlackAlpha, easeOut, easeInOut, clamp01, lerp } from './animations.js';

// Resolve which scene is on screen at time t, plus the scene-local time.
function sceneAt(model, t) {
  let acc = 0;
  for (let i = 0; i < model.scenes.length; i++) {
    const d = model.scenes[i].durationSec;
    if (t < acc + d || i === model.scenes.length - 1) {
      return { scene: model.scenes[i], index: i, localT: clamp01Range(t - acc, 0, d), dur: d };
    }
    acc += d;
  }
  return null;
}
function clamp01Range(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function totalDuration(model) {
  return model.scenes.reduce((s, sc) => s + sc.durationSec, 0);
}

/**
 * Paint one frame.
 * @param {Object} model  composition model (see scene-model.js)
 * @param {number} t      time in seconds
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W canvas width
 * @param {number} H canvas height
 */
export function drawFrame(model, t, ctx, W, H) {
  const hit = sceneAt(model, t);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = model.brand.bg || '#0D1117';
  ctx.fillRect(0, 0, W, H);
  if (!hit) return;

  const { scene, index, localT, dur } = hit;

  if (scene.kind === 'photo') drawPhotoScene(scene, index, localT, dur, ctx, W, H, model);
  else                        drawCardScene(scene, localT, dur, ctx, W, H, model);

  // Cross-scene fade through black at the boundaries.
  const a = boundaryBlackAlpha(localT, dur);
  if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#0D1117'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ── Photo scene: full-bleed image with Ken Burns + gradient + text ──────────
function drawPhotoScene(scene, index, localT, dur, ctx, W, H, model) {
  const p = dur > 0 ? localT / dur : 0;
  if (scene.image) {
    if (scene.anim === 'scan') {
      drawScan(ctx, scene.image, W, H, p, index);
    } else {
      const cam = cameraFor(scene.anim || 'kenburns', index, p);
      drawCover(ctx, scene.image, W, H, cam.scale, cam.panX, cam.panY);
    }
  }

  // Bottom scrim for text legibility.
  if ((scene.texts && scene.texts.length) || scene.heroText) {
    const g = ctx.createLinearGradient(0, H * 0.40, 0, H);
    g.addColorStop(0, 'rgba(13,17,23,0)');
    g.addColorStop(0.6, 'rgba(13,17,23,0.55)');
    g.addColorStop(1, 'rgba(13,17,23,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  if (scene.heroText) drawHeroStack(ctx, scene.heroText, localT, W, H, model);
  drawTexts(scene.texts || [], localT, ctx, W, H, model);
}

// Hero overlay laid out as a measured, bottom-anchored stack so a wrapping
// address never collides with the badge above it (the old bug). Order bottom
// -> top: price, address (wraps), badge pill.
function drawHeroStack(ctx, hero, localT, W, H, model) {
  const x = W * 0.06;
  const gap = H * 0.022;
  let bottom = H * 0.93;
  if (hero.price)   bottom = drawTextBlock(ctx, model, hero.price,   x, bottom, Math.round(H * 0.044), 200, '#F5F5F3', localT, 1.4, W * 0.88) - gap;
  if (hero.address) bottom = drawTextBlock(ctx, model, hero.address, x, bottom, Math.round(H * 0.052), 300, '#F5F5F3', localT, 0.9, W * 0.86) - gap * 1.4;
  if (hero.badge)   drawBadge(ctx, model, hero.badge, x, bottom, H, localT, 0.5);
}

// Draws wrapped text whose BOTTOM sits at `bottom`; returns the block's TOP y.
function drawTextBlock(ctx, model, text, x, bottom, fs, weight, color, localT, delay, maxW) {
  setFont(ctx, model, fs, weight, 0);
  const lines = wrapLines(ctx, text, maxW);
  const lh = fs * 1.16;
  const top = bottom - lines.length * lh;
  const reveal = easeOut(clamp01((localT - delay) / 0.7));
  if (reveal <= 0) return top;
  const rise = (1 - reveal) * 18;
  ctx.globalAlpha = reveal; ctx.fillStyle = color; ctx.textAlign = 'left';
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, top + i * lh + fs * 0.82 - rise);
  ctx.globalAlpha = 1;
  return top;
}

// Filled "pill" badge (e.g. JUST SOLD) — larger and visually distinct.
function drawBadge(ctx, model, text, x, bottom, H, localT, delay) {
  const reveal = easeOut(clamp01((localT - delay) / 0.7));
  if (reveal <= 0) return;
  const fs = Math.round(H * 0.027);
  setFont(ctx, model, fs, 700, 2);
  const label = String(text).toUpperCase();
  const tw = ctx.measureText(label).width;
  const padX = fs * 0.75, padY = fs * 0.5;
  const bw = tw + padX * 2, bh = fs + padY * 2;
  const top = bottom - bh;
  const rise = (1 - reveal) * 18;
  ctx.globalAlpha = reveal;
  roundRect(ctx, x, top - rise, bw, bh, bh / 2);
  ctx.fillStyle = '#C8A84B'; ctx.fill();
  setFont(ctx, model, fs, 700, 2);
  ctx.fillStyle = '#0D1117'; ctx.textAlign = 'left';
  ctx.fillText(label, x + padX, top - rise + padY + fs * 0.80);
  ctx.globalAlpha = 1;
  try { ctx.letterSpacing = '0px'; } catch { /* older engines */ }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Card scene: solid/branded background with centered stacked lines ────────
function drawCardScene(scene, localT, dur, ctx, W, H, model) {
  // subtle vertical brand gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0D1117'); g.addColorStop(0.55, '#131E27'); g.addColorStop(1, '#0D1117');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Agent headshot (circular, framed) takes the top slot when provided;
  // otherwise the brand logo.
  if (scene.headshot) {
    const a = easeOut(clamp01((localT - 0.2) / 0.8));
    const r = Math.min(W, H) * (scene.headshotR || 0.16);
    drawCircleImage(ctx, scene.headshot, W / 2, H * (scene.headshotY || 0.27), r, a);
  } else if (scene.logo) {
    const lw = Math.round(W * (scene.logoScale || 0.14));
    const la = clamp01((localT - 0.2) / 0.8);
    ctx.globalAlpha = easeOut(la);
    const lx = (W - lw) / 2, ly = H * (scene.logoY || 0.30);
    ctx.drawImage(scene.logo, lx, ly, lw, lw);
    ctx.globalAlpha = 1;
  }

  if (scene.columns) drawStatColumns(scene.columns, localT, ctx, W, H, model);
  drawTexts(scene.texts || [], localT, ctx, W, H, model);
}

// Draw an image cropped to a circle with a thin gold ring (agent headshot).
function drawCircleImage(ctx, img, cx, cy, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  coverInto(ctx, img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, r * 0.045); ctx.strokeStyle = 'rgba(200,168,75,0.85)'; ctx.stroke();
  ctx.restore();
}

// object-fit: cover an image into the box (x,y,w,h).
function coverInto(ctx, img, x, y, w, h) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  const ar = iw / ih, car = w / h; let dw, dh;
  if (ar > car) { dh = h; dw = dh * ar; } else { dw = w; dh = dw / ar; }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Stat columns (beds · baths · sqft) with a thin divider between each.
function drawStatColumns(cols, localT, ctx, W, H, model) {
  const n = cols.length; if (!n) return;
  const cy = H * 0.5;
  const colW = Math.min(W * 0.9 / n, W * 0.34);
  const totalW = colW * n;
  const startX = (W - totalW) / 2;
  ctx.textAlign = 'center';
  // Leave a gutter so neighbouring columns never touch. Commercial values like
  // "$210,975" are far wider than short residential ones ("3"), so each value's
  // font auto-shrinks to fit its column instead of overflowing into the next.
  const fit = W * 0.02;                 // horizontal padding inside each column
  const maxTextW = colW - fit * 2;
  cols.forEach((c, i) => {
    const cx = startX + colW * (i + 0.5);
    const reveal = easeOut(clamp01((localT - 0.3 - i * 0.18) / 0.7));
    if (reveal <= 0) return;
    ctx.globalAlpha = reveal;
    // value — start at the display size, shrink to fit the column width.
    const valStr = String(c.value || '—');
    let vfs = Math.round(H * 0.085);
    setFont(ctx, model, vfs, 200);
    let vw = ctx.measureText(valStr).width;
    if (vw > maxTextW) {
      vfs = Math.max(Math.round(H * 0.03), Math.floor(vfs * maxTextW / vw));
      setFont(ctx, model, vfs, 200);
    }
    ctx.fillStyle = '#F5F5F3';
    ctx.fillText(valStr, cx, cy);
    // label — also fit, dropping letter-spacing first if it would overflow.
    const labStr = String(c.label || '').toUpperCase();
    let lfs = Math.round(H * 0.016), ls = 4;
    setFont(ctx, model, lfs, 400, ls);
    if (ctx.measureText(labStr).width > maxTextW) { ls = 1; setFont(ctx, model, lfs, 400, ls); }
    if (ctx.measureText(labStr).width > maxTextW) {
      lfs = Math.max(Math.round(H * 0.011), Math.floor(lfs * maxTextW / ctx.measureText(labStr).width));
      setFont(ctx, model, lfs, 400, ls);
    }
    ctx.fillStyle = 'rgba(162,182,192,0.6)';
    ctx.fillText(labStr, cx, cy + H * 0.07);
    ctx.globalAlpha = 1;
    if (i > 0) { // divider
      ctx.fillStyle = 'rgba(162,182,192,0.2)';
      ctx.fillRect(startX + colW * i - 1, cy - H * 0.04, 2, H * 0.08);
    }
  });
  ctx.textAlign = 'left';
  try { ctx.letterSpacing = '0px'; } catch { /* older engines */ }
}

// Generic text layers. Each text: {text, x, y, size, weight, color, align,
// letterSpacing, delay, maxWidth, transform}. x/y are fractions of W/H.
function drawTexts(texts, localT, ctx, W, H, model) {
  for (const tx of texts) {
    if (!tx.text) continue;
    const reveal = easeOut(clamp01((localT - (tx.delay || 0)) / 0.7));
    if (reveal <= 0) continue;
    const rise = (1 - reveal) * H * 0.02; // subtle upward entrance
    ctx.globalAlpha = reveal;
    ctx.fillStyle = tx.color || '#F5F5F3';
    ctx.textAlign = tx.align || 'left';
    setFont(ctx, model, Math.round(H * (tx.size || 0.04)), tx.weight || 300, tx.letterSpacing || 0);
    const label = tx.transform === 'upper' ? String(tx.text).toUpperCase() : String(tx.text);
    const px = W * (tx.x ?? 0.06);
    const py = H * (tx.y ?? 0.85) - rise;
    drawTextWrapped(ctx, label, px, py, (tx.maxWidth ?? 0.88) * W, Math.round(H * (tx.size || 0.04) * 1.15));
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

// ── helpers ─────────────────────────────────────────────────────────────────

// Draw an image to cover WxH with extra `scale` and fractional pan offsets.
// `scale` should be >= 1; cover-fit guarantees no letterboxing.
function drawCover(ctx, img, W, H, scale = 1, panX = 0, panY = 0) {
  const iw = img.width || img.videoWidth || img.naturalWidth;
  const ih = img.height || img.videoHeight || img.naturalHeight;
  if (!iw || !ih) return;
  const imgAR = iw / ih, canvasAR = W / H;
  let dw, dh;
  if (imgAR > canvasAR) { dh = H * scale; dw = dh * imgAR; }
  else                  { dw = W * scale; dh = dw / imgAR; }
  const dx = (W - dw) / 2 + panX * W;
  const dy = (H - dh) / 2 + panY * H;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// "Room scan" — zoom in slightly so the cover image overflows the frame, then
// glide across the longer axis from one edge to the other so the viewer sees
// the whole room as if the camera is panning. Direction alternates per scene
// index so consecutive photos sweep opposite ways. Fully deterministic.
function drawScan(ctx, img, W, H, p, index) {
  const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  const imgAR = iw / ih, canvasAR = W / H;
  const zoom = 1.12;
  let dw, dh;
  if (imgAR > canvasAR) { dh = H; dw = dh * imgAR; } else { dw = W; dh = dw / imgAR; }
  dw *= zoom; dh *= zoom;
  const overX = dw - W, overY = dh - H;
  const e = easeInOut(p);
  // Travel a fraction of the available overflow (not edge-to-edge) so the pan
  // reads as a slow, smooth glide rather than a fast sweep.
  const TRAVEL = 0.72;
  let dx = (W - dw) / 2, dy = (H - dh) / 2;
  if (overX >= overY) {
    const span = (overX / 2) * TRAVEL;
    dx += (index % 2) ? lerp(-span, span, e) : lerp(span, -span, e);
  } else {
    const span = (overY / 2) * TRAVEL;
    dy += (index % 2) ? lerp(-span, span, e) : lerp(span, -span, e);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function setFont(ctx, model, px, weight = 400, letterSpacing = 0) {
  const fam = model.brand.font || 'Inter, system-ui, -apple-system, sans-serif';
  ctx.font = `${weight} ${px}px ${fam}`;
  // letterSpacing is supported on Canvas2D in modern browsers; guard it.
  try { ctx.letterSpacing = letterSpacing ? `${letterSpacing}px` : '0px'; } catch { /* older engines */ }
}

// Split text into lines that fit maxWidth (uses the ctx's current font).
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  let line = '', lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawTextWrapped(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapLines(ctx, text, maxWidth);
  // anchor the block so its last line sits at y (bottom-aligned captions)
  const startY = y - (lines.length - 1) * lineHeight;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
}
