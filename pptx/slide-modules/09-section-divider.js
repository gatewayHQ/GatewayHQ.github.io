// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 09 — SECTION DIVIDER
// Full dark navy slide with faded section number, gold rule, and centered title.
// ─────────────────────────────────────────────────────────────────────────────

function addSectionDividerSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();

  // ── 1. Full navy background ───────────────────────────────────────────────
  slide.background = { color: config.primaryColor };

  // ── 2. Large faded section number ────────────────────────────────────────
  //    120pt Georgia Bold, barely-visible dark-on-dark navy
  slide.addText(data.sectionNumber || '', {
    x: 0, y: L.snap(1.5), w: L.W, h: L.snap(3.5),
    fontFace: 'Georgia', fontSize: 120, bold: true,
    color: '243F63',
    align: 'center', valign: 'middle',
    charSpacing: 8,
  });

  // ── 3. "SECTION" label (above the rule) ──────────────────────────────────
  slide.addText('SECTION', {
    x: 0, y: L.snap(3.05), w: L.W, h: L.snap(0.22),
    fontFace: 'Calibri', fontSize: 9, bold: false,
    color: config.accentColor,
    align: 'center', valign: 'middle',
    charSpacing: 3,
  });

  // ── 4. Gold horizontal accent rule ───────────────────────────────────────
  slide.addShape('rect', {
    x: L.M, y: L.snap(3.25), w: L.CW, h: L.snap(0.05),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // ── 5. Section title ─────────────────────────────────────────────────────
  slide.addText((data.sectionTitle || '').toUpperCase(), {
    x: L.M, y: L.snap(3.35), w: L.CW, h: L.snap(1.10),
    fontFace: 'Georgia', fontSize: 40, bold: true,
    color: config.white,
    align: 'center', valign: 'middle',
    charSpacing: 1.5,
    shrinkText: true,
  });

  // ── 6. Subtitle (optional) ────────────────────────────────────────────────
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: L.M, y: L.snap(4.55), w: L.CW, h: L.snap(0.45),
      fontFace: 'Calibri', fontSize: 18, bold: false,
      color: 'A0B8D0',
      align: 'center', valign: 'middle',
    });
  }

  // ── 7. Gold bottom accent bar ─────────────────────────────────────────────
  slide.addShape('rect', {
    x: 0, y: L.snap(L.H - 0.10), w: L.W, h: L.snap(0.10),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // ── 8. Brokerage name (bottom-right) ─────────────────────────────────────
  var brokerageName = config.brokerageName || 'Gateway Real Estate Advisors';
  slide.addText(brokerageName, {
    x: L.M, y: L.snap(L.H - 0.40), w: L.CW, h: L.snap(0.26),
    fontFace: 'Calibri', fontSize: 9, bold: false,
    color: config.accentColor,
    align: 'right', valign: 'middle',
  });

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addSectionDividerSlide;
}
