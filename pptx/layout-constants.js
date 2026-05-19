// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS — all coordinates and sizes as named constants.
// Never hardcode numbers inline in slide modules; always reference these.
// Slide format: 13.33" × 7.5" widescreen (16:9). All units in inches.
// ─────────────────────────────────────────────────────────────────────────────

var LAYOUT = (function () {

  // ── Slide canvas ──────────────────────────────────────────────────────────
  var W = 13.33;
  var H = 7.50;

  // ── 4pt base grid (1 pt = 1/72") ─────────────────────────────────────────
  var GRID = 4 / 72;  // ≈ 0.0556"
  function snap(v) { return Math.round(v / GRID) * GRID; }

  // ── Slide margins (0.5" all sides) ────────────────────────────────────────
  var M  = 0.50;
  var CW = snap(W - M * 2);  // content width  = 12.33"

  // ── Title zone (top of content slides) ───────────────────────────────────
  var TITLE_Y = M;            // 0.50"
  var TITLE_H = snap(0.56);   // room for 28pt Georgia + comfortable padding
  var RULE_Y  = snap(TITLE_Y + TITLE_H);          // thin rule below title
  var RULE_H  = snap(0.02);
  var ACCENT_BAR_W = snap(0.06); // left accent bar on title

  // ── Content zone (between title rule and footer) ──────────────────────────
  var CONTENT_Y    = snap(RULE_Y + RULE_H + 0.20);  // 1.28"
  var FOOTER_H     = snap(0.26);
  var FOOTER_Y     = snap(H - M * 0.50 - FOOTER_H); // 7.02"
  var SEPARATOR_Y  = snap(FOOTER_Y - 0.02);          // hairline above footer
  var CONTENT_BOT  = snap(FOOTER_Y - 0.15);          // 0.15" clearance
  var CONTENT_H    = snap(CONTENT_BOT - CONTENT_Y);  // ≈ 5.59"

  // ── Logo container (fixed across every slide, lives in footer) ────────────
  var LOGO = {
    x: snap(M),
    y: snap(FOOTER_Y + (FOOTER_H - 0.22) / 2),  // vertically centred
    w: snap(1.40),
    h: snap(0.22),
    pad: 0.05,  // inner padding
  };

  // ── Column presets ────────────────────────────────────────────────────────
  var GAP  = 0.25;   // gap between inline elements
  var GSEC = 0.30;   // gap between stacked sections
  var CLRN = 0.15;   // minimum clearance between all shapes

  function equalCols(n) {
    var colW = snap((CW - GAP * (n - 1)) / n);
    var cols = [];
    for (var i = 0; i < n; i++) {
      cols.push({ x: snap(M + i * (colW + GAP)), w: colW });
    }
    return cols;
  }

  var COLS2 = equalCols(2);   // two equal columns
  var COLS3 = equalCols(3);   // three equal columns
  var COLS4 = equalCols(4);   // four equal columns

  // 46/54 photo-content split (photo left, content right)
  var PHOTO_W   = snap(CW * 0.46);
  var CONTENT2_W = snap(CW - PHOTO_W - GAP);
  var COL_PHOTO   = { x: M,                       w: PHOTO_W   };
  var COL_CONTENT = { x: snap(M + PHOTO_W + GAP), w: CONTENT2_W };

  // ── Typography scale — ONLY these sizes are permitted ─────────────────────
  var TYPE = {
    // Element            fontFace     pt    bold
    hero:         { fontFace: 'Georgia',  fontSize: 40, bold: true  },
    slideTitle:   { fontFace: 'Georgia',  fontSize: 28, bold: true  },
    sectionHdr:   { fontFace: 'Calibri',  fontSize: 18, bold: true  },
    body:         { fontFace: 'Calibri',  fontSize: 13, bold: false },
    dataLabel:    { fontFace: 'Calibri',  fontSize: 11, bold: false },
    footer:       { fontFace: 'Calibri',  fontSize:  9, bold: false },
  };

  return {
    W, H, GRID, snap, M, CW,
    TITLE_Y, TITLE_H, RULE_Y, RULE_H, ACCENT_BAR_W,
    CONTENT_Y, CONTENT_BOT, CONTENT_H, FOOTER_Y, FOOTER_H, SEPARATOR_Y,
    LOGO,
    GAP, GSEC, CLRN,
    COLS2, COLS3, COLS4,
    COL_PHOTO, COL_CONTENT, PHOTO_W, CONTENT2_W,
    TYPE,
    equalCols,
  };
}());

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LAYOUT;
}
