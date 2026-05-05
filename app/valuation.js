// ===================================================================
// VALUATION TOOL
// ===================================================================
var valuationInitialized = false;
var valIncomeLines = [];
var valExpenseLines = [];
var valComps = [];

function initValuation() {
  valuationInitialized = true;
  valIncomeLines = [
    { name: 'Gross Potential Rent', amount: '' },
    { name: 'Less: Vacancy', amount: '' },
    { name: 'Other Income', amount: '' }
  ];
  valExpenseLines = [
    { name: 'Property Taxes', amount: '' },
    { name: 'Insurance', amount: '' },
    { name: 'Repairs & Maintenance', amount: '' },
    { name: 'Property Management', amount: '' },
    { name: 'Utilities', amount: '' },
    { name: 'Administrative', amount: '' }
  ];
  valComps = [];
  renderValIncome();
  renderValExpenses();
  renderValComps();
  calcValuation();
}

// V4: Valuation XLSX/CSV upload handler
function handleValUpload(input, type) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    var reader = new FileReader();
    reader.onload = function(e) {
      var lines = e.target.result.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      parseValRows(lines, type);
    };
    reader.readAsText(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') { showGlobalStatus('⚠️ SheetJS library not loaded'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_csv(ws).split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
        parseValRows(rows, type);
      } catch(err) { showGlobalStatus('⚠️ Error reading XLSX: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showGlobalStatus('⚠️ Please upload a .csv or .xlsx file');
  }
  input.value = '';
}

function parseValRows(csvLines, type) {
  // Expect rows like: "Description, Amount" or "Description, $12,345"
  var items = [];
  csvLines.forEach(function(line) {
    var cols = line.split(',');
    if (cols.length < 2) return;
    var desc = cols[0].replace(/^"|"$/g, '').trim();
    var amtStr = cols.slice(1).join(',').replace(/[^0-9.\-]/g, '');
    var amount = parseFloat(amtStr);
    if (desc && !isNaN(amount) && amount > 0) {
      items.push({ desc: desc, amount: amount });
    }
  });
  if (items.length === 0) { showGlobalStatus('⚠️ No valid rows found. Format: Description, Amount'); return; }
  if (type === 'income') {
    valIncome = items;
    renderValIncome();
  } else {
    valExpenses = items;
    renderValExpenses();
  }
  calcValuation();
  showGlobalStatus('✅ Imported ' + items.length + ' ' + type + ' line items');
}

function addValIncome() {
  valIncomeLines.push({ name: '', amount: '' });
  renderValIncome();
}

function addValExpense() {
  valExpenseLines.push({ name: '', amount: '' });
  renderValExpenses();
}

function addValComp() {
  valComps.push({ address: '', price: '', cap: '', perUnit: '' });
  renderValComps();
}

function renderValIncome() {
  var c = document.getElementById('val-income-container');
  c.innerHTML = '';
  valIncomeLines.forEach((l, i) => {
    var row = document.createElement('div');
    row.className = 'expense-row';
    row.innerHTML = `
      <input type="text" value="${l.name}" placeholder="Income source" oninput="valIncomeLines[${i}].name=this.value">
      <input type="text" value="${l.amount}" placeholder="$0" oninput="valIncomeLines[${i}].amount=this.value; calcValuation()" style="text-align:right">
      <button class="remove-comp" onclick="valIncomeLines.splice(${i},1);renderValIncome();calcValuation()">&times;</button>
    `;
    c.appendChild(row);
  });
}

function renderValExpenses() {
  var c = document.getElementById('val-expense-container');
  c.innerHTML = '';
  valExpenseLines.forEach((l, i) => {
    var row = document.createElement('div');
    row.className = 'expense-row';
    row.innerHTML = `
      <input type="text" value="${l.name}" placeholder="Expense item" oninput="valExpenseLines[${i}].name=this.value">
      <input type="text" value="${l.amount}" placeholder="$0" oninput="valExpenseLines[${i}].amount=this.value; calcValuation()" style="text-align:right">
      <button class="remove-comp" onclick="valExpenseLines.splice(${i},1);renderValExpenses();calcValuation()">&times;</button>
    `;
    c.appendChild(row);
  });
}

function renderValComps() {
  var c = document.getElementById('val-comps-container');
  c.innerHTML = '';
  valComps.forEach((comp, i) => {
    var row = document.createElement('div');
    row.className = 'comp-row';
    row.innerHTML = `
      <input type="text" value="${comp.address}" placeholder="Address" oninput="valComps[${i}].address=this.value">
      <input type="text" value="${comp.price}" placeholder="$0" oninput="valComps[${i}].price=this.value">
      <input type="text" value="${comp.cap}" placeholder="0.00%" oninput="valComps[${i}].cap=this.value">
      <input type="text" value="${comp.perUnit}" placeholder="$/unit" oninput="valComps[${i}].perUnit=this.value">
      <button class="remove-comp" onclick="valComps.splice(${i},1);renderValComps()">&times;</button>
    `;
    c.appendChild(row);
  });
}

function parseAmount(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
}

function formatCurrency(num) {
  return '$' + Math.round(num).toLocaleString();
}

function calcValuation() {
  var totalIncome = valIncomeLines.reduce((sum, l) => sum + parseAmount(l.amount), 0);
  var totalExpenses = valExpenseLines.reduce((sum, l) => sum + parseAmount(l.amount), 0);
  var noi = totalIncome - totalExpenses;

  document.getElementById('val-total-income').textContent = formatCurrency(totalIncome);
  document.getElementById('val-total-expenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('val-noi').textContent = formatCurrency(noi);

  var capLow = parseFloat(document.getElementById('val-cap-low').value) / 100 || 0.06;
  var capHigh = parseFloat(document.getElementById('val-cap-high').value) / 100 || 0.075;

  if (noi > 0 && capLow > 0 && capHigh > 0) {
    var valHigh = noi / capLow;  // Lower cap = higher value
    var valLow = noi / capHigh;  // Higher cap = lower value
    document.getElementById('val-value-range').textContent = formatCurrency(valLow) + ' — ' + formatCurrency(valHigh);

    var units = parseInt(document.getElementById('val-units').value) || 0;
    var sf = parseInt(document.getElementById('val-sf').value) || 0;
    var perUnit = [];
    if (units > 0) perUnit.push(formatCurrency(valLow/units) + ' — ' + formatCurrency(valHigh/units) + ' per unit');
    if (sf > 0) perUnit.push(formatCurrency(valLow/sf) + ' — ' + formatCurrency(valHigh/sf) + ' per SF');
    document.getElementById('val-per-unit').textContent = perUnit.join('  |  ');
  } else {
    document.getElementById('val-value-range').textContent = '$0 — $0';
    document.getElementById('val-per-unit').textContent = '';
  }
}

function generateValReport() {
  var pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'GATEWAY', w: 10, h: 5.625 });
  pptx.layout = 'GATEWAY';

  var propName = document.getElementById('val-name').value || 'Property';

  // Slide 1: Cover
  var s1 = pptx.addSlide();
  s1.background = { color: '1E2F39' };
  s1.addText('Valuation Analysis', { x: 0.6, y: 1.0, w: 8.8, fontSize: 36, fontFace: 'Georgia', color: 'FFFFFF', bold: true });
  s1.addText(propName, { x: 0.6, y: 1.7, w: 8.8, fontSize: 20, fontFace: 'Arial', color: 'A2B6C0' });
  s1.addText(document.getElementById('val-address').value + ' | ' + document.getElementById('val-city').value, { x: 0.6, y: 2.2, w: 8.8, fontSize: 14, fontFace: 'Arial', color: 'E4E3D4' });
  s1.addText(document.getElementById('val-type').value + ' | ' + (document.getElementById('val-units').value || '—') + ' Units | ' + (document.getElementById('val-sf').value ? parseInt(document.getElementById('val-sf').value).toLocaleString() + ' SF' : '—'), { x: 0.6, y: 2.7, w: 8.8, fontSize: 13, fontFace: 'Arial', color: '969694' });
  if (LOGO_PRIMARY_LIGHT) s1.addImage({ data: LOGO_PRIMARY_LIGHT, x: 6.5, y: 0.3, w: 3.2, h: 0.7 });
  addLeasingFooter(s1);

  // Slide 2: Financial Summary
  var s2 = pptx.addSlide();
  s2.background = { color: 'F5F6F8' };
  s2.addText('Financial Summary', { x: 0.6, y: 0.3, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: '1E2F39' });

  // Income
  s2.addText('INCOME', { x: 0.6, y: 0.9, w: 4, fontSize: 12, fontFace: 'Arial', color: '1E2F39', bold: true });
  var yy = 1.2;
  valIncomeLines.forEach((l, i) => {
    if (!l.name) return;
    var rowBg = i % 2 === 0 ? 'E8E8E8' : 'F5F6F8';
    s2.addShape('rect', { x: 0.6, y: yy, w: 4.2, h: 0.32, fill: { color: rowBg } });
    s2.addText(l.name, { x: 0.7, y: yy + 0.02, w: 2.5, fontSize: 10, fontFace: 'Arial', color: '444444' });
    s2.addText(l.amount || '$0', { x: 3.2, y: yy + 0.02, w: 1.5, fontSize: 10, fontFace: 'Arial', color: '282828', align: 'right' });
    yy += 0.32;
  });

  // Expenses
  s2.addText('EXPENSES', { x: 5.2, y: 0.9, w: 4, fontSize: 12, fontFace: 'Arial', color: '1E2F39', bold: true });
  yy = 1.2;
  valExpenseLines.forEach((l, i) => {
    if (!l.name) return;
    var rowBg = i % 2 === 0 ? 'E8E8E8' : 'F5F6F8';
    s2.addShape('rect', { x: 5.2, y: yy, w: 4.2, h: 0.32, fill: { color: rowBg } });
    s2.addText(l.name, { x: 5.3, y: yy + 0.02, w: 2.5, fontSize: 10, fontFace: 'Arial', color: '444444' });
    s2.addText(l.amount || '$0', { x: 7.8, y: yy + 0.02, w: 1.5, fontSize: 10, fontFace: 'Arial', color: '282828', align: 'right' });
    yy += 0.32;
  });

  // NOI box
  var noi = document.getElementById('val-noi').textContent;
  s2.addShape('rect', { x: 2.5, y: 4.2, w: 5, h: 0.8, fill: { color: '1E2F39' }, rectRadius: 0.1 });
  s2.addText('NET OPERATING INCOME', { x: 2.5, y: 4.2, w: 5, fontSize: 10, fontFace: 'Arial', color: 'A2B6C0', align: 'center' });
  s2.addText(noi, { x: 2.5, y: 4.55, w: 5, fontSize: 22, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center' });
  addLeasingFooter(s2);

  // Slide 3: Valuation
  var s3 = pptx.addSlide();
  s3.background = { color: '1E2F39' };
  s3.addText('Valuation Analysis', { x: 0.6, y: 0.3, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: 'FFFFFF' });
  var valRange = document.getElementById('val-value-range').textContent;
  var perUnit = document.getElementById('val-per-unit').textContent;
  s3.addText('ESTIMATED VALUE RANGE', { x: 1, y: 1.2, w: 8, fontSize: 12, fontFace: 'Arial', color: 'A2B6C0', align: 'center' });
  s3.addText(valRange, { x: 1, y: 1.7, w: 8, fontSize: 32, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center' });
  if (perUnit) s3.addText(perUnit, { x: 1, y: 2.5, w: 8, fontSize: 13, fontFace: 'Arial', color: 'A2B6C0', align: 'center' });

  var capLow = document.getElementById('val-cap-low').value;
  var capHigh = document.getElementById('val-cap-high').value;
  s3.addText('Cap Rate Range: ' + capLow + '% — ' + capHigh + '%', { x: 1, y: 3.0, w: 8, fontSize: 13, fontFace: 'Arial', color: '969694', align: 'center' });

  // Comps table
  if (valComps.length > 0) {
    s3.addText('COMPARABLE SALES', { x: 0.6, y: 3.6, w: 8.8, fontSize: 11, fontFace: 'Arial', color: 'A2B6C0' });
    s3.addShape('rect', { x: 0.6, y: 3.9, w: 8.8, h: 0.35, fill: { color: '2a3e4a' } });
    s3.addText('Address', { x: 0.7, y: 3.95, w: 3, fontSize: 10, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    s3.addText('Sale Price', { x: 3.8, y: 3.95, w: 2, fontSize: 10, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    s3.addText('Cap Rate', { x: 5.9, y: 3.95, w: 1.5, fontSize: 10, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    s3.addText('$/Unit', { x: 7.5, y: 3.95, w: 1.8, fontSize: 10, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    valComps.forEach((comp, i) => {
      if (!comp.address) return;
      var cy = 4.3 + i * 0.32;
      s3.addText(comp.address, { x: 0.7, y: cy, w: 3, fontSize: 10, fontFace: 'Arial', color: 'E4E3D4' });
      s3.addText(comp.price, { x: 3.8, y: cy, w: 2, fontSize: 10, fontFace: 'Arial', color: 'E4E3D4' });
      s3.addText(comp.cap, { x: 5.9, y: cy, w: 1.5, fontSize: 10, fontFace: 'Arial', color: 'E4E3D4' });
      s3.addText(comp.perUnit, { x: 7.5, y: cy, w: 1.8, fontSize: 10, fontFace: 'Arial', color: 'E4E3D4' });
    });
  }
  addLeasingFooter(s3);

  try {
    var fileName = (propName.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Valuation') + '_Valuation.pptx';
    var result = pptx.writeFile({ fileName: fileName });
    if (result && typeof result.then === 'function') {
      result.then(function() {
        showGlobalStatus('✅ Valuation report downloaded!');
      }).catch(function(err) {
        // Fallback: generate as blob and trigger manual download
        pptx.write({ outputType: 'blob' }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
          showGlobalStatus('✅ Valuation report downloaded!');
        }).catch(function(e2) {
          showGlobalStatus('⚠️ Download failed: ' + e2.message);
        });
      });
    } else {
      showGlobalStatus('✅ Valuation report generated!');
    }
  } catch(err) {
    // Fallback blob download
    try {
      pptx.write({ outputType: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (propName.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Valuation') + '_Valuation.pptx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
        showGlobalStatus('✅ Valuation report downloaded!');
      }).catch(function(e2) { showGlobalStatus('⚠️ Download failed: ' + e2.message); });
    } catch(e3) { showGlobalStatus('⚠️ Error generating PPTX: ' + err.message); }
  }
}

// ===================================================================
// MULTIFAMILY OM BUILDER (from v9)
// ===================================================================
// The v9 code is loaded below - it uses global variables and functions
// including recalcMetrics (auto Cap Rate, GRM, Cash-on-Cash),
// toggleSqFt, and Past OMs save/load features
