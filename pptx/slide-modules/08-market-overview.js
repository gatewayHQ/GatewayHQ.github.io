// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 08 — MARKET OVERVIEW
// Comparable sales table + market driver cards + optional narrative.
// ─────────────────────────────────────────────────────────────────────────────

function addMarketOverviewSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var market = data.market     || {};
  var fin    = data.financials || {};
  var comps  = market.comps   || [];
  var drivers = market.drivers || [];

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Market Overview', config, L);
  U.addFooter(slide, config, L, '08');

  // ── 2. Comps table ────────────────────────────────────────────────────────
  // Columns: Property Name (3.0) | Units (1.0) | Yr Built (1.0) | Sale Price (2.0)
  //          Price/Unit (2.0) | Cap Rate (1.55) | vs Subject (1.78) = 12.33
  var COL_WIDTHS = [3.0, 1.0, 1.0, 2.0, 2.0, 1.55, 1.78];
  var COL_LABELS = ['PROPERTY NAME', 'UNITS', 'YR BUILT', 'SALE PRICE', 'PRICE/UNIT', 'CAP RATE', 'VS SUBJECT'];
  var COL_ALIGNS = ['left', 'center', 'center', 'right', 'right', 'center', 'center'];

  var TABLE_HDR_H = L.snap(0.42);
  var TABLE_ROW_H = L.snap(0.40);

  // Subject cap rate for delta calculation
  var subjectCap = fin.capRate
    ? (fin.capRate > 1 ? fin.capRate : fin.capRate * 100)
    : null;

  var tableBottom = L.CONTENT_Y;  // updated below if table is rendered

  if (comps.length > 0) {
    var tableRows = [];

    // Header row
    var hdrCellBase = {
      fill:      { color: config.primaryColor },
      color:     config.accentColor,
      fontFace:  'Calibri',
      fontSize:  11,
      bold:      true,
      valign:    'middle',
      charSpacing: 0.3,
    };
    tableRows.push(
      COL_LABELS.map(function (lbl, ci) {
        return { text: lbl, options: Object.assign({}, hdrCellBase, { align: COL_ALIGNS[ci] }) };
      })
    );

    // Subject property row (first, highlighted)
    var subjectBg = 'E8EDF5';
    var subBase = {
      fill:    { color: subjectBg },
      color:   config.primaryColor,
      fontFace: 'Calibri',
      fontSize: 11,
      bold:    true,
      valign:  'middle',
    };
    var prop = data.property || {};
    tableRows.push([
      { text: '★ ' + (prop.name || 'Subject Property'),                    options: Object.assign({}, subBase, { align: 'left'   }) },
      { text: prop.units     ? String(prop.units)     : '—',                options: Object.assign({}, subBase, { align: 'center' }) },
      { text: prop.yearBuilt ? String(prop.yearBuilt) : '—',                options: Object.assign({}, subBase, { align: 'center' }) },
      { text: U.fmtCurrency(fin.askingPrice),                               options: Object.assign({}, subBase, { align: 'right'  }) },
      { text: U.fmtCurrency(fin.pricePerUnit),                              options: Object.assign({}, subBase, { align: 'right'  }) },
      { text: subjectCap ? subjectCap.toFixed(2) + '%' : '—',              options: Object.assign({}, subBase, { align: 'center' }) },
      { text: 'SUBJECT',                                                     options: Object.assign({}, subBase, { align: 'center', color: config.accentColor }) },
    ]);

    // Comp rows
    for (var ci2 = 0; ci2 < comps.length; ci2++) {
      var comp  = comps[ci2];
      var isAlt = ci2 % 2 === 0;  // even ci2 = alt (subject is row 0 in data)
      var rowBg = isAlt ? config.tableAlt : config.lightBg;

      var compCap = comp.capRate
        ? (comp.capRate > 1 ? comp.capRate : comp.capRate * 100)
        : null;

      // vs Subject delta
      var vsDelta = '—';
      var vsColor = config.bodyText;
      if (compCap !== null && subjectCap !== null) {
        var delta = compCap - subjectCap;
        vsDelta = (delta >= 0 ? '+' : '') + delta.toFixed(2) + '%';
        vsColor = delta > 0 ? '2D7A4F' : config.mutedText;
      }

      var cellBase = {
        fill:    { color: rowBg },
        color:   config.bodyText,
        fontFace: 'Calibri',
        fontSize: 11,
        bold:    false,
        valign:  'middle',
      };

      tableRows.push([
        { text: comp.name      || '—',                                      options: Object.assign({}, cellBase, { align: 'left',   color: config.primaryColor }) },
        { text: comp.units     ? String(comp.units)     : '—',              options: Object.assign({}, cellBase, { align: 'center' }) },
        { text: comp.yearBuilt ? String(comp.yearBuilt) : '—',              options: Object.assign({}, cellBase, { align: 'center' }) },
        { text: U.fmtCurrency(comp.price),                                  options: Object.assign({}, cellBase, { align: 'right'  }) },
        { text: U.fmtCurrency(comp.ppu),                                    options: Object.assign({}, cellBase, { align: 'right'  }) },
        { text: compCap ? compCap.toFixed(2) + '%' : '—',                  options: Object.assign({}, cellBase, { align: 'center' }) },
        { text: vsDelta,                                                     options: Object.assign({}, cellBase, { align: 'center', color: vsColor, bold: vsDelta !== '—' }) },
      ]);
    }

    // Row heights: header + 1 subject row + N comp rows
    var rowHeights = [TABLE_HDR_H, TABLE_ROW_H];
    for (var rh = 0; rh < comps.length; rh++) { rowHeights.push(TABLE_ROW_H); }

    slide.addTable(tableRows, {
      x: L.M, y: L.CONTENT_Y, w: L.CW,
      colW: COL_WIDTHS,
      rowH: rowHeights,
      border: { type: 'solid', color: config.divider, pt: 0.5 },
      autoPage: false,
    });

    tableBottom = L.snap(L.CONTENT_Y + TABLE_HDR_H + (1 + comps.length) * TABLE_ROW_H);
  }

  // ── 3. Market driver cards ─────────────────────────────────────────────────
  var CARD_H    = L.snap(2.20);
  var CARDS_Y   = comps.length > 0
    ? L.snap(tableBottom + L.GSEC)
    : L.CONTENT_Y;

  // Clamp: if cards overflow content zone, tighten height
  var availH = L.snap(L.CONTENT_BOT - CARDS_Y);
  if (availH < CARD_H && availH > 0.80) { CARD_H = availH; }

  // Up to 3 driver cards using L.COLS3
  var CARD_BG   = '243F63';
  var CARD_TEXT = 'C8D8E8';
  var driverCount = Math.min(drivers.length, 3);

  // If fewer than 3 drivers, still use COLS3 positions for alignment
  for (var di = 0; di < driverCount; di++) {
    var driver  = drivers[di];
    var card_x  = L.COLS3[di].x;
    var card_w  = L.COLS3[di].w;

    // Card background
    slide.addShape('rect', {
      x: card_x, y: CARDS_Y, w: card_w, h: CARD_H,
      fill: { color: CARD_BG },
      line: { type: 'none' },
    });

    // Gold top accent bar
    slide.addShape('rect', {
      x: card_x, y: CARDS_Y, w: card_w, h: L.snap(0.04),
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });

    // Driver title
    slide.addText((driver.title || '').toUpperCase(), {
      x: L.snap(card_x + 0.18), y: L.snap(CARDS_Y + 0.14),
      w: L.snap(card_w - 0.36), h: L.snap(0.30),
      fontFace: 'Calibri', fontSize: 13, bold: true,
      color: config.accentColor,
      valign: 'middle', charSpacing: 0.3,
    });

    // Driver description
    var descH = L.snap(CARD_H - 0.60);
    slide.addText(driver.description || '', {
      x: L.snap(card_x + 0.18), y: L.snap(CARDS_Y + 0.50),
      w: L.snap(card_w - 0.36), h: descH,
      fontFace: 'Calibri', fontSize: 11, bold: false,
      color: CARD_TEXT,
      valign: 'top',
      lineSpacingMultiple: 1.40,
      wrap: true,
    });
  }

  // ── 4. Market stat KPI strip (between driver cards and narrative) ──────────
  // Uses available market fields; renders only when at least 2 are populated.
  var mktStatDefs = [
    { val: market.vacancyRate,   lbl: 'Vacancy Rate'    },
    { val: market.rentGrowth,    lbl: 'YOY Rent Growth' },
    { val: market.renterOcc ? (String(market.renterOcc).indexOf('%') === -1 ? market.renterOcc + '%' : market.renterOcc) : null, lbl: 'Renter-Occupied' },
    { val: market.unemployment ? (String(market.unemployment).replace(/[^0-9.%]/g, '') || null) : null, lbl: 'Unemployment'   },
  ].filter(function(s) { return s.val && s.val !== '—'; });

  var cardsBottom = CARDS_Y + CARD_H;
  var stripRendered = false;

  if (mktStatDefs.length >= 2) {
    var STRIP_H  = L.snap(0.70);
    var STRIP_Y  = L.snap(cardsBottom + L.GSEC);
    if (STRIP_Y + STRIP_H < L.CONTENT_BOT - 0.50) {
      var stripCols = L.equalCols(mktStatDefs.length);
      var stripOpts = { bg: config.statBg, numColor: config.primaryColor, numSize: 16, border: config.divider };
      mktStatDefs.forEach(function(s, idx) {
        U.addStatBox(slide,
          stripCols[idx].x, STRIP_Y,
          stripCols[idx].w, STRIP_H,
          String(s.val), s.lbl,
          config, L, stripOpts);
      });
      cardsBottom = STRIP_Y + STRIP_H;
      stripRendered = true;
    }
  }

  // ── 5. Market narrative ───────────────────────────────────────────────────
  if (market.description) {
    var narY = cardsBottom + L.GSEC;
    var narH = L.snap(L.CONTENT_BOT - narY);
    if (narH > 0.20) {
      // 11pt keeps longer narratives from overflowing
      var mktNarText = market.description;
      if (mktNarText.length > 420) { mktNarText = mktNarText.slice(0, 417) + '…'; }
      slide.addText(mktNarText, {
        x: L.M, y: L.snap(narY), w: L.CW, h: narH,
        fontFace: 'Calibri', fontSize: 11, bold: false,
        color: config.bodyText,
        valign: 'top',
        lineSpacingMultiple: 1.40,
        wrap: true,
      });
    }
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addMarketOverviewSlide;
}
