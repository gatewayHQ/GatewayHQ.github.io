// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 07b — PROPERTY GALLERY
// 3×2 grid of the additional photos uploaded in the Generator's Photos tab
// (photos 4 through 9 — 1-3 are used earlier on the Cover / Offering Summary
// / Property Overview slides).  Skipped entirely when the deck has ≤3 photos.
// Sits between Financial Pro Forma and Location Overview.
// ─────────────────────────────────────────────────────────────────────────────

function addPropertyGallerySlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var prop   = data.property || {};
  var imgs   = prop.images   || {};
  var photos = (imgs.photos || []).filter(Boolean);

  // Photos 1-3 already appear on Cover + Offering Summary + Property Overview.
  // Gallery shows the next batch — up to 6.
  var gallery = photos.slice(3, 9);
  if (gallery.length === 0) return null;   // caller can no-op when no extras

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  U.addSlideTitle(slide, 'Property Gallery', config, L);
  U.addFooter(slide, config, L, '07');

  // ── Grid geometry (3 cols × 2 rows) ─────────────────────────────────────
  var COLS = 3;
  var ROWS = 2;
  var GAP  = L.snap(0.20);

  var CELL_W = L.snap((L.CW - GAP * (COLS - 1)) / COLS);           // ≈ 3.98"
  var CELL_H = L.snap((L.CONTENT_H - GAP * (ROWS - 1)) / ROWS);    // ≈ 2.70"

  for (var i = 0; i < COLS * ROWS; i++) {
    var url = gallery[i];
    if (!url) continue;                    // leave the cell empty if under 6 photos
    var col = i % COLS;
    var row = Math.floor(i / COLS);
    var x   = L.snap(L.M + col * (CELL_W + GAP));
    var y   = L.snap(L.CONTENT_Y + row * (CELL_H + GAP));

    // Frame background (matte lightBg) so 'cover'-cropped photos have a
    // clean edge on the light slide.
    slide.addShape('rect', {
      x: x, y: y, w: CELL_W, h: CELL_H,
      fill: { color: config.tableAlt || 'EDF1F5' },
      line: { color: config.divider, pt: 0.5 },
    });

    // Photo — 'cover' fits the cell without distortion (crops slightly).
    U.addPhoto(slide, url, x, y, CELL_W, CELL_H, 'cover');
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addPropertyGallerySlide;
}
