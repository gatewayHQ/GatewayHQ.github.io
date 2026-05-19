// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 05 — UNIT MIX & RENT ROLL
// Full-width table of unit types with revenue roll-up, then three income stat boxes.
// ─────────────────────────────────────────────────────────────────────────────

function addUnitMixSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var unitMix  = data.unitMix    || [];
  var fin      = data.financials || {};

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Unit Mix & Rent Roll', config, L);
  U.addFooter(slide, config, L, '05');

  // ── 2. Table geometry ────────────────────────────────────────────────────
  // 7 columns, widths summing to L.CW = 12.33"
  var COL_WIDTHS = [2.25, 1.10, 1.20, 1.75, 1.75, 2.14, 2.14];
  // Verify they sum to CW (floating point safe check)
  // [2.25+1.10+1.20+1.75+1.75+2.14+2.14 = 12.33 ✓]

  var TABLE_X  = L.M;
  var TABLE_Y  = L.CONTENT_Y;

  // Stat boxes anchor to the bottom of the content zone; table rows
  // expand to fill the space above — eliminates dead whitespace.
  var BOX_H   = L.snap(0.90);
  var STATS_Y = L.snap(L.CONTENT_BOT - BOX_H);
  var TABLE_END = L.snap(STATS_Y - L.GSEC);

  // Distribute table height evenly across header + data rows + totals row
  var numTableRows = (unitMix.length || 1) + 2;  // header + data + totals
  var dynRowH = L.snap((TABLE_END - TABLE_Y) / numTableRows);
  // Clamp: never shorter than 0.32" or taller than 0.72"
  dynRowH = Math.max(L.snap(0.32), Math.min(L.snap(0.72), dynRowH));

  var HDR_H = dynRowH;
  var ROW_H = dynRowH;

  // Column header labels (uppercase in render)
  var COL_LABELS = [
    'Unit Type',
    '# Units',
    'Avg SF',
    'Market Rent',
    'In-Place Rent',
    'Monthly Rev',
    'Annual Rev',
  ];

  // Column alignments: left, center, center, right, right, right, right
  var COL_ALIGNS = ['left', 'center', 'center', 'right', 'right', 'right', 'right'];

  // ── 3. Compute totals ─────────────────────────────────────────────────────
  var sumCount   = 0;
  var sumMonthly = 0;
  var sumAnnual  = 0;
  var sumWeightedRent = 0;  // for weighted average in-place rent

  for (var i = 0; i < unitMix.length; i++) {
    var row = unitMix[i];
    var cnt = Number(row.count)       || 0;
    var ipr = Number(row.inPlaceRent) || 0;
    var monthly = cnt * ipr;
    var annual  = monthly * 12;
    sumCount        += cnt;
    sumMonthly      += monthly;
    sumAnnual       += annual;
    sumWeightedRent += cnt * ipr;
  }

  var avgInPlaceRent = sumCount > 0 ? sumWeightedRent / sumCount : 0;

  // ── 4. Build pptxgenjs table rows array ──────────────────────────────────
  // Each cell: { text, options }
  // Header row style
  var hdrCellOpts = {
    fill:       { color: config.primaryColor },
    color:      config.accentColor,
    fontFace:   'Calibri',
    fontSize:   11,
    bold:       true,
    valign:     'middle',
    charSpacing: 0.3,
  };

  var tableRows = [];

  // --- Header row ---
  var hdrRow = COL_LABELS.map(function (label, ci) {
    return {
      text: label.toUpperCase(),
      options: Object.assign({}, hdrCellOpts, { align: COL_ALIGNS[ci] }),
    };
  });
  tableRows.push(hdrRow);

  // --- Data rows ---
  for (var ri = 0; ri < unitMix.length; ri++) {
    var entry    = unitMix[ri];
    var isAlt    = ri % 2 === 1;
    var rowBg    = isAlt ? config.tableAlt : config.lightBg;

    var cnt2     = Number(entry.count)       || 0;
    var sf       = Number(entry.sf)          || 0;
    var mktRent  = Number(entry.marketRent)  || 0;
    var iprRent  = Number(entry.inPlaceRent) || 0;
    var monthRev = cnt2 * iprRent;
    var annRev   = monthRev * 12;

    // Base cell options for data rows
    var baseCellOpts = {
      fill:    { color: rowBg },
      color:   config.bodyText,
      fontFace: 'Calibri',
      fontSize: 11,
      bold:    false,
      valign:  'middle',
    };

    var cells = [
      // Unit Type — primary color, bold
      {
        text: entry.type || '—',
        options: Object.assign({}, baseCellOpts, {
          color:  config.primaryColor,
          bold:   true,
          align:  'left',
        }),
      },
      // # Units — center
      {
        text: cnt2 ? String(cnt2) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'center' }),
      },
      // Avg SF — center, dash if zero
      {
        text: sf ? U.fmtNum(sf) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'center' }),
      },
      // Market Rent — right
      {
        text: mktRent ? ('$' + Math.round(mktRent).toLocaleString()) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'right' }),
      },
      // In-Place Rent — right
      {
        text: iprRent ? ('$' + Math.round(iprRent).toLocaleString()) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'right' }),
      },
      // Monthly Rev — right
      {
        text: monthRev ? ('$' + Math.round(monthRev).toLocaleString()) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'right' }),
      },
      // Annual Rev — right
      {
        text: annRev ? ('$' + Math.round(annRev).toLocaleString()) : '—',
        options: Object.assign({}, baseCellOpts, { align: 'right' }),
      },
    ];

    tableRows.push(cells);
  }

  // --- Totals row ---
  var totCellBase = {
    fill:    { color: config.primaryColor },
    color:   config.white,
    fontFace: 'Calibri',
    fontSize: 11,
    bold:    true,
    valign:  'middle',
  };
  var totRevenueOpts = Object.assign({}, totCellBase, { color: config.accentColor });

  var totalsRow = [
    { text: 'TOTAL',                                                    options: Object.assign({}, totCellBase, { align: 'left'   }) },
    { text: sumCount ? String(sumCount) : '—',                          options: Object.assign({}, totCellBase, { align: 'center' }) },
    { text: '—',                                                        options: Object.assign({}, totCellBase, { align: 'center' }) },
    { text: '—',                                                        options: Object.assign({}, totCellBase, { align: 'right'  }) },
    { text: '—',                                                        options: Object.assign({}, totCellBase, { align: 'right'  }) },
    { text: sumMonthly ? ('$' + Math.round(sumMonthly).toLocaleString()) : '—', options: Object.assign({}, totRevenueOpts, { align: 'right' }) },
    { text: sumAnnual  ? ('$' + Math.round(sumAnnual).toLocaleString())  : '—', options: Object.assign({}, totRevenueOpts, { align: 'right' }) },
  ];
  tableRows.push(totalsRow);

  // ── 5. Build row height array ─────────────────────────────────────────────
  // header + data rows + totals row
  var rowHeights = [HDR_H];
  for (var rh = 0; rh < unitMix.length; rh++) { rowHeights.push(ROW_H); }
  rowHeights.push(ROW_H);  // totals row matches data row height

  // ── 6. Render table ──────────────────────────────────────────────────────
  slide.addTable(tableRows, {
    x:    TABLE_X,
    y:    TABLE_Y,
    w:    L.CW,
    colW: COL_WIDTHS,
    rowH: rowHeights,
    border: { type: 'solid', color: config.divider, pt: 0.5 },
    autoPage: false,
  });

  // ── 7. Three stat boxes below the table ──────────────────────────────────
  var statOpts = {
    bg:       config.statBg,
    numColor: config.primaryColor,
    numSize:  22,
    border:   config.divider,
  };

  // Three equal-width stat boxes across the full content width
  var stat_W  = L.COLS3[0].w;   // ≈ 3.94" each
  var stat_X0 = L.COLS3[0].x;   // 0.50"
  var stat_X1 = L.COLS3[1].x;   // 4.69"
  var stat_X2 = L.COLS3[2].x;   // 8.88"

  // Stat 1: Total Monthly Income
  U.addStatBox(slide,
    stat_X0, STATS_Y, stat_W, BOX_H,
    U.fmtCurrencyFull(sumMonthly),
    'Total Monthly Income',
    config, L, statOpts);

  // Stat 2: Annual Gross Revenue
  U.addStatBox(slide,
    stat_X1, STATS_Y, stat_W, BOX_H,
    U.fmtCurrencyFull(sumAnnual),
    'Annual Gross Revenue',
    config, L, statOpts);

  // Stat 3: Average In-Place Rent (weighted)
  U.addStatBox(slide,
    stat_X2, STATS_Y, stat_W, BOX_H,
    U.fmtRent(avgInPlaceRent),
    'Avg In-Place Rent',
    config, L, statOpts);

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addUnitMixSlide;
}
