// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 01 — COVER
// Full-bleed hero photo with navy overlay, property headline, and KPI strip.
// ─────────────────────────────────────────────────────────────────────────────

function addCoverSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();

  var prop  = data.property      || {};
  var fin   = data.financials    || {};
  var imgs  = prop.images        || {};
  var hero  = imgs.hero          || null;

  // ── 1. Background ──────────────────────────────────────────────────────────
  if (hero) {
    // Hero image fills the entire slide
    var bgOpts = {
      x: 0, y: 0, w: L.W, h: L.H,
      sizing: { type: 'cover', w: L.W, h: L.H },
    };
    if (hero.startsWith('data:')) { bgOpts.data = hero; }
    else                          { bgOpts.path = hero; }
    slide.addImage(bgOpts);
  } else {
    // Solid navy fallback
    slide.background = { color: config.primaryColor };
  }

  // ── 2. Full-slide navy overlay (65 % opaque = transparency: 35) ───────────
  slide.addShape('rect', {
    x: 0, y: 0, w: L.W, h: L.H,
    fill: { color: config.primaryColor, transparency: 35 },
    line: { type: 'none' },
  });

  // ── 3. Solid navy strip — bottom (no transparency).  Raised so the 2×2 KPI
  //     grid (Asking / Units / Cap Rate / Price Per Unit) sits fully above
  //     the footer branding strip.
  var STRIP_Y = L.snap(5.15);
  var STRIP_H = L.snap(2.35);
  slide.addShape('rect', {
    x: 0, y: STRIP_Y, w: L.W, h: STRIP_H,
    fill: { color: config.primaryColor },
    line: { type: 'none' },
  });

  // ── 4. Logo (light version) ───────────────────────────────────────────────
  if (config.logoLightUrl) {
    var logoUrl = config.logoLightUrl;
    var logoOpts = {
      x: L.snap(0.60), y: L.snap(0.35), w: L.snap(2.20), h: L.snap(0.50),
      sizing: { type: 'contain', w: L.snap(2.20), h: L.snap(0.50) },
    };
    if (logoUrl.startsWith('data:')) { logoOpts.data = logoUrl; }
    else                             { logoOpts.path = logoUrl; }
    slide.addImage(logoOpts);
  }

  // ── 5. "CONFIDENTIAL OFFERING MEMORANDUM" eyebrow ────────────────────────
  slide.addText('CONFIDENTIAL OFFERING MEMORANDUM', {
    x: L.snap(0.60), y: L.snap(0.95), w: L.snap(5.00), h: L.snap(0.22),
    fontFace: 'Calibri', fontSize: 9, bold: false,
    color: config.accentColor, charSpacing: 2,
    valign: 'middle',
  });

  // ── 6. Gold horizontal rule above property name ───────────────────────────
  U.addGoldRule(slide, L.snap(0.60), L.snap(5.20), L.snap(4.00), config);

  // ── 7. Property name ──────────────────────────────────────────────────────
  // Width ends 0.25" before KPI_ORIGIN_X (9.00") so long names never clip.
  // Font scales down for names over 22 chars to keep the full name visible.
  var propName = prop.name || 'PROPERTY NAME';
  var titleFontSize = propName.length > 28 ? 26 : propName.length > 22 ? 30 : 36;
  slide.addText(propName, {
    x: L.snap(0.60), y: L.snap(5.30), w: L.snap(8.10), h: L.snap(1.05),
    fontFace: L.TYPE.hero.fontFace,
    fontSize: titleFontSize,
    bold: L.TYPE.hero.bold,
    color: config.white,
    valign: 'middle',
    shrinkText: true,
  });

  // ── 8. Address ────────────────────────────────────────────────────────────
  slide.addText(prop.address || '', {
    x: L.snap(0.60), y: L.snap(6.45), w: L.snap(8.10), h: L.snap(0.30),
    fontFace: 'Calibri', fontSize: 13,
    color: 'C0CCDA',
    valign: 'middle',
  });

  // ── 9. KPI boxes — 2×2 grid at bottom-right ──────────────────────────────
  // Both rows fit above the footer branding strip (BSTRIP_Y = 7.20).
  var KPI_ORIGIN_X = L.snap(9.00);
  var KPI_BOX_W    = L.snap(1.77);
  var KPI_BOX_H    = L.snap(0.78);
  var KPI_GAP      = L.snap(0.25);
  var KPI_ROW1_Y   = L.snap(5.25);
  var KPI_ROW2_Y   = L.snap(6.18);

  // Shared box options for cover KPIs
  var kpiOpts = {
    bg: '152D48',
    numColor: config.white,
    numSize: 18,
    border: '243F63',
  };
  // Override mutedText inside helper by using a local opts object that also
  // carries the label color — addStatBox uses config.mutedText for the label,
  // so we pass a shallow config clone with an adjusted mutedText.
  var kpiConfig = Object.assign({}, config, { mutedText: 'A0B4C8' });

  // Cap rate: normalise to percentage display
  var capRateDisplay = fin.capRate
    ? (fin.capRate > 1 ? fin.capRate.toFixed(2) : (fin.capRate * 100).toFixed(2)) + '%'
    : '—';

  // Row 1 — Asking Price | Total Units
  U.addStatBox(slide,
    KPI_ORIGIN_X, KPI_ROW1_Y,
    KPI_BOX_W, KPI_BOX_H,
    U.fmtCurrency(fin.askingPrice), 'Asking Price',
    kpiConfig, L, kpiOpts);

  U.addStatBox(slide,
    L.snap(KPI_ORIGIN_X + KPI_BOX_W + KPI_GAP), KPI_ROW1_Y,
    KPI_BOX_W, KPI_BOX_H,
    U.fmtNum(prop.units), 'Total Units',
    kpiConfig, L, kpiOpts);

  // Row 2 — Cap Rate | Price/Unit
  U.addStatBox(slide,
    KPI_ORIGIN_X, KPI_ROW2_Y,
    KPI_BOX_W, KPI_BOX_H,
    capRateDisplay, 'Cap Rate',
    kpiConfig, L, kpiOpts);

  U.addStatBox(slide,
    L.snap(KPI_ORIGIN_X + KPI_BOX_W + KPI_GAP), KPI_ROW2_Y,
    KPI_BOX_W, KPI_BOX_H,
    U.fmtCurrency(fin.pricePerUnit), 'Price / Unit',
    kpiConfig, L, kpiOpts);

  // ── 10. Bottom branding strip ─────────────────────────────────────────────
  var BSTRIP_Y = L.snap(7.20);
  var BSTRIP_H = L.snap(0.30);

  slide.addShape('rect', {
    x: 0, y: BSTRIP_Y, w: L.W, h: BSTRIP_H,
    fill: { color: '0D1E2E' },
    line: { type: 'none' },
  });
  // Gold hairline at top of bottom strip
  slide.addShape('rect', {
    x: 0, y: BSTRIP_Y, w: L.W, h: 0.02, // sub-grid — do not pass through snap()
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });
  // Centered brokerage credit
  var brokerageName = config.brokerageName || 'Gateway Real Estate Advisors';
  slide.addText(brokerageName + ' · EXCLUSIVELY OFFERED', {
    x: 0, y: BSTRIP_Y, w: L.W, h: BSTRIP_H,
    fontFace: 'Calibri', fontSize: 8,
    color: '8899AA',
    align: 'center', valign: 'middle',
  });

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addCoverSlide;
}
