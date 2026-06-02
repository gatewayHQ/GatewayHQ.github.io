// app/video/renderer.js
// The canvas engine. drawFrame() is a pure function of (model, timeSeconds):
// it paints exactly one frame. The same function powers the live preview
// scrubber AND the final encode, so the agent's preview === the download.

import { cameraFor, boundaryBlackAlpha, easeOut, clamp01, lerp } from './animations.js';

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
  const cam = cameraFor(scene.anim || 'kenburns', index, p);
  if (scene.image) drawCover(ctx, scene.image, W, H, cam.scale, cam.panX, cam.panY);

  // Bottom scrim for text legibility.
  if (scene.texts && scene.texts.length) {
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(13,17,23,0)');
    g.addColorStop(0.65, 'rgba(13,17,23,0.55)');
    g.addColorStop(1, 'rgba(13,17,23,0.94)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  drawTexts(scene.texts || [], localT, ctx, W, H, model);
}

// ── Card scene: solid/branded background with centered stacked lines ────────
function drawCardScene(scene, localT, dur, ctx, W, H, model) {
  // subtle vertical brand gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0D1117'); g.addColorStop(0.55, '#131E27'); g.addColorStop(1, '#0D1117');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // optional logo
  if (scene.logo) {
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

// Stat columns (beds · baths · sqft) with a thin divider between each.
function drawStatColumns(cols, localT, ctx, W, H, model) {
  const n = cols.length; if (!n) return;
  const cy = H * 0.5;
  const colW = Math.min(W * 0.9 / n, W * 0.34);
  const totalW = colW * n;
  const startX = (W - totalW) / 2;
  ctx.textAlign = 'center';
  cols.forEach((c, i) => {
    const cx = startX + colW * (i + 0.5);
    const reveal = easeOut(clamp01((localT - 0.3 - i * 0.18) / 0.7));
    if (reveal <= 0) return;
    ctx.globalAlpha = reveal;
    // value
    setFont(ctx, model, Math.round(H * 0.085), 200);
    ctx.fillStyle = '#F5F5F3';
    ctx.fillText(String(c.value || '—'), cx, cy);
    // label
    setFont(ctx, model, Math.round(H * 0.016), 400, 4);
    ctx.fillStyle = 'rgba(162,182,192,0.6)';
    ctx.fillText(String(c.label || '').toUpperCase(), cx, cy + H * 0.07);
    ctx.globalAlpha = 1;
    if (i > 0) { // divider
      ctx.fillStyle = 'rgba(162,182,192,0.2)';
      ctx.fillRect(startX + colW * i - 1, cy - H * 0.04, 2, H * 0.08);
    }
  });
  ctx.textAlign = 'left';
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

function setFont(ctx, model, px, weight = 400, letterSpacing = 0) {
  const fam = model.brand.font || 'Inter, system-ui, -apple-system, sans-serif';
  ctx.font = `${weight} ${px}px ${fam}`;
  // letterSpacing is supported on Canvas2D in modern browsers; guard it.
  try { ctx.letterSpacing = letterSpacing ? `${letterSpacing}px` : '0px'; } catch { /* older engines */ }
}

function drawTextWrapped(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = '', lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  // anchor the block so its last line sits at y (bottom-aligned captions)
  const startY = y - (lines.length - 1) * lineHeight;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
}
