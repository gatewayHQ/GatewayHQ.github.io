// app/social/renderer.js
// Thin entry: size the canvas, pick theme + template, paint. Used by the live
// preview, the sample renders, and export (which renders at higher resolution).

import { TEMPLATES, TEMPLATE_ORDER } from './templates.js';
import { THEMES, THEME_ORDER, SIZES } from './design-tokens.js';

export { TEMPLATES, TEMPLATE_ORDER, THEMES, THEME_ORDER, SIZES };

export function renderTemplate(canvas, { templateId, sizeId, theme, data, assets }) {
  const size = SIZES[sizeId] || SIZES['ig-portrait'];
  canvas.width = size.w; canvas.height = size.h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const th = THEMES[theme] || THEMES['luxe-dark'];
  const tpl = TEMPLATES[templateId] || TEMPLATES[TEMPLATE_ORDER[0]];
  tpl.render(ctx, size.w, size.h, data || {}, th, assets || {});
  return canvas;
}
