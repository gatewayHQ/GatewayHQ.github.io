// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 06 — FINANCIAL SUMMARY (CURRENT OPERATIONS)
// KPI strip + current-only income/expense schedule + NOI summary bar.
// Pro Forma figures live exclusively on slide 06b (06b-financial-proforma.js).
// ─────────────────────────────────────────────────────────────────────────────

function addFinancialSummarySlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var fin = data.financials || {};
  var pf  = fin.proforma   || {};

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Financial Summary', config, L);
  U.addFooter(slide, config, L, '06');

  // ── 2. Four KPI boxes (L.COLS4) ─────────────────────────────────────────
  var KPI_H = L.snap(1.05);
  var kpiY  = L.CONTENT_Y;

  // Normalise cap rate → display %
  function capRateDisplay(cr) {
    if (cr === null || cr === undefined) return '—';
    var pct = cr > 1 ? cr : cr * 100;
    return pct.toFixed(2) + '%';
  }

  // Price/SF formatter
  var pricePerSF = Number(fin.pricePerSF) || 0;
  var pricePerSFDisplay = pricePerSF ? ('$' + pricePerSF.toFixed(0) + '/SF') : '—';

  var kpiOpts = {
    bg:       config.statBg,
    numColor: config.primaryColor,
    numSize:  20,
    border:   config.divider,
  };

  U.addStatBox(slide,
    L.COLS4[0].x, kpiY, L.COLS4[0].w, KPI_H,
    U.fmtCurrency(fin.noi), 'Net Operating Income',
    config, L, kpiOpts);

  U.addStatBox(slide,
    L.COLS4[1].x, kpiY, L.COLS4[1].w, KPI_H,
    capRateDisplay(fin.capRate), 'Cap Rate',
    config, L, kpiOpts);

  U.addStatBox(slide,
    L.COLS4[2].x, kpiY, L.COLS4[2].w, KPI_H,
    U.fmtX(fin.grm, 1), 'Gross Rent Multiplier',
    config, L, kpiOpts);

  U.addStatBox(slide,
    L.COLS4[3].x, kpiY, L.COLS4[3].w, KPI_H,
    pricePerSFDisplay, 'Price Per SF',
    config, L, kpiOpts);

  // ── 3. Table zone geometry ────────────────────────────────────────────────
  var TABLE_Y    = L.snap(kpiY + KPI_H + L.GSEC);  // 2.63"
  var TABLE_W    = L.snap(6.04);
  var LEFT_X     = L.M;                              // 0.50"
  var RIGHT_X    = L.snap(6.79);

  // Column widths for each sub-table: Item | Current.
  // Pro Forma now lives exclusively on slide 06b — showing it twice invited
  // the reader to compare mismatched numbers side-by-side on two different
  // pages.  Matches 06b's [3.8, 2.24] split for visual consistency between
  // the two financial slides.
  var COL_WIDTHS = [3.8, 2.24];

  var HDR_H  = L.snap(0.38);
  var ROW_H  = L.snap(0.36);
  var TOT_H  = L.snap(0.40);

  // ── 4. Build default income / expense items if not supplied ──────────────
  // Income
  var rawGRI     = Number(fin.grossRevenue) || 0;
  var rawExp     = Number(fin.totalExpenses) || 0;
  var rawNOI     = Number(fin.noi)          || 0;
  var pfGrossRev = Number(pf.grossRevenue)  || 0;
  var pfExp      = Number(pf.totalExpenses) || 0;

  // Derive vacancy assumption (5 % if not provided)
  var occNum = parseFloat(String(fin.occupancy || '').replace('%', '')) || 95;
  var vacPct = occNum > 1 ? (100 - occNum) / 100 : (1 - occNum);
  var vacLoss = -Math.round(rawGRI * vacPct);
  var egi     = rawGRI + vacLoss;
  var pfVacLoss = pfGrossRev ? -Math.round(pfGrossRev * (vacPct * 0.9)) : vacLoss;
  var pfEgi     = pfGrossRev ? pfGrossRev + pfVacLoss : egi;

  var incomeItems = (fin.incomeItems && fin.incomeItems.length > 0)
    ? fin.incomeItems
    : [
        { label: 'Gross Rental Income', current: rawGRI,   proforma: pfGrossRev || rawGRI },
        { label: 'Other Income',        current: 0,        proforma: 0 },
        { label: 'Vacancy Loss',        current: vacLoss,  proforma: pfVacLoss },
        { label: 'Effective Gross Income (EGI)', current: egi, proforma: pfEgi },
      ];

  // Expenses
  var expenseItems = (fin.expenseItems && fin.expenseItems.length > 0)
    ? fin.expenseItems
    : [
        { label: 'Property Tax',           current: Math.round(rawExp * 0.35), proforma: Math.round((pfExp || rawExp) * 0.35) },
        { label: 'Insurance',              current: Math.round(rawExp * 0.08), proforma: Math.round((pfExp || rawExp) * 0.08) },
        { label: 'Repairs & Maintenance',  current: Math.round(rawExp * 0.20), proforma: Math.round((pfExp || rawExp) * 0.20) },
        { label: 'Utilities',              current: Math.round(rawExp * 0.15), proforma: Math.round((pfExp || rawExp) * 0.15) },
        { label: 'Management Fee',         current: Math.round(rawExp * 0.22), proforma: Math.round((pfExp || rawExp) * 0.22) },
      ];

  // ── 5. Helper: build a single-value (current-only) pptxgenjs table ───────
  // Pro Forma figures live on slide 06b; this table shows current operations
  // only, so the two schedules don't visually double as an accidental
  // side-by-side comparison across two different slides.
  function buildTable(headerLabel, items, totLabel, totCurrent) {
    var rows = [];

    // Header row
    var hdrBase = {
      fill:      { color: config.primaryColor },
      color:     config.accentColor,
      fontFace:  'Calibri',
      fontSize:  10,
      bold:      true,
      valign:    'middle',
    };
    rows.push([
      { text: headerLabel, options: Object.assign({}, hdrBase, { align: 'left'  }) },
      { text: 'CURRENT',   options: Object.assign({}, hdrBase, { align: 'right' }) },
    ]);

    // Data rows
    for (var i = 0; i < items.length; i++) {
      var item  = items[i];
      var isAlt = i % 2 === 1;
      var rowBg = isAlt ? config.tableAlt : config.lightBg;
      var cur   = Number(item.current)  || 0;
      var isNeg = cur < 0;

      var cellBase = {
        fill:    { color: rowBg },
        color:   isNeg ? 'A0190F' : config.bodyText,
        fontFace: 'Calibri',
        fontSize: 10,
        bold:    false,
        valign:  'middle',
      };

      rows.push([
        { text: item.label || '', options: Object.assign({}, cellBase, { color: config.bodyText, align: 'left' }) },
        {
          text: cur !== 0 ? (cur < 0 ? '(' + U.fmtCurrencyFull(-cur) + ')' : U.fmtCurrencyFull(cur)) : '—',
          options: Object.assign({}, cellBase, { align: 'right', color: isNeg ? 'A0190F' : config.bodyText }),
        },
      ]);
    }

    // Totals row
    var totBase = {
      fill:    { color: config.accentColor },
      color:   config.primaryColor,
      fontFace: 'Calibri',
      fontSize: 10,
      bold:    true,
      valign:  'middle',
    };
    rows.push([
      { text: totLabel,                      options: Object.assign({}, totBase, { align: 'left'  }) },
      { text: U.fmtCurrencyFull(totCurrent), options: Object.assign({}, totBase, { align: 'right' }) },
    ]);

    return rows;
  }

  // Compute totals (current only — pro forma totals are computed on 06b)
  var totalIncomeCur = egi     || incomeItems.reduce(function (s, r) { return s + (Number(r.current) || 0); }, 0);
  var totalExpCur    = rawExp  || expenseItems.reduce(function (s, r) { return s + (Number(r.current) || 0); }, 0);

  // Strip rows with no current-side value — removes "—" phantom rows.
  function rowHasValue(r) { return (Number(r.current) || 0) !== 0; }
  var incFiltered = incomeItems.filter(rowHasValue);
  var expFiltered = expenseItems.filter(rowHasValue);

  var numDataRows    = Math.max(incFiltered.length, expFiltered.length);
  // Pad the shorter array so tables have equal height
  var incPadded = incFiltered.slice();
  var expPadded = expFiltered.slice();
  while (incPadded.length < numDataRows) { incPadded.push({ label: '', current: 0 }); }
  while (expPadded.length < numDataRows) { expPadded.push({ label: '', current: 0 }); }

  var incomeRows  = buildTable('INCOME SCHEDULE',  incPadded, 'TOTAL INCOME',   totalIncomeCur);
  var expenseRows = buildTable('EXPENSE SCHEDULE', expPadded, 'TOTAL EXPENSES',  totalExpCur);

  // Row heights: 1 header + N data rows + 1 totals row
  var tableRowHeights = [HDR_H];
  for (var ri = 0; ri < numDataRows; ri++) { tableRowHeights.push(ROW_H); }
  tableRowHeights.push(TOT_H);

  var tableH = HDR_H + numDataRows * ROW_H + TOT_H;

  // ── 6. Render income table (left) ─────────────────────────────────────────
  slide.addTable(incomeRows, {
    x: LEFT_X, y: TABLE_Y, w: TABLE_W,
    colW: COL_WIDTHS,
    rowH: tableRowHeights,
    border: { type: 'solid', color: config.divider, pt: 0.5 },
    autoPage: false,
  });

  // ── 7. Render expense table (right) ───────────────────────────────────────
  slide.addTable(expenseRows, {
    x: RIGHT_X, y: TABLE_Y, w: TABLE_W,
    colW: COL_WIDTHS,
    rowH: tableRowHeights,
    border: { type: 'solid', color: config.divider, pt: 0.5 },
    autoPage: false,
  });

  // ── 8. NOI summary bar ────────────────────────────────────────────────────
  var NOI_BAR_Y = L.snap(TABLE_Y + tableH + L.CLRN);
  var NOI_BAR_H = L.snap(0.70);

  // Clamp: if bar overflows content zone, push it up
  if (NOI_BAR_Y + NOI_BAR_H > L.CONTENT_BOT) {
    NOI_BAR_Y = L.snap(L.CONTENT_BOT - NOI_BAR_H);
  }

  // Full-width navy bar
  slide.addShape('rect', {
    x: L.M, y: NOI_BAR_Y, w: L.CW, h: NOI_BAR_H,
    fill: { color: config.primaryColor },
    line: { type: 'none' },
  });

  // Left label "NET OPERATING INCOME"
  slide.addText('NET OPERATING INCOME', {
    x: L.snap(L.M + 0.22), y: NOI_BAR_Y,
    w: L.snap(L.CW * 0.60), h: NOI_BAR_H,
    fontFace: 'Calibri', fontSize: 16, bold: true,
    color: config.accentColor,
    valign: 'middle',
  });

  // Current NOI value — the Pro Forma NOI now lives on the dedicated slide
  // 06b so slide 06 shows only the current-operations number, right-aligned.
  slide.addText(U.fmtCurrencyFull(rawNOI || (totalIncomeCur - totalExpCur)), {
    x: L.snap(L.M + L.CW * 0.60), y: NOI_BAR_Y,
    w: L.snap(L.CW * 0.40 - 0.22), h: NOI_BAR_H,
    fontFace: 'Georgia', fontSize: 22, bold: true,
    color: config.white,
    align: 'right', valign: 'middle',
    shrinkText: true,
  });

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addFinancialSummarySlide;
}
