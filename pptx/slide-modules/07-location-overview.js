// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 07 — LOCATION OVERVIEW
// Map on left, submarket stats + narrative on right.
// ─────────────────────────────────────────────────────────────────────────────

function addLocationOverviewSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var market   = data.market   || {};
  var location = data.location || {};

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Location Overview', config, L);
  U.addFooter(slide, config, L, '07');

  // ── 2. Left column — full-height map ──────────────────────────────────────
  var MAP_X = L.M;
  var MAP_Y = L.CONTENT_Y;
  var MAP_W = L.snap(5.57);
  var MAP_H = L.CONTENT_H;

  U.addMapPlaceholder(slide, market.mapUrl || null, MAP_X, MAP_Y, MAP_W, MAP_H, config);

  // Walk Score / Transit Score badge strip (bottom of map, overlaid)
  var hasWalk    = location.walkScore    !== undefined && location.walkScore    !== null;
  var hasTransit = location.transitScore !== undefined && location.transitScore !== null;

  if (hasWalk || hasTransit) {
    var BADGE_H = L.snap(0.38);
    var BADGE_Y = L.snap(MAP_Y + MAP_H - BADGE_H);
    var badgeW  = hasWalk && hasTransit ? L.snap(MAP_W / 2) : MAP_W;

    // Semi-transparent navy overlay behind badges
    slide.addShape('rect', {
      x: MAP_X, y: BADGE_Y, w: MAP_W, h: BADGE_H,
      fill: { color: config.primaryColor, transparency: 20 },
      line: { type: 'none' },
    });

    if (hasWalk) {
      slide.addText('Walk Score: ' + location.walkScore, {
        x: MAP_X, y: BADGE_Y, w: badgeW, h: BADGE_H,
        fontFace: 'Calibri', fontSize: 9, bold: true,
        color: config.white, align: 'center', valign: 'middle',
      });
    }
    if (hasTransit) {
      slide.addText('Transit Score: ' + location.transitScore, {
        x: L.snap(MAP_X + badgeW), y: BADGE_Y, w: badgeW, h: BADGE_H,
        fontFace: 'Calibri', fontSize: 9, bold: true,
        color: config.accentColor, align: 'center', valign: 'middle',
      });
    }
  }

  // ── 3. Right column ───────────────────────────────────────────────────────
  var RC_X = L.snap(6.32);
  var RC_W = L.snap(6.51);
  var curY = L.CONTENT_Y;

  // a. Submarket name
  slide.addText((market.submarket || 'Submarket').toUpperCase(), {
    x: RC_X, y: curY, w: RC_W, h: L.snap(0.38),
    fontFace: 'Calibri', fontSize: 18, bold: true,
    color: config.accentColor,
    valign: 'middle', charSpacing: 0.5,
  });
  curY = L.snap(curY + 0.42);

  // b. City / State line
  var cityState = [market.city, market.state].filter(Boolean).join(', ');
  slide.addText(cityState, {
    x: RC_X, y: curY, w: RC_W, h: L.snap(0.28),
    fontFace: 'Calibri', fontSize: 13, bold: false,
    color: config.mutedText, valign: 'middle',
  });
  curY = L.snap(curY + 0.32);

  // c. Gold rule
  U.addGoldRule(slide, RC_X, curY, RC_W, config);
  curY = L.snap(curY + 0.14);

  // d. 2×3 demographic stat grid
  // Each cell: w = (6.51 - 0.25) / 2 = 3.13", h = 0.82", row gap = 0.10"
  var STAT_W     = L.snap((RC_W - L.GAP) / 2);   // 3.13"
  var STAT_H     = L.snap(0.82);
  var STAT_ROW_G = L.snap(0.10);

  var STATS_START_Y = L.snap(curY + 0.14);  // slight gap after rule

  // Stat data: [value, label]
  var statGrid = [
    // Row 1
    [
      U.fmtNum(market.population),
      'Population',
    ],
    [
      market.medianIncome || '—',
      'Median HH Income',
    ],
    // Row 2
    [
      U.fmtRent(parseFloat(String(market.avgRent || '').replace(/[^0-9.]/g, '')) || market.avgRent),
      'Avg Market Rent',
    ],
    [
      U.fmtPct(parseFloat(String(market.unemployment || '').replace('%', '')) || null),
      'Unemployment Rate',
    ],
    // Row 3
    [
      market.renterOcc ? (market.renterOcc + (String(market.renterOcc).indexOf('%') === -1 ? '%' : '')) : '—',
      'Renter-Occupied',
    ],
    [
      market.medianAge ? String(market.medianAge) : '—',
      'Median Age',
    ],
  ];

  var statOpts = {
    bg:       config.statBg,
    numColor: config.primaryColor,
    numSize:  18,
    border:   config.divider,
  };

  for (var si = 0; si < 6; si++) {
    var row = Math.floor(si / 2);
    var col = si % 2;
    var sx  = L.snap(RC_X + col * (STAT_W + L.GAP));
    var sy  = L.snap(STATS_START_Y + row * (STAT_H + STAT_ROW_G));

    U.addStatBox(slide, sx, sy, STAT_W, STAT_H,
      statGrid[si][0], statGrid[si][1],
      config, L, statOpts);
  }

  // e. Location narrative
  var NARRATIVE_Y = L.snap(STATS_START_Y + 3 * (STAT_H + STAT_ROW_G) + L.GSEC);
  var NARRATIVE_H = L.snap(L.CONTENT_BOT - NARRATIVE_Y);

  if (NARRATIVE_H > 0.20 && location.description) {
    // Cap at ~380 chars so 11pt text never overflows the calculated box height.
    var narText = location.description;
    if (narText.length > 380) { narText = narText.slice(0, 377) + '…'; }
    slide.addText(narText, {
      x: RC_X, y: NARRATIVE_Y, w: RC_W, h: NARRATIVE_H,
      fontFace: 'Calibri', fontSize: 11, bold: false,
      color: config.bodyText,
      valign: 'top',
      lineSpacingMultiple: 1.45,
      wrap: true,
    });
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addLocationOverviewSlide;
}
