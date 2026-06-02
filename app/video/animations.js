// app/video/animations.js
// Deterministic motion math for the canvas renderer. Every function is a pure
// function of a 0..1 progress value, so a given (scene, time) always produces
// the exact same transform — required for frame-accurate, reproducible encoding.

/** Cubic ease-out — used for text entrances and most camera moves. */
export function easeOut(p) { return 1 - Math.pow(1 - clamp01(p), 3); }
/** Smooth ease-in-out. */
export function easeInOut(p) { p = clamp01(p); return p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; }
/** Linear, clamped. */
export function linear(p) { return clamp01(p); }

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Ken Burns presets. Each returns the camera state for photo scenes:
//   scale  — extra zoom on top of cover-fit (always > 1 so edges never show)
//   panX   — horizontal pan as a fraction of canvas width  (−x .. +x)
//   panY   — vertical pan as a fraction of canvas height
// `p` is scene-local progress 0..1 (linear in time; the easing is baked into
// the slow drift so motion feels cinematic, not mechanical).
const KEN_BURNS = [
  // 0: slow push-in, centered
  (p) => ({ scale: lerp(1.06, 1.16, p), panX: 0,                       panY: 0 }),
  // 1: pan left→right, steady zoom
  (p) => ({ scale: 1.12,                panX: lerp(-0.03, 0.03, p),    panY: 0 }),
  // 2: pull-out, centered
  (p) => ({ scale: lerp(1.16, 1.06, p), panX: 0,                       panY: 0 }),
  // 3: drift up, steady zoom
  (p) => ({ scale: 1.12,                panX: 0,                       panY: lerp(0.03, -0.03, p) }),
];

/** Camera state for a photo scene given its animation id + ordering index. */
export function cameraFor(anim, index, p) {
  if (anim === 'none') return { scale: 1.0, panX: 0, panY: 0 };
  // `kenburns` cycles through the four presets by scene index so consecutive
  // photos don't all move identically. Other ids map to a specific preset.
  const map = { kenburns: index % KEN_BURNS.length, push: 0, panlr: 1, pullout: 2, drift: 3 };
  const preset = KEN_BURNS[map[anim] ?? (index % KEN_BURNS.length)];
  return preset(p);
}

/**
 * Boundary fade-through-black alpha for a scene-local time.
 * Returns 0 (fully opaque content) in the middle, ramping to 1 (black) at the
 * very start/end so adjacent scenes cross-dissolve through black. `fade` is the
 * ramp duration in seconds; `dur` the scene duration.
 */
export function boundaryBlackAlpha(localT, dur, fade = 0.35) {
  if (localT < fade)        return 1 - easeOut(localT / fade);          // fade in
  if (localT > dur - fade)  return 1 - easeOut((dur - localT) / fade);  // fade out
  return 0;
}

export function lerp(a, b, p) { return a + (b - a) * clamp01(p); }
