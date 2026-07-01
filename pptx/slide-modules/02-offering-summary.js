// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 02 — OFFERING SUMMARY
// Photo left, 2×4 stat-box grid right, optional description teaser.
// ─────────────────────────────────────────────────────────────────────────────

function addOfferingSummarySlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var prop = data.property   || {};
  var fin  = data.financials || {};
  var imgs = prop.images     || {};

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Offering Summary', config, L);
  U.addFooter(slide, config, L, '02');

  // ── 2. Left column — property photo, sized to a natural 4:3 landscape
  //     aspect ratio and vertically centered so wide listing photos don't
  //     get stretched to fill the full content-column height.
  var heroUrl = imgs.hero || (imgs.photos && imgs.photos[0]) || null;
  var PHOTO_H  = L.snap(4.20);                                // ≈4:3 in a 5.67"-wide box
  var PHOTO_Y  = L.snap(L.CONTENT_Y + (L.CONTENT_H - PHOTO_H) / 2);
  U.addPhoto(slide, heroUrl,
    L.COL_PHOTO.x, PHOTO_Y,
    L.COL_PHOTO.w, PHOTO_H,
    'cover');

  // ── 3. Right column ───────────────────────────────────────────────────────
  var RX = L.COL_CONTENT.x;
  var RW = L.COL_CONTENT.w;

  // 3a. "KEY METRICS" section header
  U.addSectionHeader(slide, RX, L.CONTENT_Y, RW, 'Key Metrics', config, L);

  // 3b. 2×4 stat box grid
  // Each box: w = (RW - GAP) / 2, h = 1.00", row gap = 0.12"
  var BOX_W   = L.snap((RW - L.GAP) / 2);  // ≈ 3.13"
  var BOX_H   = L.snap(1.00);
  var ROW_GAP = L.snap(0.12);
  var GRID_Y0 = L.snap(L.CONTENT_Y + 0.52);

  // Left and right x-positions within the right column
  var LX = RX;
  var RX2 = L.snap(RX + BOX_W + L.GAP);

  // Shared stat box appearance
  var sbOpts = {
    bg: config.statBg,
    numColor: config.primaryColor,
    numSize: 20,
    border: config.divider,
  };

  // Normalise occupancy: accept '95%' string or 0.95 / 95 number
  var occRaw = fin.occupancy;
  var occDisplay;
  if (typeof occRaw === 'string') {
    occDisplay = occRaw.indexOf('%') !== -1 ? occRaw : occRaw + '%';
  } else {
    occDisplay = U.fmtPct(occRaw, 1);
  }

  // Row 0 — Total Units | Year Built
  U.addStatBox(slide, LX,  GRID_Y0,
    BOX_W, BOX_H, U.fmtNum(prop.units), 'Total Units', config, L, sbOpts);
  U.addStatBox(slide, RX2, GRID_Y0,
    BOX_W, BOX_H, U.fmtNum(prop.yearBuilt), 'Year Built', config, L, sbOpts);

  // Row 1 — Asking Price | Price/Unit
  var ROW1_Y = L.snap(GRID_Y0 + BOX_H + ROW_GAP);
  U.addStatBox(slide, LX,  ROW1_Y,
    BOX_W, BOX_H, U.fmtCurrency(fin.askingPrice), 'Asking Price', config, L, sbOpts);
  U.addStatBox(slide, RX2, ROW1_Y,
    BOX_W, BOX_H, U.fmtCurrency(fin.pricePerUnit), 'Price / Unit', config, L, sbOpts);

  // Row 2 — Cap Rate | NOI
  var ROW2_Y = L.snap(ROW1_Y + BOX_H + ROW_GAP);
  U.addStatBox(slide, LX,  ROW2_Y,
    BOX_W, BOX_H, U.fmtPct(fin.capRate, 2), 'Cap Rate', config, L, sbOpts);
  U.addStatBox(slide, RX2, ROW2_Y,
    BOX_W, BOX_H, U.fmtCurrency(fin.noi), 'Net Op. Income', config, L, sbOpts);

  // Row 3 — GRM | Occupancy
  var ROW3_Y = L.snap(ROW2_Y + BOX_H + ROW_GAP);
  U.addStatBox(slide, LX,  ROW3_Y,
    BOX_W, BOX_H, U.fmtX(fin.grm, 1), 'GRM', config, L, sbOpts);
  U.addStatBox(slide, RX2, ROW3_Y,
    BOX_W, BOX_H, occDisplay, 'Occupancy', config, L, sbOpts);

  // 3c. Optional description teaser (max 2 lines, bottom of right column)
  if (prop.description) {
    var TEASER_Y = L.snap(L.CONTENT_BOT - 0.60);
    // Guard: only render if we have vertical room below the stat grid
    var gridBottom = L.snap(ROW3_Y + BOX_H);
    if (TEASER_Y > gridBottom + L.CLRN) {
      slide.addText(prop.description, {
        x: RX, y: TEASER_Y, w: RW, h: L.snap(0.55),
        fontFace: L.TYPE.body.fontFace, fontSize: L.TYPE.body.fontSize,
        color: config.bodyText,
        valign: 'top',
        lineSpacingMultiple: 1.45,
        maxLines: 2,
      });
    }
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addOfferingSummarySlide;
}
