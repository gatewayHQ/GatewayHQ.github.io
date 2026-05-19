// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 04 — PROPERTY DESCRIPTION / OVERVIEW
// Three-photo collage left, description + amenity list + detail chips right.
// ─────────────────────────────────────────────────────────────────────────────

function addPropertyDescriptionSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var prop     = data.property || {};
  var imgs     = prop.images   || {};
  var photos   = imgs.photos   || [];
  var amenities = prop.amenities || [];

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Property Overview', config, L);
  U.addFooter(slide, config, L, '04');

  // ── 2. Left column — photo collage ───────────────────────────────────────
  var LC_X = L.COL_PHOTO.x;       // 0.50"
  var LC_W = L.COL_PHOTO.w;       // ≈ 5.57" (46 % of CW)

  // Main photo
  var MAIN_H     = L.snap(3.30);
  var SUB_GAP    = L.snap(0.15);
  var SUB_Y      = L.snap(L.CONTENT_Y + MAIN_H + SUB_GAP);
  var SUB_H      = L.snap(L.CONTENT_H - MAIN_H - SUB_GAP);

  U.addPhoto(slide, photos[0] || null,
    LC_X, L.CONTENT_Y, LC_W, MAIN_H, 'cover');

  // Two sub-photos side-by-side
  var SUB_W1 = L.snap(2.66);
  var SUB_W2 = L.snap(LC_W - SUB_W1 - SUB_GAP);   // ≈ 2.76" (fills remaining width)
  var SUB_X2 = L.snap(LC_X + SUB_W1 + SUB_GAP);

  U.addPhoto(slide, photos[1] || null,
    LC_X, SUB_Y, SUB_W1, SUB_H, 'cover');
  U.addPhoto(slide, photos[2] || null,
    SUB_X2, SUB_Y, SUB_W2, SUB_H, 'cover');

  // ── 3. Right column ───────────────────────────────────────────────────────
  var RX = L.COL_CONTENT.x;   // 6.32"
  var RW = L.COL_CONTENT.w;   // ≈ 6.51"

  // 3a. "ABOUT THE PROPERTY" section header
  U.addSectionHeader(slide, RX, L.CONTENT_Y, RW, 'About the Property', config, L);

  // 3b. Description text
  var DESC_Y = L.snap(L.CONTENT_Y + 0.52);
  var DESC_H = L.snap(1.55);
  slide.addText(prop.description || '', {
    x: RX, y: DESC_Y, w: RW, h: DESC_H,
    fontFace: L.TYPE.body.fontFace, fontSize: L.TYPE.body.fontSize,
    color: config.bodyText,
    valign: 'top',
    lineSpacingMultiple: 1.45,
    wrap: true,
  });

  // 3c. "PROPERTY HIGHLIGHTS" section header
  var AMEN_HDR_Y = L.snap(L.CONTENT_Y + 2.20);
  U.addSectionHeader(slide, RX, AMEN_HDR_Y, RW, 'Property Highlights', config, L);

  // 3d. Amenity bullet list
  var AMEN_Y = L.snap(L.CONTENT_Y + 2.60);
  var AMEN_H = L.snap(1.80);

  // Build rich-text bullet array
  var bulletItems = amenities.map(function (item) {
    return {
      text: '• ' + item,
      options: {
        fontFace: L.TYPE.body.fontFace,
        fontSize: L.TYPE.body.fontSize,
        color: config.bodyText,
        breakLine: true,
      },
    };
  });

  if (bulletItems.length > 0) {
    slide.addText(bulletItems, {
      x: RX, y: AMEN_Y, w: RW, h: AMEN_H,
      valign: 'top',
      lineSpacingMultiple: 1.5,
    });
  }

  // ── 4. Property detail chips row ─────────────────────────────────────────
  // Up to 4 chips: Year Built, Building Size, Stories, Parking
  var chipDefs = [];
  if (prop.yearBuilt)     chipDefs.push({ label: 'Year Built',  value: String(prop.yearBuilt) });
  if (prop.buildingSize)  chipDefs.push({ label: 'Sq Ft',       value: U.fmtNum(prop.buildingSize) });
  if (prop.stories)       chipDefs.push({ label: 'Stories',     value: String(prop.stories) });
  if (prop.parking)       chipDefs.push({ label: 'Parking',     value: String(prop.parking) });
  chipDefs = chipDefs.slice(0, 4);

  if (chipDefs.length > 0) {
    var CHIP_Y    = L.snap(L.CONTENT_BOT - 0.70);
    var CHIP_H    = L.snap(0.45);
    var CHIP_W    = L.snap(1.40);
    var CHIP_GAP  = L.snap(0.10);
    var CHIP_X0   = RX;

    // Center chips within the right column
    var totalChipW = chipDefs.length * CHIP_W + (chipDefs.length - 1) * CHIP_GAP;
    var chipStartX = L.snap(RX + (RW - totalChipW) / 2);

    for (var ci = 0; ci < chipDefs.length; ci++) {
      var chip   = chipDefs[ci];
      var chip_x = L.snap(chipStartX + ci * (CHIP_W + CHIP_GAP));

      // Chip background (navy rect)
      slide.addShape('rect', {
        x: chip_x, y: CHIP_Y, w: CHIP_W, h: CHIP_H,
        fill: { color: config.primaryColor },
        line: { type: 'none' },
      });

      // Chip value (top line, bold)
      slide.addText(chip.value, {
        x: chip_x, y: CHIP_Y, w: CHIP_W, h: L.snap(CHIP_H * 0.52),
        fontFace: 'Calibri', fontSize: 11, bold: true,
        color: config.white,
        align: 'center', valign: 'bottom',
      });

      // Chip label (bottom line, lighter)
      slide.addText(chip.label.toUpperCase(), {
        x: chip_x, y: L.snap(CHIP_Y + CHIP_H * 0.52), w: CHIP_W, h: L.snap(CHIP_H * 0.48),
        fontFace: 'Calibri', fontSize: 8,
        color: 'A0B4C8',
        align: 'center', valign: 'top',
        charSpacing: 0.3,
      });
    }
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addPropertyDescriptionSlide;
}
