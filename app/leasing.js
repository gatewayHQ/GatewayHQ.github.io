// ===================================================================
// LEASING OM BUILDER
// ===================================================================
var leasingInitialized = false;
var lsAgents = [];
var lsSpaces = [];
var lsPhotos = [];

function initLeasing() {
  leasingInitialized = true;
  lsAgents = [{ name: '', title: '', company: 'Gateway Real Estate Advisors', email: '', phone: '', licenses: '' }];
  lsSpaces = [{ suite: '', sf: '', description: '', rate: '' }];
  lsPhotos = [null, null, null, null, null, null];
  renderLeasingAgents();
  renderLeasingSpaces();
  renderLeasingPhotos();
}

function showLeasingTab(i) {
  document.querySelectorAll('.leasing-tab').forEach((t, idx) => t.classList.toggle('active', idx === i));
  document.querySelectorAll('.leasing-panel').forEach((p, idx) => p.classList.toggle('active', idx === i));
}

function addLeasingSpace() {
  lsSpaces.push({ suite: '', sf: '', description: '', rate: '' });
  renderLeasingSpaces();
}

function renderLeasingSpaces() {
  var c = document.getElementById('ls-spaces-container');
  c.innerHTML = '';
  lsSpaces.forEach((s, i) => {
    var row = document.createElement('div');
    row.className = 'agent-form-card';
    row.innerHTML = `
      <button class="remove-agent" onclick="lsSpaces.splice(${i},1);renderLeasingSpaces()">&times;</button>
      <div class="input-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
        <div class="form-row"><label>Suite/Space</label><input type="text" value="${s.suite}" oninput="lsSpaces[${i}].suite=this.value" placeholder="e.g. Suite 200"></div>
        <div class="form-row"><label>Size (SF)</label><input type="text" value="${s.sf}" oninput="lsSpaces[${i}].sf=this.value" placeholder="e.g. 2,500"></div>
        <div class="form-row"><label>Rate ($/SF/Yr)</label><input type="text" value="${s.rate}" oninput="lsSpaces[${i}].rate=this.value" placeholder="e.g. $14.00"></div>
        <div class="form-row"><label>Description</label><input type="text" value="${s.description}" oninput="lsSpaces[${i}].description=this.value" placeholder="e.g. Corner unit, windows"></div>
      </div>
    `;
    c.appendChild(row);
  });
}

function addLeasingAgent() {
  lsAgents.push({ name: '', title: '', company: 'Gateway Real Estate Advisors', email: '', phone: '', licenses: '' });
  renderLeasingAgents();
}

function renderLeasingAgents() {
  var c = document.getElementById('ls-agents-container');
  c.innerHTML = '';
  lsAgents.forEach((a, i) => {
    var card = document.createElement('div');
    card.className = 'agent-form-card';
    card.innerHTML = `
      <button class="remove-agent" onclick="if(lsAgents.length>1){lsAgents.splice(${i},1);renderLeasingAgents()}">&times;</button>
      <div class="input-grid">
        <div class="form-row"><label>Name</label><input type="text" value="${a.name}" oninput="lsAgents[${i}].name=this.value"></div>
        <div class="form-row"><label>Title</label><input type="text" value="${a.title}" oninput="lsAgents[${i}].title=this.value"></div>
        <div class="form-row"><label>Company</label><input type="text" value="${a.company}" oninput="lsAgents[${i}].company=this.value"></div>
        <div class="form-row"><label>Phone</label><input type="text" value="${a.phone}" oninput="lsAgents[${i}].phone=this.value"></div>
        <div class="form-row"><label>Email</label><input type="text" value="${a.email}" oninput="lsAgents[${i}].email=this.value"></div>
        <div class="form-row"><label>License(s)</label><input type="text" value="${a.licenses}" oninput="lsAgents[${i}].licenses=this.value"></div>
      </div>
    `;
    c.appendChild(card);
  });
}

function addLeasingPhoto() {
  lsPhotos.push(null);
  renderLeasingPhotos();
}

function renderLeasingPhotos() {
  var c = document.getElementById('ls-photos-container');
  c.innerHTML = '';
  lsPhotos.forEach((p, i) => {
    var slot = document.createElement('div');
    slot.className = 'photo-slot';
    slot.style.aspectRatio = '4/3';
    slot.onclick = function() { document.getElementById('ls-photo-input-' + i).click(); };
    slot.innerHTML = `
      ${p ? '<img src="'+p+'">' : '<div class="placeholder"><span>📷</span>Photo '+(i+1)+'</div>'}
      <input type="file" id="ls-photo-input-${i}" accept="image/*,.heic,.HEIC" style="display:none" onchange="handleLeasingPhoto(${i}, this)">
    `;
    c.appendChild(slot);
  });
}

function handleLeasingPhoto(index, input) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      lsPhotos[index] = e.target.result;
      renderLeasingPhotos();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function fetchLeasingMarketData() {
  // Reuse the Census API approach from the Multifamily OM builder
  var state = document.getElementById('ls-state').value;
  var county = document.getElementById('ls-county').value;
  if (!state || !county) { showGlobalStatus('⚠️ Select a state and type a county name'); return; }
  // Use same Census API logic
  showGlobalStatus('🔍 Fetching market data...');
  var stateCode = {'IA':'19','SD':'46','NE':'31'}[state] || '';
  var apiKey = '91bcb0e5e1816f3dc59cf11e8c32e0ee52806688';
  var url = 'https://api.census.gov/data/2021/acs/acs5?get=NAME,B01003_001E,B19013_001E,B23025_005E,B23025_002E,B25064_001E,B01002_001E,B11001_001E,B25003_002E,B25003_003E,B25001_001E,B25010_001E&for=county:*&in=state:' + stateCode + '&key=' + apiKey;
  fetch(url).then(r => r.json()).then(data => {
    var header = data[0];
    var rows = data.slice(1);
    var match = rows.find(r => r[0].toLowerCase().includes(county.toLowerCase()));
    if (!match) { showGlobalStatus('⚠️ County not found'); return; }
    var pop = parseInt(match[1]).toLocaleString();
    var income = '$' + parseInt(match[2]).toLocaleString();
    document.getElementById('ls-population').value = pop;
    document.getElementById('ls-income').value = income;
    document.getElementById('ls-market-overview').value = match[0] + ' has a population of ' + pop + ' with a median household income of ' + income + '. The area presents opportunities for commercial leasing across multiple sectors.';
    showGlobalStatus('✅ Market data loaded!');
  }).catch(e => { showGlobalStatus('⚠️ Market data fetch failed'); });
}

function generateLeasingOM() {
  var pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'GATEWAY', w: 10, h: 5.625 });
  pptx.layout = 'GATEWAY';

  var bg = { color: BRAND.navy };
  var lightBg = { color: 'F5F6F8' };

  // Slide 1: Cover
  var slide1 = pptx.addSlide();
  slide1.background = bg;
  slide1.addText(document.getElementById('ls-prop-name').value || 'Property Name', { x: 0.6, y: 1.2, w: 8.8, fontSize: 36, fontFace: 'Georgia', color: 'FFFFFF', bold: true });
  slide1.addText(document.getElementById('ls-prop-type').value + ' | ' + (document.getElementById('ls-lease-type').value || ''), { x: 0.6, y: 1.9, w: 8.8, fontSize: 16, fontFace: 'Arial', color: 'A2B6C0' });
  slide1.addText(document.getElementById('ls-address').value + '\n' + document.getElementById('ls-city-state').value, { x: 0.6, y: 2.5, w: 8.8, fontSize: 14, fontFace: 'Arial', color: 'E4E3D4' });
  slide1.addText('FOR LEASE', { x: 0.6, y: 3.4, w: 2, fontSize: 14, fontFace: 'Arial', color: 'A2B6C0', bold: true });
  slide1.addShape('rect', { x: 0.6, y: 3.8, w: 8.8, h: 0.01, fill: { color: 'A2B6C0' } });
  addLeasingFooter(slide1);
  if (LOGO_PRIMARY_LIGHT) slide1.addImage({ data: LOGO_PRIMARY_LIGHT, x: 6.5, y: 0.3, w: 3.2, h: 0.7 });

  // Slide 2: Property Overview
  var slide2 = pptx.addSlide();
  slide2.background = lightBg;
  slide2.addText('Property Overview', { x: 0.6, y: 0.3, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: '1E2F39' });
  var propDetails = [
    ['Type', document.getElementById('ls-prop-type').value],
    ['Total SF', document.getElementById('ls-total-sf').value],
    ['Available SF', document.getElementById('ls-avail-sf').value],
    ['Year Built', document.getElementById('ls-year-built').value],
    ['Lot Size', document.getElementById('ls-lot-size').value],
    ['Zoning', document.getElementById('ls-zoning').value],
    ['Parking', document.getElementById('ls-parking').value]
  ];
  propDetails.forEach((d, i) => {
    var yy = 1.0 + i * 0.45;
    var rowBg = i % 2 === 0 ? 'E8E8E8' : 'F5F6F8';
    slide2.addShape('rect', { x: 0.6, y: yy, w: 8.8, h: 0.42, fill: { color: rowBg } });
    slide2.addText(d[0], { x: 0.8, y: yy + 0.05, w: 3, fontSize: 12, fontFace: 'Arial', color: '666666', bold: true });
    slide2.addText(d[1] || '—', { x: 4, y: yy + 0.05, w: 5, fontSize: 12, fontFace: 'Arial', color: '282828' });
  });
  if (document.getElementById('ls-description').value) {
    slide2.addText(document.getElementById('ls-description').value, { x: 0.6, y: 4.2, w: 8.8, fontSize: 11, fontFace: 'Arial', color: '444444', lineSpacing: 16 });
  }
  addLeasingFooter(slide2);

  // Slide 3: Lease Details
  var slide3 = pptx.addSlide();
  slide3.background = lightBg;
  slide3.addText('Lease Details', { x: 0.6, y: 0.3, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: '1E2F39' });
  var leaseDetails = [
    ['Lease Type', document.getElementById('ls-lease-type').value],
    ['Asking Rate', document.getElementById('ls-asking-rate').value],
    ['NNN Expenses', document.getElementById('ls-nnn-rate').value],
    ['Min Divisible', document.getElementById('ls-min-sf').value],
    ['Lease Term', document.getElementById('ls-lease-term').value],
    ['Available', document.getElementById('ls-avail-date').value],
    ['TI Allowance', document.getElementById('ls-ti').value]
  ];
  leaseDetails.forEach((d, i) => {
    var yy = 1.0 + i * 0.45;
    var rowBg = i % 2 === 0 ? 'E8E8E8' : 'F5F6F8';
    slide3.addShape('rect', { x: 0.6, y: yy, w: 8.8, h: 0.42, fill: { color: rowBg } });
    slide3.addText(d[0], { x: 0.8, y: yy + 0.05, w: 3, fontSize: 12, fontFace: 'Arial', color: '666666', bold: true });
    slide3.addText(d[1] || '—', { x: 4, y: yy + 0.05, w: 5, fontSize: 12, fontFace: 'Arial', color: '282828' });
  });
  addLeasingFooter(slide3);

  // Slide 4: Available Spaces
  if (lsSpaces.length > 0 && lsSpaces[0].suite) {
    var slide4 = pptx.addSlide();
    slide4.background = lightBg;
    slide4.addText('Available Spaces', { x: 0.6, y: 0.3, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: '1E2F39' });
    // Header row
    slide4.addShape('rect', { x: 0.6, y: 0.9, w: 8.8, h: 0.4, fill: { color: '1E2F39' } });
    slide4.addText('Suite', { x: 0.8, y: 0.95, w: 2, fontSize: 11, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    slide4.addText('Size (SF)', { x: 3, y: 0.95, w: 1.5, fontSize: 11, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    slide4.addText('Rate/SF', { x: 4.7, y: 0.95, w: 1.5, fontSize: 11, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    slide4.addText('Description', { x: 6.4, y: 0.95, w: 3, fontSize: 11, fontFace: 'Arial', color: 'FFFFFF', bold: true });
    lsSpaces.forEach((s, i) => {
      if (!s.suite) return;
      var yy = 1.35 + i * 0.4;
      var rowBg = i % 2 === 0 ? 'E8E8E8' : 'F5F6F8';
      slide4.addShape('rect', { x: 0.6, y: yy, w: 8.8, h: 0.38, fill: { color: rowBg } });
      slide4.addText(s.suite, { x: 0.8, y: yy + 0.05, w: 2, fontSize: 11, fontFace: 'Arial', color: '282828' });
      slide4.addText(s.sf, { x: 3, y: yy + 0.05, w: 1.5, fontSize: 11, fontFace: 'Arial', color: '282828' });
      slide4.addText(s.rate, { x: 4.7, y: yy + 0.05, w: 1.5, fontSize: 11, fontFace: 'Arial', color: '282828' });
      slide4.addText(s.description, { x: 6.4, y: yy + 0.05, w: 3, fontSize: 11, fontFace: 'Arial', color: '282828' });
    });
    addLeasingFooter(slide4);
  }

  // Slide 5: Photos
  var validPhotos = lsPhotos.filter(p => p !== null);
  if (validPhotos.length > 0) {
    var slide5 = pptx.addSlide();
    slide5.background = bg;
    slide5.addText('Property Photos', { x: 0.6, y: 0.2, w: 8.8, fontSize: 24, fontFace: 'Georgia', color: 'FFFFFF' });
    var cols = Math.min(3, validPhotos.length);
    var phW = (9 - 0.2 * (cols - 1)) / cols;
    var phH = phW * 0.7;
    validPhotos.slice(0, 6).forEach((p, i) => {
      var col = i % cols;
      var row = Math.floor(i / cols);
      slide5.addImage({ data: p, x: 0.5 + col * (phW + 0.2), y: 0.9 + row * (phH + 0.2), w: phW, h: phH, rounding: true });
    });
    addLeasingFooter(slide5);
  }

  // Slide 6: Contact
  var slideC = pptx.addSlide();
  slideC.background = bg;
  if (LOGO_ROUND_SUBMARK) slideC.addImage({ data: LOGO_ROUND_SUBMARK, x: 4, y: 0.4, w: 2, h: 2 });
  slideC.addText('EXCLUSIVELY OFFERED BY', { x: 0.6, y: 2.5, w: 8.8, fontSize: 14, fontFace: 'Arial', color: 'A2B6C0', align: 'center', spacing: 4 });
  lsAgents.forEach((a, i) => {
    if (!a.name) return;
    var ax = 1 + i * 3.5;
    slideC.addText(a.name, { x: ax, y: 3.0, w: 3, fontSize: 14, fontFace: 'Arial', color: 'FFFFFF', bold: true, align: 'center' });
    slideC.addText(a.title || '', { x: ax, y: 3.3, w: 3, fontSize: 11, fontFace: 'Arial', color: 'A2B6C0', align: 'center' });
    slideC.addText((a.phone || '') + '\n' + (a.email || ''), { x: ax, y: 3.6, w: 3, fontSize: 10, fontFace: 'Arial', color: 'E4E3D4', align: 'center', lineSpacing: 14 });
  });
  addLeasingFooter(slideC);

  var propName = document.getElementById('ls-prop-name').value || 'Leasing_OM';
  pptx.writeFile({ fileName: propName.replace(/\s+/g, '_') + '_Leasing_OM.pptx' });
  showGlobalStatus('✅ Leasing OM generated!');
}

function addLeasingFooter(slide) {
  slide.addText('GATEWAY REAL ESTATE ADVISORS', { x: 0.3, y: 5.2, w: 4, fontSize: 8, fontFace: 'Arial', color: 'A2B6C0', spacing: 2 });
  slide.addText('CONFIDENTIAL', { x: 4, y: 5.2, w: 2, fontSize: 8, fontFace: 'Arial', color: 'A2B6C0', align: 'center' });
  if (LOGO_WORDMARK_LIGHT) {
    try { slide.addImage({ data: LOGO_WORDMARK_LIGHT, x: 8.2, y: 5.1, w: 1.5, h: 0.35 }); } catch(e) {}
  }
}
