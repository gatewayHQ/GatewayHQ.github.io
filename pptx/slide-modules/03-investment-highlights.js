// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 03 — INVESTMENT HIGHLIGHTS
// Dark navy slide with 2×2 card grid, each card highlighting a key advantage.
// ─────────────────────────────────────────────────────────────────────────────

function addInvestmentHighlightsSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.primaryColor };

  var highlights = (data.property && data.property.highlights) || [];

  // ── 1. Manual dark title (gold rule, white text) ──────────────────────────
  // Gold left accent bar
  slide.addShape('rect', {
    x: L.M, y: L.TITLE_Y, w: L.ACCENT_BAR_W, h: L.TITLE_H,
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });
  // Title text in white
  slide.addText('INVESTMENT HIGHLIGHTS', {
    x: L.snap(L.M + L.ACCENT_BAR_W + 0.14),
    y: L.TITLE_Y,
    w: L.snap(L.CW - L.ACCENT_BAR_W - 0.14),
    h: L.TITLE_H,
    fontFace: L.TYPE.slideTitle.fontFace,
    fontSize: L.TYPE.slideTitle.fontSize,
    bold: L.TYPE.slideTitle.bold,
    color: config.white,
    valign: 'middle',
    charSpacing: 1.5,
  });
  // Rule below title — use accentColor instead of divider on dark bg
  slide.addShape('rect', {
    x: L.M, y: L.RULE_Y, w: L.CW, h: L.RULE_H,
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // ── 2. Dark footer ────────────────────────────────────────────────────────
  U.addDarkFooter(slide, config, L, '03');

  // ── 3. 2×2 card grid ─────────────────────────────────────────────────────
  // Rows occupy the full content zone
  var ROW_H = L.snap((L.CONTENT_H - L.GAP) / 2);  // ≈ 2.66"
  var ROW1_Y = L.CONTENT_Y;                          // 1.28"
  var ROW2_Y = L.snap(ROW1_Y + ROW_H + L.GAP);      // ≈ 4.19"

  var CARD_BG        = '243F63';   // slightly lighter navy
  var CARD_TEXT      = 'C8D8E8';   // light blue-white for descriptions
  var ACCENT_BAR_H   = L.snap(0.05);
  var ACCENT_BAR_X_OFF = L.snap(0.14);  // left gold bar x offset from card edge
  var ACCENT_BAR_W_V   = L.snap(0.04);  // vertical accent bar width

  // Card layout for two columns (L.COLS2)
  var colDefs = [
    { x: L.COLS2[0].x, w: L.COLS2[0].w },
    { x: L.COLS2[1].x, w: L.COLS2[1].w },
  ];

  var cards = [
    { col: 0, row: 0 },  // position 0
    { col: 1, row: 0 },  // position 1
    { col: 0, row: 1 },  // position 2
    { col: 1, row: 1 },  // position 3
  ];

  for (var i = 0; i < 4; i++) {
    var pos    = cards[i];
    var col    = colDefs[pos.col];
    var card_x = col.x;
    var card_y = pos.row === 0 ? ROW1_Y : ROW2_Y;
    var card_w = col.w;
    var card_h = ROW_H;

    // a. Card background
    slide.addShape('rect', {
      x: card_x, y: card_y, w: card_w, h: card_h,
      fill: { color: CARD_BG },
      line: { type: 'none' },
    });

    // b. Gold top accent bar
    slide.addShape('rect', {
      x: card_x, y: card_y, w: card_w, h: ACCENT_BAR_H,
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });

    var item = highlights[i];
    if (!item) continue;  // empty slot — background only

    var titleText = (item.title       || '').trim();
    var descText  = (item.description || '').trim();

    // When no " - " separator was used, the entire entry lands in titleText with
    // an empty descText. A 150-char paragraph in an 18pt bold 0.39"-tall box clips
    // catastrophically. Detect this and switch to "body-only" card layout.
    var bodyOnly  = !descText && titleText.length > 40;

    // d. Gold left accent bar (always present)
    slide.addShape('rect', {
      x: L.snap(card_x + ACCENT_BAR_X_OFF),
      y: L.snap(card_y + 0.20),
      w: ACCENT_BAR_W_V,
      h: L.snap(card_h - 0.35),
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });

    if (bodyOnly) {
      // Body-only mode: no separate title line; full paragraph fills the card.
      // Text starts below the gold top bar with comfortable padding.
      slide.addText(titleText, {
        x: L.snap(card_x + 0.28), y: L.snap(card_y + 0.26),
        w: L.snap(card_w - 0.44), h: L.snap(card_h - 0.42),
        fontFace: L.TYPE.body.fontFace,
        fontSize: L.TYPE.body.fontSize,
        color: CARD_TEXT,
        valign: 'top',
        lineSpacingMultiple: 1.55,
        wrap: true,
      });
    } else {
      // Normal mode: short bold gold title header + body description below.
      if (titleText) {
        slide.addText(titleText, {
          x: L.snap(card_x + 0.22), y: L.snap(card_y + 0.18),
          w: L.snap(card_w - 0.44), h: L.snap(0.38),
          fontFace: L.TYPE.sectionHdr.fontFace,
          fontSize: L.TYPE.sectionHdr.fontSize,
          bold: true,
          color: config.accentColor,
          valign: 'middle',
          shrinkText: true,   // safety net for slightly-long titles
        });
      }
      if (descText) {
        slide.addText(descText, {
          x: L.snap(card_x + 0.28), y: L.snap(card_y + 0.64),
          w: L.snap(card_w - 0.44), h: L.snap(card_h - 0.80),
          fontFace: L.TYPE.body.fontFace,
          fontSize: L.TYPE.body.fontSize,
          color: CARD_TEXT,
          valign: 'top',
          lineSpacingMultiple: 1.45,
          wrap: true,
        });
      }
    }
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addInvestmentHighlightsSlide;
}
