// ========== RENTCAST API KEY ==========
// Replace with your actual key before deploying
const RENTCAST_API_KEY = '16453c34194147649574c9fe04860104';

// ========== HOME VALUATION GENERATOR ==========
var homeValuationInitialized = false; // guard — set in navigateTo
var hvComps = [];
var hvValuation = {};
var hvFormData = {};
var hvCompSortKey = 'price';
var hvCompSortAsc = false;

function initHomeValuation() {
  // Pre-fill today's date
  var dateEl = document.getElementById('hv-val-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
}

async function runHomeValuation() {
  var addr = (document.getElementById('hv-address').value||'').trim();
  var city = (document.getElementById('hv-city').value||'').trim();
  var state = (document.getElementById('hv-state').value||'').trim();
  var zip = (document.getElementById('hv-zip').value||'').trim();
  if (!addr || !city || !state) {
    alert('Please enter at least Address, City, and State before pulling comps.');
    return;
  }
  var beds = parseFloat(document.getElementById('hv-beds').value)||0;
  var bathsFull = parseFloat(document.getElementById('hv-baths-full').value)||0;
  var bathsHalf = parseFloat(document.getElementById('hv-baths-half').value)||0;
  var sqft = parseFloat(document.getElementById('hv-sqft').value)||0;
  var yearBuilt = parseInt(document.getElementById('hv-year').value)||0;

  hvFormData = {
    address: addr, city: city, state: state, zip: zip,
    beds: beds, bathsFull: bathsFull, bathsHalf: bathsHalf, sqft: sqft,
    lotSf: parseFloat(document.getElementById('hv-lot-sf').value)||0,
    lotAc: parseFloat(document.getElementById('hv-lot-ac').value)||0,
    yearBuilt: yearBuilt,
    garage: parseInt(document.getElementById('hv-garage').value)||0,
    basement: document.getElementById('hv-basement').value,
    stories: parseInt(document.getElementById('hv-stories').value)||1,
    condition: document.getElementById('hv-condition').value,
    kitchen: document.getElementById('hv-kitchen').value,
    kitchenYr: parseInt(document.getElementById('hv-kitchen-yr').value)||0,
    bathRemodel: document.getElementById('hv-bath-remodel').value,
    bathRemodelYr: parseInt(document.getElementById('hv-bath-yr').value)||0,
    roofAge: parseFloat(document.getElementById('hv-roof-age').value)||99,
    hvacAge: parseFloat(document.getElementById('hv-hvac-age').value)||99,
    windows: document.getElementById('hv-windows').value,
    flooring: document.getElementById('hv-flooring').value,
    upgrades: document.getElementById('hv-upgrades').value,
    agentName: document.getElementById('hv-agent-name').value,
    agentEmail: document.getElementById('hv-agent-email').value,
    agentPhone: document.getElementById('hv-agent-phone').value,
    brokerage: document.getElementById('hv-brokerage').value,
    valDate: document.getElementById('hv-val-date').value
  };

  document.getElementById('hv-loading').style.display = 'block';
  document.getElementById('hv-api-warn').style.display = 'none';
  document.getElementById('hv-results-section').style.display = 'none';
  document.getElementById('hv-manual-comps').style.display = 'none';

  var apiResult = await fetchRentcastData(addr, city, state, zip, beds, bathsFull + bathsHalf*0.5, sqft);
  document.getElementById('hv-loading').style.display = 'none';

  if (!apiResult || !apiResult.price) {
    // Fallback to manual comp entry
    document.getElementById('hv-api-warn').style.display = 'block';
    document.getElementById('hv-manual-comps').style.display = 'block';
    hvComps = [];
    hvRenderManualComps();
    return;
  }

  // Populate comps from API
  hvComps = (apiResult.comparables || []).slice(0, 5).map(function(c) {
    var ppsf = c.price && c.squareFootage ? Math.round(c.price / c.squareFootage) : 0;
    return {
      address: c.formattedAddress || c.addressLine1 || '',
      price: c.price || 0,
      beds: c.bedrooms || 0,
      baths: c.bathrooms || 0,
      sqft: c.squareFootage || 0,
      ppsf: ppsf,
      date: c.publishedDate || c.listedDate || '',
      distance: c.distance ? (Math.round(c.distance * 10)/10) + ' mi' : ''
    };
  });

  hvValuation = calculateValuation(apiResult, hvFormData);
  hvRenderResults();
}

async function fetchRentcastData(address, city, state, zip, beds, baths, sqft) {
  try {
    var fullAddr = encodeURIComponent(address + ', ' + city + ', ' + state + (zip ? ' ' + zip : ''));
    var url = 'https://api.rentcast.io/v1/avm/value?address=' + fullAddr;
    if (beds) url += '&bedrooms=' + beds;
    if (baths) url += '&bathrooms=' + baths;
    if (sqft) url += '&squareFootage=' + sqft;
    url += '&propertyType=Single%20Family&compCount=5';

    var resp = await fetch(url, {
      headers: { 'X-Api-Key': RENTCAST_API_KEY, 'Accept': 'application/json' }
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    return await resp.json();
  } catch(e) {
    console.warn('Rentcast API error:', e.message);
    return null;
  }
}

function calculateValuation(apiResult, fd) {
  var base = apiResult.price || 0;
  var low = apiResult.priceRangeLow || base * 0.93;
  var high = apiResult.priceRangeHigh || base * 1.07;
  var ppsf = (apiResult.pricePerSquareFoot) || (fd.sqft ? Math.round(base / fd.sqft) : 0);
  var compsCount = (apiResult.comparables || []).length;

  // Condition adjustment
  var condMap = { 'Excellent': 0.05, 'Very Good': 0.02, 'Good': 0, 'Fair': -0.05, 'Poor': -0.10 };
  var condAdj = condMap[fd.condition] || 0;

  // Upgrade adjustments
  var upgAdj = 0;
  var adjBreakdown = [];
  if (fd.kitchen === 'Full') { upgAdj += 0.03; adjBreakdown.push({ label: 'Kitchen Full Remodel', pct: '+3.0%' }); }
  else if (fd.kitchen === 'Partial') { upgAdj += 0.015; adjBreakdown.push({ label: 'Kitchen Partial Remodel', pct: '+1.5%' }); }
  if (fd.bathRemodel === 'Full') { upgAdj += 0.02; adjBreakdown.push({ label: 'Bathroom Full Remodel', pct: '+2.0%' }); }
  else if (fd.bathRemodel === 'Partial') { upgAdj += 0.01; adjBreakdown.push({ label: 'Bathroom Partial Remodel', pct: '+1.0%' }); }
  if (fd.roofAge <= 5) { upgAdj += 0.01; adjBreakdown.push({ label: 'Roof Under 5 Years', pct: '+1.0%' }); }
  if (fd.hvacAge <= 5) { upgAdj += 0.005; adjBreakdown.push({ label: 'HVAC Under 5 Years', pct: '+0.5%' }); }

  var totalAdj = condAdj + upgAdj;
  var adjusted = Math.round(base * (1 + totalAdj) / 1000) * 1000;
  var adjLow = Math.round(low * (1 + totalAdj) / 1000) * 1000;
  var adjMid = adjusted;
  var adjHigh = Math.round(high * (1 + totalAdj) / 1000) * 1000;
  var adjPpsf = fd.sqft ? Math.round(adjusted / fd.sqft) : ppsf;

  var confidence = compsCount >= 4 ? 'High' : compsCount >= 2 ? 'Medium' : 'Low';

  return {
    base: Math.round(base),
    low: adjLow, mid: adjMid, high: adjHigh,
    ppsf: adjPpsf, confidence: confidence,
    condAdj: condAdj, upgAdj: upgAdj,
    condAdjDollar: Math.round(base * condAdj),
    upgAdjDollar: Math.round(base * upgAdj),
    adjBreakdown: adjBreakdown,
    compsCount: compsCount
  };
}

function hvRenderResults() {
  var v = hvValuation;
  var fmt = function(n) { return '$' + Math.round(n).toLocaleString(); };
  document.getElementById('hv-res-price').textContent = fmt(v.mid);
  document.getElementById('hv-res-ppsf').textContent = '$' + v.ppsf + '/sqft';
  var confColors = { High: '#4CAF50', Medium: '#FFC107', Low: '#e74c3c' };
  var confEl = document.getElementById('hv-res-confidence');
  confEl.textContent = v.confidence;
  confEl.style.color = confColors[v.confidence] || 'var(--brand-cream)';
  document.getElementById('hv-res-low').textContent = fmt(v.low);
  document.getElementById('hv-res-mid').textContent = fmt(v.mid);
  document.getElementById('hv-res-high').textContent = fmt(v.high);
  document.getElementById('hv-res-condition').textContent = hvFormData.condition;
  document.getElementById('hv-res-base').textContent = fmt(v.base);
  var condSign = v.condAdj >= 0 ? '+' : '';
  document.getElementById('hv-res-cond-adj').textContent = condSign + (v.condAdj*100).toFixed(0) + '% (' + condSign + fmt(v.condAdjDollar) + ')';
  var upgSign = v.upgAdj >= 0 ? '+' : '';
  document.getElementById('hv-res-upg-adj').textContent = upgSign + (v.upgAdj*100).toFixed(1) + '% (' + upgSign + fmt(v.upgAdjDollar) + ')';

  // Adjustments breakdown table
  var adjHtml = '<table style="width:100%;border-collapse:collapse">';
  adjHtml += '<tr><th style="text-align:left;color:var(--brand-gray);padding:4px 8px;font-weight:500">Adjustment</th><th style="text-align:right;color:var(--brand-gray);padding:4px 8px;font-weight:500">%</th><th style="text-align:right;color:var(--brand-gray);padding:4px 8px;font-weight:500">$ Impact</th></tr>';
  // Condition row
  var condPct = (v.condAdj*100).toFixed(0);
  var condSign2 = v.condAdj >= 0 ? '+' : '';
  adjHtml += '<tr style="border-top:1px solid rgba(162,182,192,0.1)"><td style="padding:6px 8px;color:var(--brand-cream)">Condition (' + hvFormData.condition + ')</td><td style="text-align:right;padding:6px 8px;color:' + (v.condAdj>=0?'#4CAF50':'#e74c3c') + '">' + condSign2 + condPct + '%</td><td style="text-align:right;padding:6px 8px;color:var(--brand-cream)">' + condSign2 + '$' + Math.abs(v.condAdjDollar).toLocaleString() + '</td></tr>';
  // Upgrade rows
  v.adjBreakdown.forEach(function(adj) {
    var dollar = Math.round(v.base * parseFloat(adj.pct) / 100);
    adjHtml += '<tr style="border-top:1px solid rgba(162,182,192,0.08)"><td style="padding:6px 8px;color:var(--brand-cream)">' + adj.label + '</td><td style="text-align:right;padding:6px 8px;color:#4CAF50">' + adj.pct + '</td><td style="text-align:right;padding:6px 8px;color:var(--brand-cream)">+$' + Math.abs(dollar).toLocaleString() + '</td></tr>';
  });
  adjHtml += '</table>';
  document.getElementById('hv-adj-table').innerHTML = adjHtml;

  // Comp table
  hvRenderCompTable();

  document.getElementById('hv-results-section').style.display = 'block';
  document.getElementById('hv-results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hvRenderCompTable() {
  var fd = hvFormData;
  var sorted = hvComps.slice().sort(function(a,b) {
    var av = a[hvCompSortKey]||0, bv = b[hvCompSortKey]||0;
    if (hvCompSortKey === 'date') { av = av||''; bv = bv||''; }
    return hvCompSortAsc ? (av > bv ? 1 : -1) : (bv > av ? 1 : -1);
  });
  var tbody = document.getElementById('hv-comp-tbody');
  tbody.innerHTML = '';
  sorted.forEach(function(c, i) {
    var vs = [];
    if (fd.sqft && c.sqft) vs.push(c.sqft > fd.sqft ? '📐 Larger' : c.sqft < fd.sqft ? '📐 Smaller' : '📐 Same size');
    if (fd.yearBuilt && c.date) {
      var saleYear = parseInt((c.date||'').split('-')[0]);
      if (saleYear) vs.push(saleYear < fd.yearBuilt ? '🏗 Older' : saleYear > fd.yearBuilt ? '🏗 Newer' : '');
    }
    var vsText = vs.join(', ') || '—';
    var dateDisplay = c.date ? c.date.split('T')[0] : '—';
    var row = document.createElement('tr');
    row.style.background = i % 2 === 0 ? 'transparent' : 'rgba(162,182,192,0.04)';
    row.innerHTML = '<td style="padding:7px 8px;color:var(--brand-cream);font-size:12px">' + (c.address||'—') + '</td>' +
      '<td style="padding:7px 8px;text-align:right;color:#C8A84B;font-weight:600">' + (c.price ? '$' + c.price.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 8px;text-align:center;color:var(--brand-cream)">' + (c.beds||'—') + '</td>' +
      '<td style="padding:7px 8px;text-align:center;color:var(--brand-cream)">' + (c.baths||'—') + '</td>' +
      '<td style="padding:7px 8px;text-align:right;color:var(--brand-cream)">' + (c.sqft ? c.sqft.toLocaleString() : '—') + '</td>' +
      '<td style="padding:7px 8px;text-align:right;color:var(--brand-cream)">' + (c.ppsf ? '$' + c.ppsf : '—') + '</td>' +
      '<td style="padding:7px 8px;text-align:right;color:var(--brand-gray)">' + dateDisplay + '</td>' +
      '<td style="padding:7px 8px;text-align:right;color:var(--brand-gray)">' + (c.distance||'—') + '</td>' +
      '<td style="padding:7px 8px;text-align:center;color:var(--brand-gray);font-size:11px">' + vsText + '</td>';
    tbody.appendChild(row);
  });
}

function hvSortComps(key) {
  if (hvCompSortKey === key) hvCompSortAsc = !hvCompSortAsc;
  else { hvCompSortKey = key; hvCompSortAsc = false; }
  hvRenderCompTable();
}

function hvRenderManualComps() {
  var container = document.getElementById('hv-comp-rows');
  if (!container) return;
  container.innerHTML = '';
  if (hvComps.length === 0) hvComps = [{},{},{},{},{}];
  hvComps.forEach(function(c, i) {
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px;align-items:center';
    row.innerHTML = '<input placeholder="Address" value="' + (c.address||'') + '" oninput="hvComps['+i+'].address=this.value" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">' +
      '<input type="number" placeholder="Price" value="' + (c.price||'') + '" oninput="hvComps['+i+'].price=+this.value;hvComps['+i+'].ppsf=hvComps['+i+'].sqft?(Math.round(hvComps['+i+'].price/hvComps['+i+'].sqft)):0" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">' +
      '<input type="number" placeholder="Beds" value="' + (c.beds||'') + '" oninput="hvComps['+i+'].beds=+this.value" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">' +
      '<input type="number" placeholder="Baths" value="' + (c.baths||'') + '" oninput="hvComps['+i+'].baths=+this.value" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">' +
      '<input type="number" placeholder="Sq Ft" value="' + (c.sqft||'') + '" oninput="hvComps['+i+'].sqft=+this.value;hvComps['+i+'].ppsf=hvComps['+i+'].price?(Math.round(hvComps['+i+'].price/hvComps['+i+'].sqft)):0" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">' +
      '<input placeholder="Sale Date" value="' + (c.date||'') + '" oninput="hvComps['+i+'].date=this.value" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 8px;color:var(--brand-cream);font-size:12px">';
    container.appendChild(row);
  });
}

function hvAddComp() {
  if (hvComps.length < 5) { hvComps.push({}); hvRenderManualComps(); }
}

window.hvUseManualComps = function() {
  var validComps = hvComps.filter(function(c) { return c.price > 0; });
  if (validComps.length === 0) { alert('Please enter at least one comp with a price.'); return; }
  hvComps = validComps;
  var avgPrice = validComps.reduce(function(s,c){return s+c.price;},0) / validComps.length;
  var fakeResult = { price: avgPrice, comparables: validComps };
  hvValuation = calculateValuation(fakeResult, hvFormData);
  hvRenderResults();
};

function hvDownloadPDF() {
  if (!window.jspdf && !window.jsPDF) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = function() { hvBuildPDF(); };
    document.head.appendChild(s);
  } else {
    hvBuildPDF();
  }
}

function hvBuildPDF() {
  try {
    var jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFLib) { alert('PDF library not loaded. Check your internet connection.'); return; }
    var doc = new jsPDFLib({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    var fd = hvFormData;
    var v = hvValuation;
    var W = 612, H = 792;
    var navy = [30, 47, 57];
    var gold = [200, 168, 75];
    var cream = [228, 227, 212];
    var gray = [162, 182, 192];
    var fmt = function(n) { return '$' + Math.round(n).toLocaleString(); };

    // ---- PAGE 1: COVER ----
    doc.setFillColor.apply(doc, navy);
    doc.rect(0, 0, W, H, 'F');
    // Gold top bar
    doc.setFillColor.apply(doc, gold);
    doc.rect(0, 0, W, 8, 'F');
    // Title
    doc.setTextColor.apply(doc, gold);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('HOME VALUATION REPORT', W/2, 80, { align: 'center' });
    // Property address
    doc.setTextColor.apply(doc, cream);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    var addrLine = fd.address;
    doc.text(addrLine, W/2, 140, { align: 'center', maxWidth: 480 });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, gray);
    doc.text(fd.city + ', ' + fd.state + ' ' + fd.zip, W/2, 172, { align: 'center' });
    // Suggested price
    doc.setTextColor.apply(doc, gold);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(v.mid), W/2, 240, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, gray);
    doc.text('Suggested List Price', W/2, 262, { align: 'center' });
    // Divider
    doc.setDrawColor.apply(doc, gold);
    doc.setLineWidth(1);
    doc.line(80, 290, W-80, 290);
    // Agent info
    doc.setTextColor.apply(doc, cream);
    doc.setFontSize(14);
    if (fd.agentName) doc.text(fd.agentName, W/2, 330, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, gray);
    if (fd.brokerage) doc.text(fd.brokerage, W/2, 350, { align: 'center' });
    if (fd.agentPhone) doc.text(fd.agentPhone, W/2, 368, { align: 'center' });
    if (fd.agentEmail) doc.text(fd.agentEmail, W/2, 386, { align: 'center' });
    if (fd.valDate) doc.text('Date of Valuation: ' + fd.valDate, W/2, 410, { align: 'center' });
    // Brokerage footer
    doc.setTextColor.apply(doc, gold);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEWAY REAL ESTATE ADVISORS', W/2, H-60, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, gray);
    doc.text('www.gatewayreadvisors.com  |  712-226-8000', W/2, H-42, { align: 'center' });
    doc.text('Page 1', W/2, H-20, { align: 'center' });

    // ---- PAGE 2: VALUATION SUMMARY ----
    doc.addPage();
    doc.setFillColor.apply(doc, navy);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor.apply(doc, gold);
    doc.rect(0, 0, W, 6, 'F');
    doc.setTextColor.apply(doc, gold);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('VALUATION SUMMARY', 60, 50);
    doc.setDrawColor.apply(doc, gold);
    doc.line(60, 58, W-60, 58);
    var y2 = 90;
    var addRow = function(label, val, color) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, gray);
      doc.text(label, 80, y2);
      doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, color||cream);
      doc.text(val, 360, y2, { align: 'right' });
      y2 += 22;
    };
    addRow('Suggested List Price', fmt(v.mid), gold);
    addRow('Value Range Low', fmt(v.low));
    addRow('Value Range Mid', fmt(v.mid));
    addRow('Value Range High', fmt(v.high));
    addRow('Estimated Price / Sq Ft', '$' + v.ppsf + '/sqft');
    addRow('Confidence Score', v.confidence, v.confidence==='High'?[76,175,80]:v.confidence==='Medium'?[255,193,7]:[231,76,60]);
    addRow('Condition Rating', fd.condition);
    addRow('Base Rentcast Value', fmt(v.base));
    var cs = v.condAdj>=0?'+':''; addRow('Condition Adjustment', cs+(v.condAdj*100).toFixed(0)+'% ('+cs+fmt(v.condAdjDollar)+')');
    var us = v.upgAdj>=0?'+':''; addRow('Upgrade Adjustments', us+(v.upgAdj*100).toFixed(1)+'% ('+us+fmt(v.upgAdjDollar)+')');
    y2 += 10;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor.apply(doc, gray);
    doc.text('Methodology: Base value sourced from Rentcast AVM. Adjustments applied for condition and upgrades per Gateway standard.', 60, y2, { maxWidth: 490 });
    doc.setTextColor.apply(doc, gray); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Gateway Real Estate Advisors — Confidential  |  Page 2', W/2, H-20, { align: 'center' });

    // ---- PAGE 3: PROPERTY DETAILS ----
    doc.addPage();
    doc.setFillColor.apply(doc, navy); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor.apply(doc, gold); doc.rect(0, 0, W, 6, 'F');
    doc.setTextColor.apply(doc, gold); doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('PROPERTY DETAILS', 60, 50);
    doc.setDrawColor.apply(doc, gold); doc.line(60, 58, W-60, 58);
    var y3 = 85, col2 = 350;
    var det = function(label, val, col) {
      var x = col || 80;
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, gray);
      doc.text(label + ':', x, y3);
      doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc, cream);
      doc.text(String(val||'—'), x+130, y3);
      if (!col || col === col2) y3 += 20;
    };
    det('Address', fd.address); det('City', fd.city); det('State / Zip', fd.state + ' ' + fd.zip);
    det('Bedrooms', fd.beds); det('Full Baths', fd.bathsFull); det('Half Baths', fd.bathsHalf);
    det('Square Footage', fd.sqft ? fd.sqft.toLocaleString() + ' sqft' : '—');
    det('Lot Size', fd.lotSf ? fd.lotSf.toLocaleString() + ' sqft (' + fd.lotAc + ' ac)' : '—');
    det('Year Built', fd.yearBuilt||'—'); det('Garage', fd.garage + ' stall(s)');
    det('Basement', fd.basement); det('Stories', fd.stories);
    y3 += 10; doc.setDrawColor.apply(doc, gray); doc.setLineWidth(0.5); doc.line(60, y3, W-60, y3); y3 += 16;
    det('Condition', fd.condition); det('Kitchen', fd.kitchen + (fd.kitchenYr?' ('+fd.kitchenYr+')':''));
    det('Bathroom', fd.bathRemodel + (fd.bathRemodelYr?' ('+fd.bathRemodelYr+')':''));
    det('Roof Age', fd.roofAge < 99 ? fd.roofAge + ' years' : '—'); det('HVAC Age', fd.hvacAge < 99 ? fd.hvacAge + ' years' : '—');
    det('Windows', fd.windows); det('Flooring', fd.flooring);
    if (fd.upgrades) { doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, gray); doc.text('Upgrades:', 80, y3); y3+=14; doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc, cream); doc.text(fd.upgrades, 80, y3, {maxWidth: 460}); }
    doc.setTextColor.apply(doc, gray); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Gateway Real Estate Advisors — Confidential  |  Page 3', W/2, H-20, { align: 'center' });

    // ---- PAGE 4: COMP TABLE ----
    doc.addPage();
    doc.setFillColor.apply(doc, navy); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor.apply(doc, gold); doc.rect(0, 0, W, 6, 'F');
    doc.setTextColor.apply(doc, gold); doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('COMPARABLE SALES', 60, 50);
    doc.setDrawColor.apply(doc, gold); doc.line(60, 58, W-60, 58);
    var headers4 = ['Address','Sale Price','Beds','Baths','Sq Ft','$/SqFt','Date','Dist'];
    var colW = [180,72,34,34,52,50,70,52];
    var y4 = 78, x4 = 40;
    headers4.forEach(function(h, i) {
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, gray);
      doc.text(h, x4, y4);
      x4 += colW[i];
    });
    y4 += 14;
    hvComps.forEach(function(c, ri) {
      if (ri % 2 === 0) { doc.setFillColor(26,40,48); doc.rect(36, y4-10, W-72, 16, 'F'); }
      var vals = [c.address||'—', c.price?'$'+c.price.toLocaleString():'—', c.beds||'—', c.baths||'—',
        c.sqft?c.sqft.toLocaleString():'—', c.ppsf?'$'+c.ppsf:'—', c.date?c.date.split('T')[0]:'—', c.distance||'—'];
      var x4r = 40;
      vals.forEach(function(val, ci) {
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, cream);
        doc.text(String(val).substring(0,24), x4r, y4);
        x4r += colW[ci];
      });
      y4 += 16;
    });
    doc.setTextColor.apply(doc, gray); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Gateway Real Estate Advisors — Confidential  |  Page 4', W/2, H-20, { align: 'center' });

    // ---- PAGE 5: ADJUSTMENTS ----
    doc.addPage();
    doc.setFillColor.apply(doc, navy); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor.apply(doc, gold); doc.rect(0, 0, W, 6, 'F');
    doc.setTextColor.apply(doc, gold); doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('ADJUSTMENTS BREAKDOWN', 60, 50);
    doc.setDrawColor.apply(doc, gold); doc.line(60, 58, W-60, 58);
    var y5 = 90;
    var allAdj = [{ label: 'Condition (' + fd.condition + ')', pct: v.condAdj, dollar: v.condAdjDollar }];
    v.adjBreakdown.forEach(function(a) { allAdj.push({ label: a.label, pct: parseFloat(a.pct)/100, dollar: Math.round(v.base*parseFloat(a.pct)/100) }); });
    allAdj.forEach(function(a) {
      doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor.apply(doc, cream);
      doc.text(a.label, 80, y5);
      var pSign = a.pct>=0?'+':''; var dSign = a.dollar>=0?'+':'';
      var pctStr = pSign + (a.pct*100).toFixed(1) + '%';
      var dolStr = dSign + '$' + Math.abs(a.dollar).toLocaleString();
      doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc, a.pct>=0?[76,175,80]:[231,76,60]);
      doc.text(pctStr, 370, y5, { align: 'right' });
      doc.setTextColor.apply(doc, cream);
      doc.text(dolStr, 500, y5, { align: 'right' });
      // Bar
      doc.setFillColor.apply(doc, a.pct>=0?[76,175,80]:[231,76,60]);
      var barW = Math.min(Math.abs(a.pct)*1000, 200);
      doc.rect(80, y5+4, barW, 4, 'F');
      y5 += 36;
    });
    doc.setTextColor.apply(doc, gray); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Gateway Real Estate Advisors — Confidential  |  Page 5', W/2, H-20, { align: 'center' });

    // Save
    var safeName = fd.address.replace(/[^a-zA-Z0-9]/g,'-').replace(/-+/g,'-');
    doc.save('Gateway-Valuation-' + safeName + '-' + (fd.valDate||'') + '.pdf');
  } catch(e) {
    console.error('PDF error:', e);
    alert('PDF generation failed: ' + e.message);
  }
}

async function hvDownloadPPTX() {
  if (typeof PptxGenJS === 'undefined') {
    alert('PPTX library not loaded. Refresh the page and try again.');
    return;
  }
  try {
    var pptx = new PptxGenJS();
    var fd = hvFormData;
    var v = hvValuation;
    var fmt = function(n) { return '$' + Math.round(n).toLocaleString(); };
    var NAVY = '1E2F39', GOLD = 'C8A84B', CREAM = 'E4E3D4', GRAY = 'A2B6C0';
    var DARK = '152229';

    // ---- SLIDE 1: COVER ----
    var s1 = pptx.addSlide();
    s1.background = { color: NAVY };
    s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: GOLD } });
    s1.addText('HOME VALUATION REPORT', { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 14, color: GOLD, bold: true, align: 'center', fontFace: 'Calibri' });
    s1.addText(fd.address, { x: 0.5, y: 1.3, w: 9, h: 0.9, fontSize: 32, color: CREAM, bold: true, align: 'center', fontFace: 'Georgia', wrap: true });
    s1.addText(fd.city + ', ' + fd.state + ' ' + fd.zip, { x: 0.5, y: 2.3, w: 9, h: 0.4, fontSize: 16, color: GRAY, align: 'center' });
    s1.addText(fmt(v.mid), { x: 0.5, y: 3.0, w: 9, h: 0.8, fontSize: 44, color: GOLD, bold: true, align: 'center', fontFace: 'Georgia' });
    s1.addText('Suggested List Price', { x: 0.5, y: 3.8, w: 9, h: 0.4, fontSize: 13, color: GRAY, align: 'center' });
    s1.addShape(pptx.ShapeType.line, { x: 1, y: 4.4, w: 8, h: 0, line: { color: GOLD, width: 1 } });
    if (fd.agentName) s1.addText(fd.agentName, { x: 0.5, y: 4.6, w: 9, h: 0.4, fontSize: 15, color: CREAM, bold: true, align: 'center' });
    s1.addText(fd.brokerage || 'Gateway Real Estate Advisors', { x: 0.5, y: 5.05, w: 9, h: 0.35, fontSize: 12, color: GRAY, align: 'center' });
    if (fd.agentPhone) s1.addText(fd.agentPhone, { x: 0.5, y: 5.4, w: 9, h: 0.3, fontSize: 11, color: GRAY, align: 'center' });
    if (fd.valDate) s1.addText('Date of Valuation: ' + fd.valDate, { x: 0.5, y: 5.75, w: 9, h: 0.3, fontSize: 10, color: GRAY, align: 'center' });
    s1.addText('GATEWAY REAL ESTATE ADVISORS', { x: 0.5, y: 6.8, w: 9, h: 0.4, fontSize: 12, color: GOLD, bold: true, align: 'center' });

    // ---- SLIDE 2: VALUATION SUMMARY ----
    var s2 = pptx.addSlide();
    s2.background = { color: NAVY };
    s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: GOLD } });
    s2.addText('VALUATION SUMMARY', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, color: GOLD, bold: true });
    // Big price
    s2.addText(fmt(v.mid), { x: 0.3, y: 0.9, w: 9.4, h: 1.0, fontSize: 52, color: GOLD, bold: true, align: 'center', fontFace: 'Georgia' });
    s2.addText('Suggested List Price', { x: 0.3, y: 1.85, w: 9.4, h: 0.4, fontSize: 14, color: GRAY, align: 'center' });
    // Low / Mid / High boxes
    var boxes = [['Low', fmt(v.low), '1A2830'],['Mid', fmt(v.mid), '223742'],['High', fmt(v.high), '1A2830']];
    boxes.forEach(function(b, i) {
      var bx = 0.3 + i * 3.2;
      s2.addShape(pptx.ShapeType.roundRect, { x: bx, y: 2.5, w: 3.0, h: 1.0, fill: { color: b[2] }, rectRadius: 0.05 });
      s2.addText(b[0], { x: bx, y: 2.55, w: 3.0, h: 0.35, fontSize: 11, color: GRAY, align: 'center' });
      s2.addText(b[1], { x: bx, y: 2.9, w: 3.0, h: 0.45, fontSize: 18, color: CREAM, bold: true, align: 'center' });
    });
    // Stats
    var stats = [['Confidence', v.confidence], ['Condition', fd.condition], ['Price/SqFt', '$'+v.ppsf+'/sqft'], ['Comps Used', v.compsCount]];
    stats.forEach(function(st, i) {
      var sx = 0.3 + i * 2.4;
      s2.addText(st[0], { x: sx, y: 3.75, w: 2.2, h: 0.3, fontSize: 10, color: GRAY, align: 'center' });
      s2.addText(String(st[1]), { x: sx, y: 4.05, w: 2.2, h: 0.4, fontSize: 15, color: CREAM, bold: true, align: 'center' });
    });

    // ---- SLIDE 3: PROPERTY DETAILS ----
    var s3 = pptx.addSlide();
    s3.background = { color: NAVY };
    s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: GOLD } });
    s3.addText('PROPERTY DETAILS', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, color: GOLD, bold: true });
    var detPairs = [
      ['Address', fd.address], ['City/State/Zip', fd.city+', '+fd.state+' '+fd.zip],
      ['Bedrooms', fd.beds], ['Full Baths', fd.bathsFull], ['Half Baths', fd.bathsHalf],
      ['Square Footage', fd.sqft?fd.sqft.toLocaleString()+' sqft':'—'],
      ['Year Built', fd.yearBuilt||'—'], ['Garage', fd.garage+' stall(s)'],
      ['Basement', fd.basement], ['Stories', fd.stories],
      ['Condition', fd.condition], ['Kitchen', fd.kitchen],
      ['Bathroom', fd.bathRemodel], ['Roof Age', fd.roofAge<99?fd.roofAge+' yrs':'—'],
      ['HVAC Age', fd.hvacAge<99?fd.hvacAge+' yrs':'—'], ['Windows', fd.windows]
    ];
    var dy = 0.9, col2x = 5.2;
    detPairs.forEach(function(dp, i) {
      var col = i % 2 === 0 ? 0.5 : col2x;
      if (i % 2 === 0 && i > 0) dy += 0.42;
      s3.addText(dp[0] + ': ', { x: col, y: dy, w: 2.2, h: 0.38, fontSize: 11, color: GRAY });
      s3.addText(String(dp[1]||'—'), { x: col+2.2, y: dy, w: 2.4, h: 0.38, fontSize: 11, color: CREAM, bold: true });
    });

    // ---- SLIDE 4: COMPARABLE SALES ----
    var s4 = pptx.addSlide();
    s4.background = { color: NAVY };
    s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: GOLD } });
    s4.addText('COMPARABLE SALES', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, color: GOLD, bold: true });
    var compHeaders = ['Address','Sale Price','Bed','Bath','Sq Ft','$/SF','Date'];
    var compCols = [3.2, 1.2, 0.55, 0.55, 0.9, 0.75, 1.0];
    var cx = 0.2;
    compHeaders.forEach(function(h, i) {
      s4.addText(h, { x: cx, y: 0.9, w: compCols[i], h: 0.35, fontSize: 9, color: GRAY, bold: true });
      cx += compCols[i];
    });
    var ry = 1.28;
    hvComps.slice(0,5).forEach(function(c, ri) {
      if (ri % 2 === 0) s4.addShape(pptx.ShapeType.rect, { x: 0.1, y: ry-0.03, w: 9.8, h: 0.4, fill: { color: '1A2830' } });
      var vals = [
        (c.address||'—').substring(0,32),
        c.price ? '$'+c.price.toLocaleString() : '—',
        c.beds||'—', c.baths||'—',
        c.sqft ? c.sqft.toLocaleString() : '—',
        c.ppsf ? '$'+c.ppsf : '—',
        c.date ? c.date.split('T')[0] : '—'
      ];
      var cx2 = 0.2;
      vals.forEach(function(val, ci) {
        s4.addText(String(val), { x: cx2, y: ry, w: compCols[ci], h: 0.35, fontSize: 9, color: CREAM });
        cx2 += compCols[ci];
      });
      ry += 0.42;
    });

    // ---- SLIDE 5: ADJUSTMENTS ----
    var s5 = pptx.addSlide();
    s5.background = { color: NAVY };
    s5.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: GOLD } });
    s5.addText('VALUE ADJUSTMENTS', { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 22, color: GOLD, bold: true });
    var ay = 0.9;
    var allAdj5 = [{ label: 'Condition ('+fd.condition+')', pct: v.condAdj, dollar: v.condAdjDollar }];
    v.adjBreakdown.forEach(function(a) { allAdj5.push({ label: a.label, pct: parseFloat(a.pct)/100, dollar: Math.round(v.base*parseFloat(a.pct)/100) }); });
    allAdj5.forEach(function(a) {
      var pSign = a.pct>=0?'+':''; var dSign = a.dollar>=0?'+':'';
      var aColor = a.pct >= 0 ? '4CAF50' : 'e74c3c';
      s5.addText(a.label, { x: 0.5, y: ay, w: 5, h: 0.38, fontSize: 13, color: CREAM });
      s5.addText(pSign+(a.pct*100).toFixed(1)+'%', { x: 5.5, y: ay, w: 1.5, h: 0.38, fontSize: 13, color: aColor, bold: true, align: 'right' });
      s5.addText(dSign+'$'+Math.abs(a.dollar).toLocaleString(), { x: 7.0, y: ay, w: 2.5, h: 0.38, fontSize: 13, color: CREAM, align: 'right' });
      var barMax = 3.5, barW = Math.min(Math.abs(a.pct)*30, barMax);
      s5.addShape(pptx.ShapeType.rect, { x: 0.5, y: ay+0.42, w: barW, h: 0.1, fill: { color: aColor } });
      ay += 0.75;
    });

    // ---- SLIDE 6: THANK YOU ----
    var s6 = pptx.addSlide();
    s6.background = { color: NAVY };
    s6.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.1, fill: { color: GOLD } });
    s6.addText('THANK YOU', { x: 0.5, y: 1.2, w: 9, h: 0.8, fontSize: 40, color: GOLD, bold: true, align: 'center', fontFace: 'Georgia' });
    if (fd.agentName) s6.addText(fd.agentName, { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 20, color: CREAM, bold: true, align: 'center' });
    s6.addText(fd.brokerage||'Gateway Real Estate Advisors', { x: 0.5, y: 3.1, w: 9, h: 0.4, fontSize: 14, color: GRAY, align: 'center' });
    if (fd.agentPhone) s6.addText(fd.agentPhone, { x: 0.5, y: 3.55, w: 9, h: 0.35, fontSize: 13, color: GRAY, align: 'center' });
    if (fd.agentEmail) s6.addText(fd.agentEmail, { x: 0.5, y: 3.9, w: 9, h: 0.35, fontSize: 13, color: GRAY, align: 'center' });
    s6.addShape(pptx.ShapeType.line, { x: 2, y: 4.4, w: 6, h: 0, line: { color: GOLD, width: 1 } });
    s6.addText('"Opening Doors to Your Future"', { x: 0.5, y: 4.6, w: 9, h: 0.5, fontSize: 16, color: GOLD, italic: true, align: 'center', fontFace: 'Georgia' });
    s6.addText('www.gatewayreadvisors.com  |  712-226-8000', { x: 0.5, y: 5.8, w: 9, h: 0.35, fontSize: 11, color: GRAY, align: 'center' });

    // Download
    var safeName = fd.address.replace(/[^a-zA-Z0-9]/g,'-').replace(/-+/g,'-');
    pptx.writeFile({ fileName: 'Gateway-Valuation-' + safeName + '-' + (fd.valDate||'') + '.pptx' })
      .catch(function() {
        pptx.write({ outputType: 'blob' }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'Gateway-Valuation-' + safeName + '.pptx';
          a.click(); setTimeout(function(){URL.revokeObjectURL(url);},2000);
        });
      });
  } catch(e) {
    console.error('PPTX error:', e);
    alert('PPTX generation failed: ' + e.message);
  }
}

function resetHomeValuation() {
  var fields = ['hv-address','hv-city','hv-state','hv-zip','hv-beds','hv-baths-full','hv-baths-half',
    'hv-sqft','hv-lot-sf','hv-lot-ac','hv-year','hv-garage','hv-roof-age','hv-hvac-age',
    'hv-agent-name','hv-agent-email','hv-agent-phone','hv-upgrades','hv-kitchen-yr','hv-bath-yr'];
  fields.forEach(function(id) { var el=document.getElementById(id); if(el) el.value=''; });
  ['hv-basement','hv-condition','hv-kitchen','hv-bath-remodel','hv-windows','hv-flooring'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.selectedIndex=0;
  });
  document.getElementById('hv-brokerage').value = 'Gateway Real Estate Advisors';
  document.getElementById('hv-val-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('hv-results-section').style.display = 'none';
  document.getElementById('hv-manual-comps').style.display = 'none';
  document.getElementById('hv-api-warn').style.display = 'none';
  document.getElementById('hv-loading').style.display = 'none';
  hvComps = []; hvValuation = {}; hvFormData = {};
  window.scrollTo(0,0);
}

// Expose
window.runHomeValuation = runHomeValuation;
window.hvSortComps = hvSortComps;
window.hvAddComp = hvAddComp;
window.hvDownloadPDF = hvDownloadPDF;
window.hvDownloadPPTX = hvDownloadPPTX;
window.resetHomeValuation = resetHomeValuation;
window.initHomeValuation = initHomeValuation;
