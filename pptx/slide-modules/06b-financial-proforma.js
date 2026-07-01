// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 06b — FINANCIAL SUMMARY (PRO FORMA)
// Mirror of 06-financial-summary.js but with Pro Forma figures as the primary
// axis. Titled "Financial Summary — Pro Forma" and pulls exclusively from the
// pro-forma income / expense schedule and NOI supplied in the builder.
// ─────────────────────────────────────────────────────────────────────────────

function addFinancialProformaSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();
  slide.background = { color: config.lightBg };

  var fin = data.financials || {};
  var pf  = fin.proforma   || {};

  // ── 1. Title + footer ─────────────────────────────────────────────────────
  U.addSlideTitle(slide, 'Financial Summary — Pro Forma', config, L);
  U.addFooter(slide, config, L, '06b');

  // ── 2. Four KPI boxes (Pro-Forma centric) ────────────────────────────────
  var KPI_H = L.snap(1.05);
  var kpiY  = L.CONTENT_Y;

  function capRateDisplay(cr) {
    if (cr === null || cr === undefined) return '—';
    var pct = cr > 1 ? cr : cr * 100;
    return pct.toFixed(2) + '%';
  }

  var pricePerSF = Number(fin.pricePerSF) || 0;
  var pricePerSFDisplay = pricePerSF ? ('$' + pricePerSF.toFixed(0) + '/SF') : '—';

  // Highlight the pro-forma boxes with a warm gold tint so they read as
  // forward-looking projections vs. the "current" KPIs on slide 06.
  var kpiOpts = {
    bg:       config.accentLight || config.statBg,
    numColor: config.primaryColor,
    numSize:  20,
    border:   config.accentColor,
  };

  U.addStatBox(slide,
    L.COLS4[0].x, kpiY, L.COLS4[0].w, KPI_H,
    U.fmtCurrency(pf.noi), 'Pro Forma NOI',
    config, L, kpiOpts);

  U.addStatBox(slide,
    L.COLS4[1].x, kpiY, L.COLS4[1].w, KPI_H,
    capRateDisplay(pf.capRate || fin.capRate), 'Pro Forma Cap Rate',
    config, L, kpiOpts);

  var pfGRM = pf.grm || (fin.grossRevenue && pf.grossRevenue ? (fin.askingPrice / (pf.grossRevenue || 1)) : fin.grm);
  U.addStatBox(slide,
    L.COLS4[2].x, kpiY, L.COLS4[2].w, KPI_H,
    U.fmtX(pfGRM, 1), 'Gross Rent Multiplier',
    config, L, kpiOpts);

  U.addStatBox(slide,
    L.COLS4[3].x, kpiY, L.COLS4[3].w, KPI_H,
    pricePerSFDisplay, 'Price Per SF',
    config, L, kpiOpts);

  // ── 3. Table zone geometry ────────────────────────────────────────────────
  var TABLE_Y = L.snap(kpiY + KPI_H + L.GSEC);
  var TABLE_W = L.snap(6.04);
  var LEFT_X  = L.M;
  var RIGHT_X = L.snap(6.79);

  // Item | Pro Forma (single-column value, wider than 06's two-column layout)
  var COL_WIDTHS = [3.8, 2.24];

  var HDR_H = L.snap(0.38);
  var ROW_H = L.snap(0.36);
  var TOT_H = L.snap(0.40);

  // ── 4. Build pro-forma income + expense items ────────────────────────────
  var rawGRI     = Number(fin.grossRevenue) || 0;
  var pfGrossRev = Number(pf.grossRevenue)  || rawGRI;
  var pfExp      = Number(pf.totalExpenses) || Number(fin.totalExpenses) || 0;
  var pfNOI      = Number(pf.noi)           || (pfGrossRev - pfExp);

  var occNum    = parseFloat(String(fin.occupancy || '').replace('%', '')) || 95;
  var vacPct    = occNum > 1 ? (100 - occNum) / 100 : (1 - occNum);
  // Pro-forma models a 10 % tighter vacancy assumption than current ops.
  var pfVacLoss = -Math.round(pfGrossRev * (vacPct * 0.9));
  var pfEgi     = pfGrossRev + pfVacLoss;

  // Prefer explicit pro-forma line items if the builder provided them;
  // otherwise derive from the current schedule.
  function proformaOf(items, fallbackTotal) {
    if (!items || !items.length) return [];
    return items.filter(function (it) { return it && it.label !== 'Total Expenses' && it.label !== 'Effective Gross Income'; })
      .map(function (it) {
        var pfVal = Number(it.proforma);
        if (!isNaN(pfVal) && pfVal !== 0) return { label: it.label, value: pfVal };
        var cur = Number(it.current) || 0;
        return { label: it.label, value: cur };
      });
  }

  var incomeItems  = proformaOf(fin.incomeItems);
  if (!incomeItems.length) {
    incomeItems = [
      { label: 'Gross Rental Income',     value: pfGrossRev },
      { label: 'Vacancy Loss',            value: pfVacLoss },
      { label: 'Effective Gross Income',  value: pfEgi     },
    ];
  }

  var expenseItems = proformaOf(fin.expenseItems);
  if (!expenseItems.length) {
    expenseItems = [
      { label: 'Property Tax',           value: Math.round(pfExp * 0.35) },
      { label: 'Insurance',              value: Math.round(pfExp * 0.08) },
      { label: 'Repairs & Maintenance',  value: Math.round(pfExp * 0.20) },
      { label: 'Utilities',              value: Math.round(pfExp * 0.15) },
      { label: 'Management Fee',         value: Math.round(pfExp * 0.22) },
    ];
  }

  // Drop rows that would render as "—" in both cells.
  incomeItems  = incomeItems.filter(function (r) { return (Number(r.value) || 0) !== 0; });
  expenseItems = expenseItems.filter(function (r) { return (Number(r.value) || 0) !== 0; });

  // ── 5. Table builder (single value column) ───────────────────────────────
  function buildTable(headerLabel, items, totalLabel, totalValue) {
    var rows = [];
    var hdrBase = {
      fill:      { color: config.primaryColor },
      color:     config.accentColor,
      fontFace:  'Calibri',
      fontSize:  10,
      bold:      true,
      valign:    'middle',
    };
    rows.push([
      { text: headerLabel,   options: Object.assign({}, hdrBase, { align: 'left'  }) },
      { text: 'PRO FORMA',   options: Object.assign({}, hdrBase, { align: 'right' }) },
    ]);

    for (var i = 0; i < items.length; i++) {
      var item  = items[i];
      var isAlt = i % 2 === 1;
      var rowBg = isAlt ? config.tableAlt : config.lightBg;
      var val   = Number(item.value) || 0;
      var isNeg = val < 0;

      var cellBase = {
        fill:    { color: rowBg },
        color:   config.bodyText,
        fontFace: 'Calibri',
        fontSize: 10,
        valign:  'middle',
      };

      rows.push([
        { text: item.label || '', options: Object.assign({}, cellBase, { align: 'left' }) },
        {
          text: val !== 0 ? (isNeg ? '(' + U.fmtCurrencyFull(-val) + ')' : U.fmtCurrencyFull(val)) : '—',
          options: Object.assign({}, cellBase, { align: 'right', color: isNeg ? 'A0190F' : config.bodyText }),
        },
      ]);
    }

    var totBase = {
      fill:    { color: config.accentColor },
      color:   config.primaryColor,
      fontFace: 'Calibri',
      fontSize: 10,
      bold:    true,
      valign:  'middle',
    };
    rows.push([
      { text: totalLabel,                    options: Object.assign({}, totBase, { align: 'left'  }) },
      { text: U.fmtCurrencyFull(totalValue), options: Object.assign({}, totBase, { align: 'right' }) },
    ]);

    return rows;
  }

  var totalIncome  = incomeItems.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0);
  var totalExpense = expenseItems.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0);
  if (!totalIncome)  totalIncome  = pfEgi;
  if (!totalExpense) totalExpense = pfExp;

  var numDataRows = Math.max(incomeItems.length, expenseItems.length);
  while (incomeItems.length  < numDataRows) incomeItems.push({ label: '', value: 0 });
  while (expenseItems.length < numDataRows) expenseItems.push({ label: '', value: 0 });

  var incomeRows  = buildTable('PRO FORMA INCOME',  incomeItems,  'TOTAL INCOME',   totalIncome);
  var expenseRows = buildTable('PRO FORMA EXPENSES', expenseItems, 'TOTAL EXPENSES', totalExpense);

  var tableRowHeights = [HDR_H];
  for (var ri = 0; ri < numDataRows; ri++) tableRowHeights.push(ROW_H);
  tableRowHeights.push(TOT_H);

  var tableH = HDR_H + numDataRows * ROW_H + TOT_H;

  // ── 6. Render both tables ─────────────────────────────────────────────────
  slide.addTable(incomeRows, {
    x: LEFT_X, y: TABLE_Y, w: TABLE_W,
    colW: COL_WIDTHS,
    rowH: tableRowHeights,
    border: { type: 'solid', color: config.divider, pt: 0.5 },
    autoPage: false,
  });

  slide.addTable(expenseRows, {
    x: RIGHT_X, y: TABLE_Y, w: TABLE_W,
    colW: COL_WIDTHS,
    rowH: tableRowHeights,
    border: { type: 'solid', color: config.divider, pt: 0.5 },
    autoPage: false,
  });

  // ── 7. Pro-Forma NOI summary bar ─────────────────────────────────────────
  var NOI_BAR_Y = L.snap(TABLE_Y + tableH + L.CLRN);
  var NOI_BAR_H = L.snap(0.70);
  if (NOI_BAR_Y + NOI_BAR_H > L.CONTENT_BOT) {
    NOI_BAR_Y = L.snap(L.CONTENT_BOT - NOI_BAR_H);
  }

  slide.addShape('rect', {
    x: L.M, y: NOI_BAR_Y, w: L.CW, h: NOI_BAR_H,
    fill: { color: config.primaryColor },
    line: { type: 'none' },
  });

  slide.addText('PRO FORMA NET OPERATING INCOME', {
    x: L.snap(L.M + 0.22), y: NOI_BAR_Y,
    w: L.snap(L.CW * 0.60), h: NOI_BAR_H,
    fontFace: 'Calibri', fontSize: 16, bold: true,
    color: config.accentColor,
    valign: 'middle',
  });

  slide.addText(U.fmtCurrencyFull(pfNOI || (totalIncome - totalExpense)), {
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
  module.exports = addFinancialProformaSlide;
}
