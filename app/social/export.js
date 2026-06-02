// app/social/export.js
// Client-side export: PNG at any size (social or 300-DPI print), and a one-click
// "all social sizes" zip. Renders off-screen at full resolution — never tied to
// the on-screen preview size.

import { renderTemplate, SIZES } from './renderer.js';

function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

function renderToCanvas(opts) {
  const c = document.createElement('canvas');
  renderTemplate(c, opts);
  return c;
}
function toBlob(canvas, type, q) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

export async function exportPNG(opts, baseName) {
  const c = renderToCanvas(opts);
  const blob = await toBlob(c, 'image/png');
  downloadBlob(blob, `${baseName || 'graphic'}_${opts.sizeId}.png`);
}

export async function exportAllSocial(opts, baseName) {
  const social = Object.keys(SIZES).filter((k) => SIZES[k].kind === 'social');
  if (!window.JSZip) { // fallback: export each individually
    for (const sizeId of social) await exportPNG({ ...opts, sizeId }, baseName);
    return;
  }
  const zip = new window.JSZip();
  for (const sizeId of social) {
    const blob = await toBlob(renderToCanvas({ ...opts, sizeId }), 'image/png');
    zip.file(`${baseName || 'graphic'}_${sizeId}.png`, blob);
  }
  const out = await zip.generateAsync({ type: 'blob' });
  downloadBlob(out, `${baseName || 'graphics'}_all-sizes.zip`);
}
