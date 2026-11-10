// app/social/renderer.js
// Thin entry: size the canvas, pick theme + template, paint. Used by the live
// preview, the sample renders, and export (which renders at higher resolution).

import { TEMPLATES, TEMPLATE_ORDER, TEMPLATE_GROUPS } from './templates.js';
import { THEMES, THEME_ORDER, SIZES } from './design-tokens.js';
import { setMinPx } from './stack.js';

export { TEMPLATES, TEMPLATE_ORDER, TEMPLATE_GROUPS, THEMES, THEME_ORDER, SIZES };

export function renderTemplate(canvas, { templateId, sizeId, theme, data, assets }) {
  const size = SIZES[sizeId] || SIZES['ig-portrait'];
  canvas.width = size.w; canvas.height = size.h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const th = THEMES[theme] || THEMES['luxe-dark'];
  const tpl = TEMPLATES[templateId] || TEMPLATES[TEMPLATE_ORDER[0]];
  // Smallest text on social sizes: 1.5% of the width (16px at 1080, 18px at 1200),
  // the size of the approved Open House footer line. Print keeps an 11px floor.
  setMinPx(size.kind === 'social' ? Math.max(11, Math.round(size.w * 0.015)) : 11);
  tpl.render(ctx, size.w, size.h, data || {}, th, assets || {});
  return canvas;
}
