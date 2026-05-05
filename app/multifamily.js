// ==== TRANSPARENT PNG LOGOS FOR PPTX ====

// ==== BRAND COLORS ====
var DARK = '282828', NAVY = '1E2F39', BLUE = 'A2B6C0', GRAY = '969694', CREAM = 'E4E3D4', WHITE = 'FFFFFF';

// ==== STATE NAMES ====
var STATE_NAMES = {"01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota","28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming"};

// ==== TABS ====
function showTab(i) {
  document.querySelectorAll('.tab').forEach(function(t,j){ t.classList.toggle('active', j===i); });
  document.querySelectorAll('.panel').forEach(function(p,j){ p.classList.toggle('active', j===i); });
}

// ==== UNIT MIX ====
var unitData = [{ type:'', units:0, sqft:0, rent:0 }];
var showSqFt = true;
function toggleSqFt() {
  showSqFt = document.getElementById('showSqFt').checked;
  document.querySelectorAll('.sqft-col').forEach(function(el){ el.style.display = showSqFt ? '' : 'none'; });
  renderUnits();
}
function renderUnits() {
  var tbody = document.getElementById('unitRows');
  tbody.innerHTML = '';
  unitData.forEach(function(u,i){
    var rentSqft = u.sqft > 0 ? (u.rent / u.sqft).toFixed(2) : '0.00';
    var totalRent = u.units * u.rent;
    var totalAllRent = unitData.reduce(function(s,r){return s+r.units*r.rent},0);
    var pct = totalAllRent > 0 ? ((totalRent/totalAllRent)*100).toFixed(0) : '0';
    var tr = document.createElement('tr');
    var sqftDisplay = showSqFt ? '' : 'display:none';
    tr.innerHTML =
      '<td><input value="'+u.type+'" onchange="unitData['+i+'].type=this.value"></td>'+
      '<td><input type="number" value="'+u.units+'" onchange="unitData['+i+'].units=+this.value;renderUnits()"></td>'+
      '<td class="sqft-col" style="'+sqftDisplay+'"><input type="number" value="'+(u.sqft||'')+'" placeholder="—" onchange="unitData['+i+'].sqft=+this.value;renderUnits()"></td>'+
      '<td><input type="number" value="'+u.rent+'" onchange="unitData['+i+'].rent=+this.value;renderUnits()"></td>'+
      '<td class="sqft-col" style="'+sqftDisplay+'"><input value="$'+rentSqft+'" readonly style="color:var(--brand-blue);border:none"></td>'+
      '<td><input value="$'+totalRent.toLocaleString()+'" readonly style="color:var(--brand-blue);border:none"></td>'+
      '<td><input value="'+pct+'%" readonly style="color:var(--brand-blue);border:none"></td>'+
      '<td><button class="btn-sm danger" onclick="unitData.splice('+i+',1);renderUnits()">\u2715</button></td>';
    tbody.appendChild(tr);
  });
}
function addUnitRow() { unitData.push({type:'',units:0,sqft:0,rent:0}); renderUnits(); }
renderUnits();

// ==== DYNAMIC EXPENSES (v5 NEW) ====
var curExpenses = [
  {name:'Taxes', amount:0},
  {name:'Insurance', amount:0},
  {name:'Maintenance', amount:0},
  {name:'Management', amount:0},
  {name:'Utilities', amount:0},
  {name:'Reserves', amount:0}
];
var pfExpenses = [
  {name:'Taxes', amount:0},
  {name:'Insurance', amount:0},
  {name:'Maintenance', amount:0},
  {name:'Management', amount:0},
  {name:'Utilities', amount:0},
  {name:'Reserves', amount:0}
];

function renderExpenses(prefix) {
  var list = prefix === 'cur' ? curExpenses : pfExpenses;
  var container = document.getElementById(prefix + 'ExpenseRows');
  container.innerHTML = '';
  list.forEach(function(exp, i) {
    var row = document.createElement('div');
    row.className = 'expense-row';
    row.innerHTML =
      '<input value="' + exp.name + '" placeholder="Expense name" onchange="' + (prefix==='cur'?'curExpenses':'pfExpenses') + '['+i+'].name=this.value">' +
      '<input type="number" value="' + (exp.amount||'') + '" placeholder="0" oninput="' + (prefix==='cur'?'curExpenses':'pfExpenses') + '['+i+'].amount=+this.value;calcNOI(\'' + prefix + '\')">' +
      '<button class="expense-remove" onclick="' + (prefix==='cur'?'curExpenses':'pfExpenses') + '.splice('+i+',1);renderExpenses(\'' + prefix + '\');calcNOI(\'' + prefix + '\')">\u2715</button>';
    container.appendChild(row);
  });
}

function addExpense(prefix) {
  var list = prefix === 'cur' ? curExpenses : pfExpenses;
  list.push({name:'', amount:0});
  renderExpenses(prefix);
}

// ==== OTHER INCOME (v5 NEW) ====
var curOtherIncome = [];
var pfOtherIncome = [];

function renderOtherIncome(prefix) {
  var list = prefix === 'cur' ? curOtherIncome : pfOtherIncome;
  var container = document.getElementById(prefix + 'OtherIncomeRows');
  container.innerHTML = '';
  list.forEach(function(inc, i) {
    var row = document.createElement('div');
    row.className = 'income-row';
    row.innerHTML =
      '<input value="' + inc.name + '" placeholder="e.g. Laundry, Parking, Pet Fees" onchange="' + (prefix==='cur'?'curOtherIncome':'pfOtherIncome') + '['+i+'].name=this.value">' +
      '<input type="number" value="' + (inc.amount||'') + '" placeholder="0" oninput="' + (prefix==='cur'?'curOtherIncome':'pfOtherIncome') + '['+i+'].amount=+this.value;calcNOI(\'' + prefix + '\')">' +
      '<button class="expense-remove" onclick="' + (prefix==='cur'?'curOtherIncome':'pfOtherIncome') + '.splice('+i+',1);renderOtherIncome(\'' + prefix + '\');calcNOI(\'' + prefix + '\')">\u2715</button>';
    container.appendChild(row);
  });
}

function addOtherIncome(prefix) {
  var list = prefix === 'cur' ? curOtherIncome : pfOtherIncome;
  list.push({name:'', amount:0});
  renderOtherIncome(prefix);
}

// ==== NOI CALCULATION (v5 UPDATED) ====
function calcNOI(prefix) {
  var grossIncome = +(document.getElementById(prefix + 'Income').value) || 0;
  var otherList = prefix === 'cur' ? curOtherIncome : pfOtherIncome;
  var otherTotal = otherList.reduce(function(s, o) { return s + (+o.amount || 0); }, 0);
  var totalIncome = grossIncome + otherTotal;
  
  var expList = prefix === 'cur' ? curExpenses : pfExpenses;
  var totalExpenses = expList.reduce(function(s, e) { return s + (+e.amount || 0); }, 0);
  
  var noi = totalIncome - totalExpenses;
  
  document.getElementById(prefix + 'TotalIncome').textContent = '$' + totalIncome.toLocaleString();
  document.getElementById(prefix + 'NOI').textContent = '$' + noi.toLocaleString();
  recalcMetrics();
}

function autoCalcDownPayment() {
  var price = +(document.getElementById('askingPrice').value) || 0;
  if (!price) { showGlobalStatus('⚠️ Enter Asking Price first'); return; }
  var dp = Math.round(price * 0.25);
  document.getElementById('downPayment').value = dp;
  recalcMetrics();
  showGlobalStatus('Down payment set to 25% of asking price ($' + dp.toLocaleString() + ')');
}

function recalcMetrics() {
  var askingPrice = +(document.getElementById('askingPrice').value) || 0;
  var totalUnits = +(document.getElementById('totalUnits').value) || 0;
  var downPayment = +(document.getElementById('downPayment').value) || 0;
  
  // Current NOI from financials
  var curGross = +(document.getElementById('curIncome').value) || 0;
  var curOtherTot = curOtherIncome.reduce(function(s,o){ return s + (+o.amount||0); }, 0);
  var curTotalIncome = curGross + curOtherTot;
  var curTotExp = curExpenses.reduce(function(s,e){ return s + (+e.amount||0); }, 0);
  var curNOI = curTotalIncome - curTotExp;
  
  // Auto-fill NOI on exec summary tab
  if (curNOI) document.getElementById('noi').value = Math.round(curNOI);
  
  // Cap Rate = NOI / Asking Price × 100
  if (askingPrice > 0 && curNOI) {
    document.getElementById('capRate').value = ((curNOI / askingPrice) * 100).toFixed(2);
  }
  
  // Price Per Unit
  if (askingPrice > 0 && totalUnits > 0) {
    document.getElementById('pricePerUnit').value = Math.round(askingPrice / totalUnits);
  }
  
  // GRM = Asking Price / Gross Annual Income
  if (askingPrice > 0 && curTotalIncome > 0) {
    document.getElementById('grm').value = (askingPrice / curTotalIncome).toFixed(1);
  }
  
  // Cash-on-Cash = NOI / Down Payment × 100
  if (downPayment > 0 && curNOI) {
    document.getElementById('cashOnCash').value = ((curNOI / downPayment) * 100).toFixed(1) + '%';
  } else if (askingPrice > 0 && curNOI) {
    // Fallback: show based on asking price if no down payment entered
    document.getElementById('cashOnCash').value = '—';
  }
}

// Initialize renders
renderExpenses('cur');
renderExpenses('pf');
renderOtherIncome('cur');
renderOtherIncome('pf');

// ==== PHOTOS ====
var photos = [null, null, null, null, null, null];
function renderPhotos() {
  var grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  photos.forEach(function(p, i) {
    var slot = document.createElement('div');
    slot.className = 'photo-slot' + (p ? ' has-photo' : '');
    slot.innerHTML =
      (p ? '<img src="'+p+'">' : '') +
      '<div class="placeholder">\ud83d\udcf7<br>Click to upload<br>Photo '+(i+1)+'</div>' +
      '<button class="remove-btn" onclick="event.stopPropagation();photos['+i+']=null;renderPhotos()">\u2715</button>' +
      '<input type="file" accept="image/*,.heic,.HEIC" onchange="handlePhoto('+i+', this)">';
    grid.appendChild(slot);
  });
}
function addPhotoSlot() { photos.push(null); renderPhotos(); }
function handlePhoto(index, input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) { photos[index] = e.target.result; renderPhotos(); };
  reader.readAsDataURL(file);
}
renderPhotos();

// ==== AGENTS ====
var agents = [
  { name: 'Daniel Stillson', title: 'Commercial Real Estate Agent', company: 'Gateway Real Estate Advisors', email: 'daniel@gatewayreadvisors.com', phone: '', licenses: 'Licensed in Iowa, South Dakota, Nebraska' },
  { name: '', title: '', company: 'Gateway Real Estate Advisors', email: '', phone: '', licenses: '' }
];
function renderAgents() {
  var container = document.getElementById('agentCards');
  container.innerHTML = '';
  agents.forEach(function(a, i) {
    var card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML =
      '<div class="agent-card-header">' +
      '<span class="agent-card-title">Agent '+(i+1)+'</span>' +
      (agents.length > 1 ? '<button class="btn-sm danger" onclick="agents.splice('+i+',1);renderAgents()">Remove</button>' : '') +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>Name</label><input value="'+a.name+'" onchange="agents['+i+'].name=this.value"></div>' +
      '<div class="form-group"><label>Title</label><input value="'+a.title+'" onchange="agents['+i+'].title=this.value"></div>' +
      '<div class="form-group"><label>Company</label><input value="'+a.company+'" onchange="agents['+i+'].company=this.value"></div>' +
      '<div class="form-group"><label>Email</label><input value="'+a.email+'" onchange="agents['+i+'].email=this.value"></div>' +
      '<div class="form-group"><label>Phone</label><input value="'+a.phone+'" onchange="agents['+i+'].phone=this.value"></div>' +
      '<div class="form-group"><label>Licenses</label><input value="'+a.licenses+'" onchange="agents['+i+'].licenses=this.value"></div>' +
      '</div>';
    container.appendChild(card);
  });
}
function addAgent() { agents.push({ name:'', title:'', company:'Gateway Real Estate Advisors', email:'', phone:'', licenses:'' }); renderAgents(); }
renderAgents();

// ==== MARKET DATA AUTO-FILL ====
function fetchMarketData() {
  var city = document.getElementById('mktCity').value.trim();
  var stateFips = document.getElementById('mktState').value;
  var county = document.getElementById('mktCounty').value.trim();
  var statusEl = document.getElementById('fetchStatus');
  var btn = document.getElementById('fetchBtn');
  
  if (!stateFips || !county) {
    statusEl.className = 'fetch-status error';
    statusEl.textContent = 'Please select a State and enter a County name.';
    return;
  }
  
  statusEl.className = 'fetch-status loading';
  statusEl.textContent = 'Fetching data from U.S. Census Bureau...';
  btn.disabled = true;
  
  var stateName = STATE_NAMES[stateFips] || '';
  var displayCity = city || county;
  
  var vars = 'NAME,B01003_001E,B19013_001E,B01002_001E,B25001_001E,B25003_001E,B25003_002E,B25003_003E,B25064_001E,B25010_001E,B23025_003E,B23025_005E';
  var url = 'https://api.census.gov/data/2022/acs/acs5?get=' + vars + '&for=county:*&in=state:' + stateFips;
  
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var countyLower = county.toLowerCase().replace(/\s+county$/i, '');
      var match = null;
      for (var i = 1; i < data.length; i++) {
        var name = data[i][0].toLowerCase();
        if (name.indexOf(countyLower) !== -1) {
          match = data[i];
          break;
        }
      }
      
      if (!match) {
        statusEl.className = 'fetch-status error';
        statusEl.textContent = 'Could not find "' + county + '" county in ' + stateName + '. Try the exact county name.';
        btn.disabled = false;
        return;
      }
      
      var pop = parseInt(match[1]) || 0;
      var medIncome = parseInt(match[2]) || 0;
      var medAge = parseFloat(match[3]) || 0;
      var totalHousingUnits = parseInt(match[4]) || 0;
      var totalHouseholds = parseInt(match[5]) || 0;
      var ownerOcc = parseInt(match[6]) || 0;
      var renterOcc = parseInt(match[7]) || 0;
      var medRent = parseInt(match[8]) || 0;
      var hhSize = parseFloat(match[9]) || 0;
      var laborForce = parseInt(match[10]) || 0;
      var unemployed = parseInt(match[11]) || 0;
      var unempRate = laborForce > 0 ? ((unemployed / laborForce) * 100).toFixed(1) : '\u2014';
      var ownerPct = totalHouseholds > 0 ? ((ownerOcc / totalHouseholds) * 100).toFixed(0) : '\u2014';
      var renterPct = totalHouseholds > 0 ? ((renterOcc / totalHouseholds) * 100).toFixed(0) : '\u2014';
      
      document.getElementById('population').value = pop.toLocaleString();
      document.getElementById('medianIncome').value = '$' + medIncome.toLocaleString();
      document.getElementById('unemployment').value = unempRate + '%';
      document.getElementById('avgRent').value = '$' + medRent.toLocaleString();
      document.getElementById('medianAge').value = medAge.toFixed(1);
      document.getElementById('households').value = totalHouseholds.toLocaleString();
      document.getElementById('ownerOcc').value = ownerPct + '%';
      document.getElementById('renterOcc').value = renterPct + '%';
      document.getElementById('housingUnits').value = totalHousingUnits.toLocaleString();
      document.getElementById('hhSize').value = hhSize.toFixed(2);
      
      document.getElementById('mktDesc').value = displayCity + ', ' + stateName + ' is located in ' + county + ' County' +
        ' with a population of ' + pop.toLocaleString() + ' and a median household income of $' + medIncome.toLocaleString() + '.' +
        ' The area features a ' + unempRate + '% unemployment rate and a median gross rent of $' + medRent.toLocaleString() + '/month,' +
        ' reflecting a healthy rental market. With ' + renterPct + '% renter-occupied housing, the market supports strong demand for multifamily investment.';
      
      document.getElementById('drv1Title').value = 'Growing Economy';
      document.getElementById('drv1Desc').value = 'With a ' + unempRate + '% unemployment rate, ' + county + ' County demonstrates economic stability and diverse employment.';
      document.getElementById('drv2Title').value = 'Strong Rental Demand';
      document.getElementById('drv2Desc').value = renterPct + '% renter-occupied housing indicates sustained demand for quality rental properties in the area.';
      document.getElementById('drv3Title').value = 'Affordable Market';
      document.getElementById('drv3Desc').value = 'Median rent of $' + medRent.toLocaleString() + '/month and median income of $' + medIncome.toLocaleString() + ' create a balanced rental market with room for growth.';
      
      statusEl.className = 'fetch-status success';
      statusEl.textContent = '\u2705 Market data loaded for ' + match[0] + ' (ACS 2022 5-Year Estimates)';
      btn.disabled = false;
    })
    .catch(function(err) {
      statusEl.className = 'fetch-status error';
      statusEl.textContent = 'Error fetching data: ' + err.message + '. You can enter data manually.';
      btn.disabled = false;
    });
}

// ==== STATUS ====
function showStatus(msg) {
  var el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function(){ el.style.display='none'; }, 3500);
}

// ==== TEMPLATE PICKER ====
function selectOMTemplate(n) {
  localStorage.setItem('gateway_om_template_selection', n);
  for (var i = 1; i <= 2; i++) {
    var card = document.getElementById('tpl-card-' + i);
    if (card) card.classList.toggle('tpl-active', i === n);
  }
  var lbl = document.getElementById('btn-export-label');
  if (lbl) lbl.textContent = n === 2 ? 'Export OM (PDF)' : 'Export OM (PPTX)';
}

(function initTemplatePicker() {
  var saved = parseInt(localStorage.getItem('gateway_om_template_selection') || '1', 10);
  if (saved === 2) setTimeout(function() { selectOMTemplate(2); }, 0);
})();

function exportOM() {
  var tpl = parseInt(localStorage.getItem('gateway_om_template_selection') || '1', 10);
  if (tpl === 2) generateGatewaySignature();
  else generateOM();
}

// ==== GATEWAY SIGNATURE TEMPLATE ====
function generateGatewaySignature() {
  var v=function(id){var el=document.getElementById(id);return el?el.value:'';};
  var n=function(id){var el=document.getElementById(id);return el?(+el.value||0):0;};
  var fmt=function(num){return'$'+(num||0).toLocaleString();};
  var fmtK=function(num){if(Math.abs(num||0)>=1000000)return'$'+((num||0)/1000000).toFixed(2)+'M';if(Math.abs(num||0)>=1000)return'$'+Math.round((num||0)/1000)+'K';return'$'+(num||0).toLocaleString();};
  var propName1=v('propName1')||'Property Name',propName2=v('propName2')||'',address=v('address')||'';
  var askingPrice=n('askingPrice'),totalUnits=n('totalUnits'),capRate=v('capRate')||'';
  var pricePerUnit=n('pricePerUnit'),noi=n('noi'),grm=v('grm')||'';
  var execDesc=v('execDesc')||'',callout=v('callout')||'';
  var hl1=v('hl1'),hl2=v('hl2'),hl3=v('hl3'),hl4=v('hl4');
  var propDesc=v('propDesc')||'',occupancy=v('occupancy')||'',yearBuilt=v('yearBuilt')||'';
  var lotSize=v('lotSize')||'',parking=v('parking')||'',propType=v('propType')||'';
  var buildings=v('buildings')||'',features=v('features')||'';
  var curIncome=n('curIncome'),pfIncome=n('pfIncome');
  var mktCity=v('mktCity')||'',mktDesc=v('mktDesc')||'',population=v('population')||'';
  var medIncome=v('medianIncome')||'',unemployment=v('unemployment')||'',avgRent=v('avgRent')||'';
  var gwData={};try{gwData=JSON.parse(localStorage.getItem('gateway_about_company')||'{}');}catch(e){}
  var agentProfiles=[];Object.keys(localStorage).forEach(function(k){if(k.startsWith('gateway_agent_profile_')&&agentProfiles.length<4){try{agentProfiles.push(JSON.parse(localStorage.getItem(k)));}catch(e){}}});
  var ph=photos||[],coverPhoto=ph[0]||'',galleryPhotos=[ph[1],ph[2],ph[3],ph[4],ph[5]].filter(Boolean);
  var unitMixRows='',totalUnitsCalc=0,totalRentCalc=0;
  (unitData||[]).forEach(function(u){if(!u.type&&!u.units)return;var mo=(u.units||0)*(u.rent||0);totalUnitsCalc+=(u.units||0);totalRentCalc+=mo;unitMixRows+='<tr><td>'+(u.type||'')+'</td><td>'+(u.units||0)+'</td><td>'+(u.sqft||0)+' sf</td><td>'+fmt(u.rent)+'</td><td class="num">'+fmt(mo)+'</td></tr>';});
  var annualRent=totalRentCalc*12,curExpRows='',curExpTotal=0;
  (curExpenses||[]).forEach(function(e){if(!e.name)return;curExpTotal+=(e.amount||0);curExpRows+='<tr><td>'+e.name+'</td><td class="num">'+fmt(e.amount)+'</td><td class="num">'+fmt(e.amount)+'</td></tr>';});
  var curOtherRows='';(curOtherIncome||[]).forEach(function(o){if(!o.name)return;curOtherRows+='<tr><td>'+o.name+'</td><td class="num">'+fmt(o.amount)+'</td><td class="num">'+fmt(o.pfAmount||o.amount)+'</td></tr>';});
  var hlHTML=[hl1,hl2,hl3,hl4].filter(Boolean).map(function(h){return'<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;"><span style="color:#C8A84B;font-size:14px;flex-shrink:0;margin-top:2px;">&#10022;</span><p style="font-size:12px;line-height:1.75;color:#2C2C2C;margin:0;">'+h+'</p></div>';}).join('');
  var photoGallery=galleryPhotos.length?'<div style="display:grid;grid-template-columns:repeat('+Math.min(galleryPhotos.length,3)+',1fr);gap:8px;">'+galleryPhotos.map(function(p){return'<img src="'+p+'" style="width:100%;height:178px;object-fit:cover;border-radius:4px;">';}).join('')+'</div>':'<p style="color:#A09A8E;font-style:italic;margin-top:40px;">No photos uploaded.</p>';
  var agentCardsHTML=agentProfiles.length?agentProfiles.map(function(a){return'<div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:28px;">'+(a.headshot?'<img src="'+a.headshot+'" style="width:90px;height:118px;object-fit:cover;border-radius:4px;flex-shrink:0;">':'<div style="width:90px;height:118px;background:#3A4D56;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px;">&#128100;</div>')+'<div style="flex:1;"><div style="font-family:\'Playfair Display\',serif;font-size:18px;color:#2B3A42;margin-bottom:2px;">'+(a.name||'')+'</div><div style="font-size:10px;color:#6B6458;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">'+(a.title||'')+'</div>'+(a.bio?'<p style="font-size:11.5px;color:#2C2C2C;line-height:1.7;margin-bottom:8px;">'+a.bio+'</p>':'')+'<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:10.5px;color:#6B6458;">'+(a.phone?'<span>&#128222; '+a.phone+'</span>':'')+(a.email?'<span>&#9993; '+a.email+'</span>':'')+(a.license?'<span>DRE '+a.license+'</span>':'')+'</div></div></div>';}).join(''):'<p style="color:#A09A8E;font-style:italic;">No agent profiles saved.</p>';
  var svcTags=[gwData.svc1,gwData.svc2,gwData.svc3,gwData.svc4,gwData.svc5].filter(Boolean).map(function(s){return'<span style="font-size:11px;background:rgba(43,58,66,0.08);border:1px solid #C4BFB5;border-radius:4px;padding:4px 10px;color:#2B3A42;">'+s+'</span>';}).join('');
  var now=new Date(),prepared=now.toLocaleDateString('en-US',{month:'long',year:'numeric'}),yr=now.getFullYear();
  function pill(l,v2){return'<div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:10px 14px;margin-bottom:9px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#A09A8E;margin-bottom:3px;">'+l+'</div><div style="font-size:19px;font-weight:700;font-family:\'Playfair Display\',serif;color:#E8E0D0;">'+v2+'</div></div>';}
  function stat(l,v2){return v2?'<div style="margin-bottom:14px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#A09A8E;margin-bottom:3px;">'+l+'</div><div style="font-size:15px;font-weight:600;color:#E8E0D0;">'+v2+'</div></div>':'';}
  function LP(title,extras,pgLabel,pgNum){return'<div style="width:38%;height:100%;background:#2B3A42;padding:44px 34px;display:flex;flex-direction:column;color:#E8E0D0;position:relative;flex-shrink:0;"><div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8A84B;margin-bottom:28px;">GATEWAY<br>REAL ESTATE ADVISORS</div><div style="font-family:\'Playfair Display\',serif;font-size:26px;color:#E8E0D0;line-height:1.2;margin-bottom:0;">'+title+'</div><div style="height:1px;background:rgba(196,191,181,0.25);margin:16px 0 20px;"></div>'+(extras||'')+'<div style="position:absolute;bottom:22px;left:34px;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#6B6458;">'+pgLabel+'</div><div style="position:absolute;bottom:22px;right:34px;font-size:9px;color:#6B6458;">'+pgNum+'</div></div>';}
  var css='*{box-sizing:border-box;margin:0;padding:0;}@page{size:11in 8.5in landscape;margin:0;}body{font-family:Inter,sans-serif;background:#E8E0D0;color:#2C2C2C;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{width:11in;height:8.5in;display:flex;overflow:hidden;page-break-after:always;}.page:last-child{page-break-after:avoid;}.no-print{position:fixed;top:0;left:0;right:0;background:#2B3A42;color:#E8E0D0;padding:9px 24px;display:flex;align-items:center;gap:16px;z-index:9999;font-size:13px;font-family:Inter,sans-serif;}.no-print button{background:#C8A84B;color:#1a1a1a;border:none;padding:6px 18px;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px;}@media print{.no-print{display:none!important;}}.rp{flex:1;height:100%;background:#E8E0D0;padding:44px 38px;display:flex;flex-direction:column;overflow:hidden;}.rule{height:1px;background:#C4BFB5;margin:12px 0;}.sec-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6B6458;margin-bottom:6px;}.prop-tag{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;background:rgba(200,168,75,0.18);color:#C8A84B;border:1px solid rgba(200,168,75,0.4);padding:3px 10px;border-radius:3px;margin-bottom:14px;}table{width:100%;border-collapse:collapse;font-size:11px;}th{font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:7px 10px;border-bottom:2px solid #C4BFB5;color:#6B6458;text-align:left;}td{padding:7px 10px;border-bottom:1px solid #C4BFB5;color:#2C2C2C;}tr:nth-child(even) td{background:rgba(196,191,181,0.22);}td.num{text-align:right;}.tr-total td{font-weight:700;border-top:2px solid #2B3A42;color:#2B3A42;background:rgba(43,58,66,0.06)!important;}.tr-head td{font-weight:700;font-size:10px;text-transform:uppercase;color:#2B3A42;background:rgba(43,58,66,0.06)!important;border-bottom:1px solid #C4BFB5;}';
  var html='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>'+propName1+(propName2?' '+propName2:'')+' — Offering Memorandum</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>'+css+'</style></head><body>'
  +'<div class="no-print"><strong style="font-family:\'Playfair Display\',serif;font-size:14px;">Gateway Signature OM</strong> <span style="color:#A09A8E;">'+propName1+(propName2?' '+propName2:'')+(address?' · '+address:'')+'</span><button onclick="window.print()">&#128424; Print / Save as PDF</button><span style="color:#A09A8E;font-size:11px;">Chrome: File → Print → Save as PDF · Layout: Landscape</span></div>'
  +'<div class="page" style="display:block;position:relative;"><div style="position:absolute;top:0;left:0;width:40%;height:100%;background:#2B3A42;z-index:2;display:flex;flex-direction:column;padding:50px 38px;"><div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8A84B;margin-bottom:auto;">GATEWAY<br>REAL ESTATE ADVISORS</div><div>'+(propType?'<div class="prop-tag">'+propType+'</div>':'')+'<div style="font-family:\'Playfair Display\',serif;font-size:36px;font-weight:700;color:#E8E0D0;line-height:1.1;margin-bottom:6px;">'+propName1+'</div>'+(propName2?'<div style="font-family:\'Playfair Display\',serif;font-size:26px;font-weight:400;color:#A09A8E;margin-bottom:14px;">'+propName2+'</div>':'')+'<div style="height:1px;background:rgba(196,191,181,0.3);margin:14px 0;"></div><div style="font-size:12px;color:#A09A8E;line-height:1.6;margin-bottom:24px;">'+address+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:28px;">'+pill('Asking Price',fmtK(askingPrice))+pill('Cap Rate',(capRate||'—')+(capRate&&capRate.indexOf('%')===-1?'%':''))+pill('Total Units',totalUnits||'—')+pill('Price / Unit',fmtK(pricePerUnit))+'</div></div><div style="font-size:9px;color:#6B6458;text-transform:uppercase;letter-spacing:1.5px;">'+prepared+' · Confidential Offering</div></div>'+(coverPhoto?'<img src="'+coverPhoto+'" style="position:absolute;top:0;right:0;width:61%;height:100%;object-fit:cover;z-index:1;">':'<div style="position:absolute;top:0;right:0;width:61%;height:100%;background:linear-gradient(135deg,#3A4D56,#2B3A42);z-index:1;"></div>')+'<div style="position:absolute;top:0;right:0;width:61%;height:100%;background:linear-gradient(to right,#2B3A42 0%,transparent 20%);z-index:2;pointer-events:none;"></div></div>'
  +'<div class="page">'+LP('Executive<br>Summary',(callout?'<div style="font-family:\'Playfair Display\',serif;font-size:14px;color:#C8A84B;line-height:1.6;font-style:italic;margin-bottom:16px;">"'+callout+'"</div>':'')+'<div style="margin-top:auto;">'+pill('NOI',fmtK(noi))+pill('GRM',grm||'—')+pill('Occupancy',occupancy||'—')+'</div>','Executive Summary','02')+'<div class="rp"><div class="sec-label">Investment Overview</div><div style="font-family:\'Playfair Display\',serif;font-size:20px;color:#2B3A42;margin-bottom:12px;">'+propName1+(propName2?' '+propName2:'')+'</div><div class="rule"></div><p style="font-size:12px;line-height:1.8;color:#2C2C2C;margin-top:10px;margin-bottom:20px;">'+(execDesc||'No executive description provided.')+'</p>'+(hlHTML?'<div class="sec-label" style="margin-bottom:10px;">Investment Highlights</div>'+hlHTML:'')+'</div></div>'
  +'<div class="page">'+LP('Property<br>Overview',stat('Year Built',yearBuilt)+stat('Total Units',totalUnits||'')+stat('Property Type',propType)+stat('Buildings',buildings)+stat('Lot Size',lotSize)+stat('Parking',parking)+stat('Occupancy',occupancy),'Property Overview','03')+'<div class="rp"><div class="sec-label">Property Description</div><div style="font-family:\'Playfair Display\',serif;font-size:18px;color:#2B3A42;margin-bottom:12px;">'+address+'</div><div class="rule"></div><p style="font-size:12px;line-height:1.8;color:#2C2C2C;margin-top:10px;margin-bottom:18px;">'+(propDesc||'No property description provided.')+'</p>'+(features?'<div class="sec-label" style="margin-bottom:6px;">Features &amp; Amenities</div><p style="font-size:11.5px;line-height:1.8;color:#6B6458;">'+features+'</p>':'')+'</div></div>'
  +'<div class="page">'+LP('Unit Mix &amp;<br>Rent Roll','<div style="margin-top:auto;">'+pill('Total Units',totalUnits||totalUnitsCalc||'—')+pill('Monthly Rent',fmtK(totalRentCalc))+pill('Annual Rent',fmtK(annualRent))+'</div>','Unit Mix','04')+'<div class="rp"><div class="sec-label">Unit Mix Summary</div><div class="rule"></div><table style="margin-top:8px;"><thead><tr><th>Unit Type</th><th>Units</th><th>Avg SF</th><th>Market Rent</th><th class="num">Monthly Total</th></tr></thead><tbody>'+(unitMixRows||'<tr><td colspan="5" style="color:#A09A8E;font-style:italic;">No unit data entered.</td></tr>')+'</tbody><tfoot><tr class="tr-total"><td>Total</td><td>'+(totalUnits||totalUnitsCalc)+'</td><td>—</td><td>—</td><td class="num">'+fmt(totalRentCalc)+'/mo</td></tr></tfoot></table></div></div>'
  +'<div class="page">'+LP('Financial<br>Summary','<div style="margin-top:auto;">'+pill('Gross Income (Cur)',fmtK(curIncome))+pill('Gross Income (PF)',fmtK(pfIncome))+pill('NOI',fmtK(noi))+pill('Cap Rate',(capRate||'—')+(capRate&&capRate.indexOf('%')===-1?'%':''))+'</div>','Financial Summary','05')+'<div class="rp"><div class="sec-label">Income &amp; Expense Statement</div><div class="rule"></div><table style="margin-top:8px;"><thead><tr><th>Line Item</th><th class="num">Current</th><th class="num">Pro Forma</th></tr></thead><tbody><tr class="tr-head"><td colspan="3">Income</td></tr><tr><td>Gross Scheduled Rent</td><td class="num">'+fmt(curIncome)+'</td><td class="num">'+fmt(pfIncome)+'</td></tr>'+(curOtherRows||'')+'<tr class="tr-total"><td>Effective Gross Income</td><td class="num">'+fmt(curIncome)+'</td><td class="num">'+fmt(pfIncome)+'</td></tr><tr class="tr-head"><td colspan="3">Expenses</td></tr>'+(curExpRows||'<tr><td colspan="3" style="color:#A09A8E;font-style:italic;">No expense data.</td></tr>')+'<tr class="tr-total"><td>Total Expenses</td><td class="num">'+fmt(curExpTotal)+'</td><td class="num">'+fmt(curExpTotal)+'</td></tr><tr class="tr-total" style="background:rgba(43,58,66,0.1)!important;"><td>Net Operating Income</td><td class="num" style="color:#2B3A42;">'+fmt(noi)+'</td><td class="num" style="color:#2B3A42;">'+fmt(noi)+'</td></tr></tbody></table></div></div>'
  +'<div class="page">'+LP('Market<br>Overview',(mktCity?'<div style="font-size:13px;color:#C8A84B;font-weight:600;margin-bottom:14px;">'+mktCity+'</div>':'')+stat('Population',population)+stat('Median HH Income',medIncome)+stat('Unemployment',unemployment)+stat('Avg Market Rent',avgRent),'Market Overview','06')+'<div class="rp"><div class="sec-label">Market Analysis</div><div class="rule"></div><p style="font-size:12px;line-height:1.8;color:#2C2C2C;margin-top:12px;">'+(mktDesc||'No market description provided.')+'</p></div></div>'
  +'<div class="page"><div style="width:30%;height:100%;background:#2B3A42;padding:44px 34px;display:flex;flex-direction:column;flex-shrink:0;position:relative;"><div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8A84B;margin-bottom:28px;">GATEWAY<br>REAL ESTATE ADVISORS</div><div style="font-family:\'Playfair Display\',serif;font-size:26px;color:#E8E0D0;line-height:1.2;">Property<br>Photos</div><div style="height:1px;background:rgba(196,191,181,0.25);margin:16px 0;"></div><div style="font-size:11px;color:#A09A8E;line-height:1.7;">'+address+'</div><div style="position:absolute;bottom:22px;right:34px;font-size:9px;color:#6B6458;">07</div></div><div class="rp" style="padding:24px 26px;">'+photoGallery+'</div></div>'
  +'<div class="page">'+LP('About the<br>Agents','<div style="margin-top:auto;font-size:10.5px;color:#A09A8E;line-height:1.7;">Contact the listing agent(s) for information on this offering.</div>','Listing Agents','08')+'<div class="rp" style="overflow:auto;">'+agentCardsHTML+'</div></div>'
  +'<div class="page">'+LP('About<br>Gateway','<div style="margin-top:auto;">'+(gwData.stat1val?pill(gwData.stat1lbl||'Transactions',gwData.stat1val):'')+(gwData.stat2val?pill(gwData.stat2lbl||'Volume',gwData.stat2val):'')+(gwData.stat3val?pill(gwData.stat3lbl||'Years',gwData.stat3val):'')+'</div>','About Gateway','09')+'<div class="rp"><div class="sec-label">Who We Are</div><div class="rule"></div><p style="font-size:12px;line-height:1.8;color:#2C2C2C;margin-top:12px;">'+(gwData.para1||'Gateway Real Estate Advisors is a premier commercial real estate brokerage specializing in multifamily investment properties.')+'</p>'+(gwData.para2?'<p style="font-size:12px;line-height:1.8;color:#2C2C2C;margin-top:14px;">'+gwData.para2+'</p>':'')+(svcTags?'<div class="sec-label" style="margin-top:20px;margin-bottom:10px;">Our Services</div><div style="display:flex;flex-wrap:wrap;gap:8px;">'+svcTags+'</div>':'')+'</div></div>'
  +'<div class="page"><div style="width:38%;height:100%;background:#2B3A42;padding:44px 34px;display:flex;flex-direction:column;justify-content:space-between;flex-shrink:0;position:relative;"><div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8A84B;">GATEWAY<br>REAL ESTATE ADVISORS</div><div><div style="font-family:\'Playfair Display\',serif;font-size:30px;color:#E8E0D0;line-height:1.15;margin-bottom:20px;">Confidential<br>Offering</div><div style="height:1px;background:rgba(196,191,181,0.25);margin-bottom:16px;"></div><div style="font-size:11px;color:#A09A8E;line-height:1.7;">'+address+'</div></div><div style="font-size:9px;color:#6B6458;">'+prepared+'</div><div style="position:absolute;bottom:22px;right:34px;font-size:9px;color:#6B6458;">10</div></div><div class="rp" style="justify-content:center;"><div class="sec-label" style="margin-bottom:14px;">Confidentiality &amp; Disclaimer</div><div class="rule"></div><p style="font-size:10.5px;line-height:1.9;color:#6B6458;margin-top:14px;">This Offering Memorandum has been prepared by Gateway Real Estate Advisors for use by a limited number of qualified parties. The information contained herein has been obtained from sources believed reliable; however, Gateway Real Estate Advisors makes no representation, warranty, or guarantee as to the accuracy or completeness of any information contained herein.</p><p style="font-size:10.5px;line-height:1.9;color:#6B6458;margin-top:12px;">Prospective purchasers shall be responsible for their costs and expenses of investigating the subject property. This Offering Memorandum is subject to prior placement, errors, omissions, and withdrawal without notice.</p><p style="font-size:10.5px;line-height:1.9;color:#6B6458;margin-top:12px;">This is not an offer to sell securities. Pro forma projections are not guaranteed.</p><div style="margin-top:28px;padding-top:14px;border-top:1px solid #C4BFB5;font-size:10px;color:#A09A8E;">&copy; '+yr+' Gateway Real Estate Advisors &middot; All Rights Reserved</div></div></div>'
  +'</body></html>';
  var win=window.open('','_blank');
  if(!win){alert('Please allow pop-ups to view the Offering Memorandum.');return;}
  win.document.write(html);win.document.close();
}

// ==== GENERATE PPTX ====
function generateOM() {
  try {
    var v = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var n = function(id) { var el = document.getElementById(id); return el ? (+el.value || 0) : 0; };
    var fmt = function(num) { return '$' + num.toLocaleString(); };
    var sp = function(t) { return t.toUpperCase().split('').join(' '); };
    var spw = function(t) { return t.toUpperCase().split('').join(' ').replace(/ {3}/g, '     '); };
    var fmtK = function(num) {
      if (Math.abs(num) >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M';
      if (Math.abs(num) >= 1000) return '$' + Math.round(num/1000) + 'K';
      return '$' + num.toLocaleString();
    };

    // ── Brand Guidelines Color Palette ──
    var DK  = '282828';  // Primary dark
    var NV  = '1E2F39';  // Navy
    var AC  = 'A2B6C0';  // Blue-gray accent
    var GR  = '969694';  // Gray
    var CR  = 'E4E3D4';  // Cream
    var WH  = 'FFFFFF';  // White
    var HD  = '282828';  // Heading text (on light bg)
    var BD  = '4A4A4A';  // Body text
    var LT  = 'FFFFFF';  // Light slide background

    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'OM', width: 10, height: 5.625 });
    pptx.layout = 'OM';
    pptx.author = 'Gateway Real Estate Advisors';
    pptx.company = 'Gateway Real Estate Advisors';
    pptx.subject = (v('propName1') + ' ' + v('propName2')).trim() + ' - Offering Memorandum';

    // ── Helper: Footer with logo on every slide ──
    function addFooter(slide, pageNum, isDark) {
      var lineC = isDark ? NV : CR;
      slide.addShape('rect', {x:0.6, y:5.1, w:8.8, h:0.004, fill:{color:lineC}});
      slide.addText(sp('GATEWAY REAL ESTATE ADVISORS'), {x:0.15, y:5.15, w:5.5, h:0.3, fontSize:6, fontFace:'Arial', color:GR, align:'left'});
      slide.addText('CONFIDENTIAL', {x:5.5, y:5.15, w:1.5, h:0.3, fontSize:6, fontFace:'Arial', color:AC, align:'center'});
      slide.addText(pageNum, {x:7.0, y:5.15, w:0.5, h:0.3, fontSize:6, fontFace:'Arial', color:GR, align:'right'});
      // Logo bottom-right on every slide
      var logoData = isDark ? LOGO_PRIMARY_LIGHT : LOGO_PRIMARY_DARK;
      if (logoData) {
        slide.addImage({data:logoData, x:8.5, y:5.15, w:1.1, h:0.25});
      }
    }

    // ── Helper: Dark stat box (large, with subtitle) ──
    function addStatBox(slide, x, y, w, h, value, label, sub) {
      slide.addShape('rect', {x:x, y:y, w:w, h:h, fill:{color:NV}});
      slide.addText(value, {x:x, y:y+0.02, w:w, h:h*0.5, align:'center', fontSize:22, fontFace:'Georgia', color:WH, bold:true});
      slide.addText(label, {x:x, y:y+h*0.52, w:w, h:h*0.22, align:'center', fontSize:6.5, fontFace:'Arial', color:AC});
      if (sub) {
        slide.addText(sub, {x:x, y:y+h*0.72, w:w, h:h*0.22, align:'center', fontSize:7, fontFace:'Arial', color:GR});
      }
    }

    // ── Helper: Compact stat box (no subtitle, spaced label) ──
    function addStatBoxCompact(slide, x, y, w, h, value, label) {
      slide.addShape('rect', {x:x, y:y, w:w, h:h, fill:{color:NV}});
      slide.addText(value, {x:x, y:y+0.02, w:w, h:h*0.55, align:'center', fontSize:20, fontFace:'Georgia', color:WH, bold:true});
      slide.addText(spw(label), {x:x, y:y+h*0.58, w:w, h:h*0.35, align:'center', fontSize:5.5, fontFace:'Arial', color:AC});
    }

    // ── Helper: Data row ──
    function addDataRow(slide, x, y, w, h, label, value, isAlt, isBold, fs) {
      var bg = isBold ? null : (isAlt ? CR : WH);
      if (bg) slide.addShape('rect', {x:x, y:y, w:w, h:h, fill:{color:bg}});
      var lc = isBold ? HD : BD;
      slide.addText(label, {x:x+0.1, y:y, w:w*0.6, h:h, fontSize:(fs||8), fontFace:'Arial', color:lc, bold:!!isBold, align:'left', valign:'middle'});
      slide.addText(value, {x:x+w*0.5, y:y, w:w*0.45, h:h, fontSize:(fs||8), fontFace:'Arial', color:HD, bold:true, align:'right', valign:'middle'});
    }

    var stateFips = document.getElementById('mktState') ? document.getElementById('mktState').value : '';
    var stateName = typeof STATE_NAMES !== 'undefined' ? (STATE_NAMES[stateFips] || '') : '';

    // ════════════════════════════════════════════════
    // SLIDE 1: COVER
    // ════════════════════════════════════════════════
    var s1 = pptx.addSlide();
    s1.background = {color:DK};

    // Top bar
    s1.addShape('rect', {x:0, y:0, w:10, h:0.45, fill:{color:NV}});
    s1.addText(sp('GATEWAY REAL ESTATE ADVISORS'), {x:0, y:0, w:10, h:0.45, align:'center', fontSize:8, fontFace:'Arial', color:CR});

    // Sub bar - accent
    s1.addText(spw('OFFERING MEMORANDUM'), {x:0, y:0.45, w:10, h:0.30, align:'center', fontSize:7, fontFace:'Arial', color:AC});

    // Hero photo (left)
    if (photos[0]) {
      s1.addImage({data:photos[0], x:0.6, y:1.0, w:4.3, h:3.2, sizing:{type:'cover', w:4.3, h:3.2}});
      s1.addShape('rect', {x:0.6, y:1.0, w:4.3, h:3.2, fill:{type:'none'}, line:{color:AC, width:1}});
    } else {
      s1.addShape('rect', {x:0.6, y:1.0, w:4.3, h:3.2, fill:{color:NV}, line:{color:AC, width:1}});
      s1.addText(sp('PROPERTY HERO') + '\n' + sp('PHOTOGRAPHY'), {x:0.6, y:1.0, w:4.3, h:3.2, align:'center', valign:'middle', fontSize:11, fontFace:'Arial', color:GR});
    }

    // Property name & address (right)
    s1.addText(v('propName1').toUpperCase(), {x:5.3, y:1.0, w:4.3, h:0.7, fontSize:36, fontFace:'Georgia', color:WH, bold:true, align:'left', shrinkText:true});
    s1.addText(v('propName2').toUpperCase(), {x:5.3, y:1.65, w:4.3, h:0.55, fontSize:28, fontFace:'Georgia', color:AC, bold:true, align:'left', shrinkText:true});
    s1.addText(v('address').toUpperCase(), {x:5.3, y:2.25, w:4.3, h:0.3, fontSize:9, fontFace:'Arial', color:GR, align:'left'});

    // Metric boxes (2x2 grid)
    var mboxes = [
      {x:5.3, y:2.85, l:'ASKING PRICE', val:fmtK(n('askingPrice'))},
      {x:7.45, y:2.85, l:'TOTAL UNITS', val:''+n('totalUnits')},
      {x:5.3, y:3.7, l:'CAP RATE', val:n('capRate').toFixed(1)+'%'},
      {x:7.45, y:3.7, l:'PER UNIT', val:fmtK(n('pricePerUnit'))}
    ];
    mboxes.forEach(function(b) {
      s1.addShape('rect', {x:b.x, y:b.y, w:2.0, h:0.7, fill:{color:NV}, line:{color:AC, width:0.5}});
      s1.addText(b.val, {x:b.x, y:b.y+0.05, w:2.0, h:0.35, align:'center', fontSize:20, fontFace:'Georgia', color:WH, bold:true});
      s1.addText(sp(b.l), {x:b.x, y:b.y+0.42, w:2.0, h:0.25, align:'center', fontSize:5.5, fontFace:'Arial', color:AC});
    });

    // Cover footer
    s1.addShape('rect', {x:0.6, y:4.92, w:8.8, h:0.004, fill:{color:NV}});
    s1.addText('Exclusively Offered By Gateway Real Estate Advisors', {x:0, y:4.95, w:7.5, h:0.35, fontSize:7, fontFace:'Arial', color:GR, italic:true, align:'left'});
    s1.addText(sp('CONFIDENTIAL'), {x:7.5, y:4.95, w:2.5, h:0.35, fontSize:7, fontFace:'Arial', color:AC, align:'right'});

    // ════════════════════════════════════════════════
    // SLIDE 2: TABLE OF CONTENTS
    // ════════════════════════════════════════════════
    var s2 = pptx.addSlide();
    s2.background = {color:DK};

    s2.addText(sp('NAVIGATION'), {x:0.6, y:0.4, w:4, h:0.3, fontSize:8, fontFace:'Arial', color:AC});
    s2.addText('TABLE OF\nCONTENTS', {x:0.6, y:0.75, w:4, h:1.2, fontSize:36, fontFace:'Georgia', color:WH, bold:true, lineSpacingMultiple:0.9});

    var tocItems = [
      {num:'01', title:'EXECUTIVE SUMMARY', desc:'Investment thesis, key metrics, and opportunity overview', pg:'03'},
      {num:'02', title:'PROPERTY OVERVIEW', desc:'Building details, unit mix, features, and specifications', pg:'04'},
      {num:'03', title:'FINANCIAL ANALYSIS', desc:'Current income, pro forma projections, and key assumptions', pg:'05'},
      {num:'04', title:'MARKET OVERVIEW', desc:'Demographics, economic drivers, and market trends', pg:'06'},
      {num:'05', title:'PHOTO GALLERY', desc:'Property photography and visual documentation', pg:'07'},
      {num:'06', title:'CONTACT & DISCLAIMER', desc:'Agent information and confidentiality notice', pg:'08'}
    ];
    tocItems.forEach(function(item, i) {
      var y = 2.15 + i * 0.5;
      s2.addText(item.num, {x:0.6, y:y, w:0.5, h:0.4, fontSize:14, fontFace:'Georgia', color:AC, bold:true, align:'left'});
      s2.addText(item.title, {x:1.2, y:y, w:5.5, h:0.2, fontSize:11, fontFace:'Arial', color:WH, bold:true, align:'left'});
      s2.addText(item.desc, {x:1.2, y:y+0.2, w:5.5, h:0.2, fontSize:8, fontFace:'Arial', color:GR, align:'left'});
      s2.addText(item.pg, {x:8.6, y:y, w:0.8, h:0.4, fontSize:14, fontFace:'Georgia', color:GR, align:'right'});
    });

    addFooter(s2, '02', true);

    // ════════════════════════════════════════════════
    // SLIDE 3: EXECUTIVE SUMMARY (light background)
    // ════════════════════════════════════════════════
    var s3 = pptx.addSlide();
    s3.background = {color:LT};

    s3.addText('01  EXECUTIVE SUMMARY', {x:0.6, y:0.35, w:9, h:0.35, fontSize:14, fontFace:'Georgia', color:HD, bold:true});
    s3.addText(v('execDesc'), {x:0.6, y:0.8, w:8.8, h:0.7, fontSize:9, fontFace:'Arial', color:BD, lineSpacingMultiple:1.4});

    // Callout bar
    s3.addShape('rect', {x:0.6, y:1.6, w:8.8, h:0.5, fill:{color:DK}});
    s3.addText(v('callout'), {x:0.85, y:1.6, w:8.35, h:0.5, fontSize:8.5, fontFace:'Arial', color:AC, italic:true, valign:'middle'});

    // INVESTMENT SUMMARY (left)
    s3.addText('INVESTMENT SUMMARY', {x:0.6, y:2.3, w:4.1, h:0.3, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var invRows = [
      ['Asking Price', fmt(n('askingPrice'))],
      ['Price Per Unit', fmt(n('pricePerUnit'))],
      ['Cap Rate', n('capRate').toFixed(2) + '%'],
      ['Current NOI', fmt(n('noi'))],
      ['GRM', n('grm') + 'x']
    ];
    invRows.forEach(function(row, i) {
      addDataRow(s3, 0.6, 2.65 + i * 0.3, 4.1, 0.3, row[0], row[1], i % 2 !== 0, false);
    });

    // PROPERTY SNAPSHOT (right)
    s3.addText('PROPERTY SNAPSHOT', {x:5.3, y:2.3, w:4.1, h:0.3, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var snapRows = [
      ['Total Units', '' + n('totalUnits')],
      ['Occupancy', v('occupancy')],
      ['Building Type', v('propType')],
      ['Year Built', v('yearBuilt')],
      ['Lot Size', v('lotSize')]
    ];
    snapRows.forEach(function(row, i) {
      addDataRow(s3, 5.3, 2.65 + i * 0.3, 4.1, 0.3, row[0], row[1], i % 2 !== 0, false);
    });

    // INVESTMENT HIGHLIGHTS
    s3.addText('INVESTMENT HIGHLIGHTS', {x:0.6, y:4.15, w:9, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var highlights = [v('hl1'), v('hl2'), v('hl3'), v('hl4')];
    highlights.forEach(function(h, i) {
      if (!h) return;
      var col = i < 2 ? 0.6 : 5.25;
      var row = i % 2;
      var hy = 4.42 + row * 0.32;
      var titleEnd = h.indexOf(' - ') !== -1 ? h.indexOf(' - ') : (h.length > 35 ? 35 : h.length);
      var hlTitle = h.substring(0, titleEnd).toUpperCase();
      var hlDesc = h.substring(titleEnd).replace(/^ - /, '');
      s3.addText(hlTitle, {x:col, y:hy, w:4.3, h:0.15, fontSize:7.5, fontFace:'Arial', color:AC, bold:true});
      if (hlDesc) s3.addText(hlDesc, {x:col, y:hy+0.15, w:4.3, h:0.17, fontSize:7, fontFace:'Arial', color:BD});
    });

    addFooter(s3, '03', false);

    // ════════════════════════════════════════════════
    // SLIDE 4: PROPERTY OVERVIEW (light background)
    // ════════════════════════════════════════════════
    var s4 = pptx.addSlide();
    s4.background = {color:LT};

    s4.addText('02  PROPERTY OVERVIEW', {x:0.6, y:0.35, w:9, h:0.35, fontSize:14, fontFace:'Georgia', color:HD, bold:true});

    var totalSqFt = unitData.reduce(function(s,u){ return s + u.units * u.sqft; }, 0);
    var propBoxes = [
      {val:'' + n('totalUnits'), label:'TOTAL UNITS', sub:(unitData.length > 0 ? unitData.map(function(u){return u.type}).filter(function(t){return t}).join(' & ') : '') || 'Mix'},
      {val:showSqFt && totalSqFt > 0 ? totalSqFt.toLocaleString() : '--', label:'TOTAL SQ FT', sub:showSqFt ? ('Avg ' + (n('totalUnits') > 0 ? Math.round(totalSqFt / n('totalUnits')).toLocaleString() : '--') + ' SF') : 'N/A'},
      {val:v('lotSize') || '--', label:'LOT SIZE', sub:'Approx'},
      {val:v('occupancy') || '100%', label:'OCCUPANCY', sub:n('totalUnits') + ' of ' + n('totalUnits') + ' Occupied'}
    ];
    propBoxes.forEach(function(b, i) {
      var bx = 0.6 + i * 2.3;
      addStatBox(s4, bx, 0.85, 2.05, 0.9, b.val, b.label, b.sub);
    });

    s4.addText(v('propDesc'), {x:0.6, y:2.0, w:8.8, h:0.65, fontSize:9, fontFace:'Arial', color:BD, lineSpacingMultiple:1.3});

    // Unit mix table - respects sqft toggle
    s4.addText('UNIT MIX & RENT SCHEDULE', {x:0.6, y:2.8, w:9, h:0.3, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var totalAllRent = unitData.reduce(function(s,r){ return s + r.units * r.rent; }, 0);
    var hasSqFt = showSqFt;
    var headerCols = hasSqFt
      ? ['Unit Type', 'Units', 'Sq Ft', 'Rent/Mo', '$/SqFt', 'Total Rent', '% Total']
      : ['Unit Type', 'Units', 'Rent/Mo', 'Total Rent', '% Total'];
    var colWidths = hasSqFt
      ? [1.4, 0.7, 0.9, 1.0, 0.9, 1.2, 0.8]
      : [2.2, 1.2, 1.6, 2.0, 1.2];
    var tblHeader = [headerCols.map(function(h) {
      return {text:h, options:{fontSize:8, fontFace:'Arial', color:WH, bold:true, fill:{color:NV}, align:'center', valign:'middle'}};
    })];
    var tblRows = unitData.filter(function(u){ return u.type || u.units > 0; }).map(function(u, i) {
      var rpsf = u.sqft > 0 ? (u.rent / u.sqft).toFixed(2) : '0.00';
      var tr = u.units * u.rent;
      var pct = totalAllRent > 0 ? ((tr / totalAllRent) * 100).toFixed(0) : '0';
      var bg = i % 2 === 0 ? WH : CR;
      var cells = hasSqFt
        ? [u.type, ''+u.units, u.sqft.toLocaleString(), '$'+u.rent, '$'+rpsf, '$'+tr.toLocaleString(), pct+'%']
        : [u.type, ''+u.units, '$'+u.rent, '$'+tr.toLocaleString(), pct+'%'];
      return cells.map(function(c) {
        return {text:c, options:{fontSize:8, fontFace:'Arial', color:BD, fill:{color:bg}, align:'center', valign:'middle'}};
      });
    });
    if (tblRows.length > 0) {
      s4.addTable(tblHeader.concat(tblRows), {x:0.6, y:3.15, w:8.8, colW:colWidths, rowH:0.28, border:{color:CR, pt:0.5}});
    }

    var feats = v('features');
    if (feats) {
      s4.addText('PROPERTY FEATURES', {x:0.6, y:4.55, w:9, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});
      var featFormatted = feats.split(',').map(function(f){ return f.trim().toUpperCase(); }).join('    \u00B7    ');
      s4.addText(featFormatted, {x:0.6, y:4.82, w:8.8, h:0.2, fontSize:8, fontFace:'Arial', color:BD, align:'center'});
    }

    addFooter(s4, '04', false);

    // ════════════════════════════════════════════════
    // SLIDE 5: FINANCIAL ANALYSIS (light background)
    // ════════════════════════════════════════════════
    var s5 = pptx.addSlide();
    s5.background = {color:LT};

    s5.addText('03  FINANCIAL ANALYSIS', {x:0.6, y:0.35, w:9, h:0.35, fontSize:14, fontFace:'Georgia', color:HD, bold:true});

    // 4 compact stat boxes
    var curEGI = n('curIncome');
    var pfEGI = n('pfIncome');
    var curTotExp = curExpenses.reduce(function(s,e){ return s + e.amount; }, 0);
    var pfTotExp = pfExpenses.reduce(function(s,e){ return s + e.amount; }, 0);
    var curNOI = curEGI - curTotExp;
    var pfNOI = pfEGI - pfTotExp;

    var finBoxes = [
      {val:fmtK(curEGI), label:'CURRENT INCOME'},
      {val:fmtK(curNOI), label:'CURRENT NOI'},
      {val:fmtK(pfEGI), label:'PRO FORMA INCOME'},
      {val:fmtK(pfNOI), label:'PRO FORMA NOI'}
    ];
    finBoxes.forEach(function(b, i) {
      addStatBoxCompact(s5, 0.6 + i * 2.3, 0.85, 2.05, 0.75, b.val, b.label);
    });

    // Dynamic row sizing — scales to fit many expenses
    var curOI = curOtherIncome.filter(function(x){ return x.name && x.amount; });
    var pfOI = pfOtherIncome.filter(function(x){ return x.name && x.amount; });
    var curExp = curExpenses.filter(function(x){ return x.name && x.amount; });
    var pfExp = pfExpenses.filter(function(x){ return x.name && x.amount; });
    var leftDataRows = 1 + curOI.length + curExp.length;
    var rightDataRows = 1 + pfOI.length + pfExp.length;
    var dataRowCount = Math.max(leftDataRows, rightDataRows);
    // Available: y=1.85 to y=5.05 = 3.2". Fixed overhead ~1.0" (headers/totals/gaps). Rest for data rows.
    var rowH = Math.min(0.22, Math.max(0.14, 2.2 / Math.max(dataRowCount, 1)));
    var totH = Math.min(0.24, rowH + 0.02);
    var fs = rowH >= 0.19 ? 8 : (rowH >= 0.16 ? 7 : 6.5);
    var secH = Math.min(0.20, rowH);

    // -- CURRENT OPERATIONS (left) --
    s5.addText('CURRENT OPERATIONS', {x:0.6, y:1.85, w:4.1, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var cy = 2.10;
    s5.addText('INCOME', {x:0.6, y:cy, w:4.1, h:secH, fontSize:fs, fontFace:'Arial', color:AC, bold:true}); cy += secH;
    var curGPI = n('curIncome');
    var curTotOI = curOtherIncome.reduce(function(s,e){ return s + e.amount; }, 0);
    addDataRow(s5, 0.6, cy, 4.1, rowH, 'Gross Rent Income', fmt(curGPI - curTotOI), true, false, fs); cy += rowH;
    curOI.forEach(function(item, i) {
      addDataRow(s5, 0.6, cy, 4.1, rowH, item.name, fmt(item.amount), (i+1)%2!==0, false, fs); cy += rowH;
    });
    addDataRow(s5, 0.6, cy, 4.1, totH, 'EFFECTIVE GROSS INCOME', fmt(curEGI), false, true, fs); cy += totH + 0.04;

    s5.addText('EXPENSES', {x:0.6, y:cy, w:4.1, h:secH, fontSize:fs, fontFace:'Arial', color:AC, bold:true}); cy += secH;
    curExp.forEach(function(exp, i) {
      addDataRow(s5, 0.6, cy, 4.1, rowH, exp.name, fmt(exp.amount), i%2!==0, false, fs); cy += rowH;
    });
    addDataRow(s5, 0.6, cy, 4.1, totH, 'TOTAL EXPENSES', fmt(curTotExp), false, true, fs); cy += totH + 0.04;
    addDataRow(s5, 0.6, cy, 4.1, totH, 'NET OPERATING INCOME', fmt(curNOI), false, true, fs);

    // -- PRO FORMA PROJECTIONS (right) --
    s5.addText('PRO FORMA PROJECTIONS', {x:5.3, y:1.85, w:4.1, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var py = 2.10;
    s5.addText('INCOME', {x:5.3, y:py, w:4.1, h:secH, fontSize:fs, fontFace:'Arial', color:AC, bold:true}); py += secH;
    var pfGPI = n('pfIncome');
    var pfTotOI = pfOtherIncome.reduce(function(s,e){ return s + e.amount; }, 0);
    addDataRow(s5, 5.3, py, 4.1, rowH, 'Gross Rent Income', fmt(pfGPI - pfTotOI), true, false, fs); py += rowH;
    pfOI.forEach(function(item, i) {
      addDataRow(s5, 5.3, py, 4.1, rowH, item.name, fmt(item.amount), (i+1)%2!==0, false, fs); py += rowH;
    });
    addDataRow(s5, 5.3, py, 4.1, totH, 'EFFECTIVE GROSS INCOME', fmt(pfEGI), false, true, fs); py += totH + 0.04;

    s5.addText('EXPENSES', {x:5.3, y:py, w:4.1, h:secH, fontSize:fs, fontFace:'Arial', color:AC, bold:true}); py += secH;
    pfExp.forEach(function(exp, i) {
      addDataRow(s5, 5.3, py, 4.1, rowH, exp.name, fmt(exp.amount), i%2!==0, false, fs); py += rowH;
    });
    addDataRow(s5, 5.3, py, 4.1, totH, 'TOTAL EXPENSES', fmt(pfTotExp), false, true, fs); py += totH + 0.04;
    addDataRow(s5, 5.3, py, 4.1, totH, 'NET OPERATING INCOME', fmt(pfNOI), false, true, fs);

    addFooter(s5, '05', false);

    // ════════════════════════════════════════════════
    // SLIDE 6: MARKET OVERVIEW (light background)
    // ════════════════════════════════════════════════
    var s6 = pptx.addSlide();
    s6.background = {color:LT};

    s6.addText('04  MARKET OVERVIEW', {x:0.6, y:0.35, w:9, h:0.35, fontSize:14, fontFace:'Georgia', color:HD, bold:true});
    s6.addText(v('mktDesc'), {x:0.6, y:0.75, w:8.8, h:0.55, fontSize:9, fontFace:'Arial', color:BD, lineSpacingMultiple:1.3});

    // 4 stat boxes
    var mktBoxes = [
      {val:v('population') || '--', label:'CITY POPULATION', sub:'Regional hub'},
      {val:v('unemployment') || '--', label:'UNEMPLOYMENT', sub:'Below national avg'},
      {val:v('medianIncome') || '--', label:'MEDIAN INCOME', sub:'Household'},
      {val:v('avgRent') || '--', label:'MEDIAN RENT', sub:'Gross rent'}
    ];
    mktBoxes.forEach(function(b, i) {
      var bx = 0.6 + i * 2.3;
      addStatBox(s6, bx, 1.55, 2.05, 0.9, b.val, sp(b.label), b.sub);
    });

    // DEMOGRAPHICS & ECONOMICS - two-column alternating rows
    s6.addText('DEMOGRAPHICS & ECONOMICS', {x:0.6, y:2.7, w:9, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});

    var demoLeft = [
      ['City Population', v('population') || '--'],
      ['County', v('mktCounty') || '--'],
      ['Median Household Income', v('medianIncome') || '--'],
      ['Median Age', v('medianAge') || '--'],
      ['Median Gross Rent', v('avgRent') || '--']
    ];
    var demoRight = [
      ['Total Households', v('households') || '--'],
      ['Owner Occupied', v('ownerOcc') || '--'],
      ['Renter Occupied', v('renterOcc') || '--'],
      ['Total Housing Units', v('housingUnits') || '--'],
      ['Avg Household Size', v('hhSize') || '--']
    ];

    demoLeft.forEach(function(row, i) {
      addDataRow(s6, 0.6, 2.95 + i * 0.24, 4.1, 0.24, row[0], row[1], i % 2 !== 0, false);
    });
    demoRight.forEach(function(row, i) {
      addDataRow(s6, 5.3, 2.95 + i * 0.24, 4.1, 0.24, row[0], row[1], i % 2 !== 0, false);
    });

    // MARKET DRIVERS - three columns
    s6.addText('MARKET DRIVERS', {x:0.6, y:4.2, w:9, h:0.25, fontSize:10, fontFace:'Arial', color:HD, bold:true});
    var drivers = [
      {title:v('drv1Title') || 'REGIONAL HUB', desc:v('drv1Desc') || v('mktCity') + ' serves as the commercial and healthcare center for the surrounding area.'},
      {title:v('drv2Title') || 'AFFORDABLE LIVING', desc:v('drv2Desc') || 'Low cost of living and affordable housing attract and retain working families.'},
      {title:v('drv3Title') || 'STABLE ECONOMY', desc:v('drv3Desc') || 'Diversified base of healthcare, manufacturing, and retail provides consistent employment.'}
    ];
    drivers.forEach(function(d, i) {
      var dx = 0.6 + i * 3.1;
      s6.addText(d.title.toUpperCase(), {x:dx, y:4.5, w:2.8, h:0.2, fontSize:8, fontFace:'Arial', color:AC, bold:true});
      s6.addText(d.desc, {x:dx, y:4.7, w:2.8, h:0.35, fontSize:7.5, fontFace:'Arial', color:BD, lineSpacingMultiple:1.2});
    });

    addFooter(s6, '06', false);

    // ════════════════════════════════════════════════
    // SLIDE 7: PHOTO GALLERY (dark background)
    // ════════════════════════════════════════════════
    var s7 = pptx.addSlide();
    s7.background = {color:DK};

    s7.addText('05  PHOTO GALLERY', {x:0.6, y:0.35, w:9, h:0.35, fontSize:14, fontFace:'Georgia', color:WH, bold:true});
    s7.addShape('rect', {x:0.6, y:0.75, w:1.5, h:0.004, fill:{color:AC}});

    // 6 equal photo slots in a 3x2 grid
    var gridCols = 3;
    var gridRows = 2;
    var gridGap = 0.12;
    var gridX = 0.6;
    var gridY = 0.95;
    var gridW = 8.8;
    var gridH = 3.95;
    var cellW = (gridW - (gridCols - 1) * gridGap) / gridCols;
    var cellH = (gridH - (gridRows - 1) * gridGap) / gridRows;

    for (var gi = 0; gi < gridCols * gridRows; gi++) {
      var col = gi % gridCols;
      var row = Math.floor(gi / gridCols);
      var cx = gridX + col * (cellW + gridGap);
      var cy2 = gridY + row * (cellH + gridGap);

      if (photos[gi]) {
        s7.addImage({data:photos[gi], x:cx, y:cy2, w:cellW, h:cellH, sizing:{type:'cover', w:cellW, h:cellH}});
      } else {
        s7.addShape('rect', {x:cx, y:cy2, w:cellW, h:cellH, fill:{color:NV}});
        s7.addText('PHOTO ' + (gi + 1), {x:cx, y:cy2, w:cellW, h:cellH, align:'center', valign:'middle', fontSize:10, fontFace:'Arial', color:GR});
      }
      // Subtle border
      s7.addShape('rect', {x:cx, y:cy2, w:cellW, h:cellH, fill:{type:'none'}, line:{color:NV, width:0.5}});
    }

    addFooter(s7, '07', true);

    // ════════════════════════════════════════════════
    // SLIDE 8: CONTACT (dark background, circle logo design)
    // ════════════════════════════════════════════════
    var s8 = pptx.addSlide();
    s8.background = {color:DK};

    // Round submark logo centered at top
    if (typeof LOGO_ROUND_SUBMARK !== 'undefined' && LOGO_ROUND_SUBMARK) {
      s8.addImage({data:LOGO_ROUND_SUBMARK, x:3.75, y:0.3, w:2.5, h:2.5, sizing:{type:'contain', w:2.5, h:2.5}});
    } else if (typeof LOGO_PRIMARY_LIGHT !== 'undefined' && LOGO_PRIMARY_LIGHT) {
      s8.addImage({data:LOGO_PRIMARY_LIGHT, x:2.0, y:0.55, w:6.0, h:2.0, sizing:{type:'contain', w:6.0, h:2.0}});
    }

    // "EXCLUSIVELY OFFERED BY"
    s8.addText(sp('EXCLUSIVELY OFFERED BY'), {x:0, y:2.9, w:10, h:0.25, align:'center', fontSize:9, fontFace:'Arial', color:AC, bold:true});

    // Agent cards — read from agents[] JS array directly
    var numAgents = agents.length || 1;
    var cardW = 2.5;
    var cardGap = 0.3;
    var totalCardsW = numAgents * cardW + (numAgents - 1) * cardGap;
    var cardStartX = (10 - totalCardsW) / 2;

    agents.forEach(function(a, idx) {
      var aName = a.name || '';
      var aTitle = a.title || '';
      var aCompany = a.company || '';
      var aPhone = a.phone || '';
      var aEmail = a.email || '';
      var aLicense = a.licenses || '';

      var ax = cardStartX + idx * (cardW + cardGap);
      var ay = 3.20;

      s8.addShape('rect', {x:ax, y:ay, w:cardW, h:1.75, fill:{color:NV}, rectRadius:0.05});
      s8.addShape('rect', {x:ax+0.3, y:ay, w:cardW-0.6, h:0.025, fill:{color:AC}});

      s8.addText(aName.toUpperCase(), {x:ax, y:ay+0.08, w:cardW, h:0.28, align:'center', fontSize:12, fontFace:'Georgia', color:WH, bold:true});
      s8.addText(aTitle, {x:ax, y:ay+0.34, w:cardW, h:0.18, align:'center', fontSize:8, fontFace:'Arial', color:AC});
      if (aCompany) {
        s8.addText(aCompany, {x:ax, y:ay+0.52, w:cardW, h:0.18, align:'center', fontSize:7.5, fontFace:'Arial', color:WH});
      }
      if (aPhone) {
        s8.addText(aPhone, {x:ax, y:ay+0.74, w:cardW, h:0.18, align:'center', fontSize:8, fontFace:'Arial', color:GR});
      }
      if (aEmail) {
        s8.addText(aEmail, {x:ax, y:ay+0.92, w:cardW, h:0.18, align:'center', fontSize:7.5, fontFace:'Arial', color:GR});
      }
      if (aLicense) {
        s8.addText(aLicense, {x:ax, y:ay+1.12, w:cardW, h:0.18, align:'center', fontSize:6.5, fontFace:'Arial', color:GR, italic:true});
      }
    });

    // Disclaimer
    var disc = document.getElementById('disclaimer') ? document.getElementById('disclaimer').value : '';
    if (disc) {
      s8.addText(disc, {x:0.6, y:4.82, w:8.8, h:0.25, fontSize:7, fontFace:'Arial', color:GR, align:'center', valign:'bottom'});
    }

    addFooter(s8, '08', true);

    // ════════════════════════════════════════════════
    // GENERATE FILE
    // ════════════════════════════════════════════════
    var fileName = ((v('propName1') + ' ' + v('propName2')).trim() || 'Property') + ' - Offering Memorandum.pptx';
    pptx.writeFile({fileName: fileName}).then(function() {
      showStatus('OM generated: ' + fileName);
    }).catch(function(e) {
      alert('Error generating OM: ' + e.message);
    });

  } catch (e) {
    alert('Error: ' + e.message + '\n\n' + e.stack);
  }
}

// ==== PAST OMs (localStorage) ====
function gatherOMData() {
  var data = {};
  var fields = ['propName1','propName2','address','askingPrice','totalUnits','downPayment',
    'execDesc','callout','noi','grm','propType','yearBuilt','lotSize','parking',
    'hl1','hl2','hl3','hl4','occupancy','features',
    'curIncome','pfIncome','cashOnCash','capRate','pricePerUnit',
    'mktCity','mktState','mktCounty','mktDesc',
    'population','medianIncome','unemployment','avgRent','medianAge',
    'households','ownerOcc','renterOcc','housingUnits','hhSize',
    'drv1Title','drv1Desc','drv2Title','drv2Desc','drv3Title','drv3Desc',
    'disclaimer'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  data._unitData = JSON.parse(JSON.stringify(unitData));
  data._curExpenses = JSON.parse(JSON.stringify(curExpenses));
  data._pfExpenses = JSON.parse(JSON.stringify(pfExpenses));
  data._curOtherIncome = JSON.parse(JSON.stringify(curOtherIncome));
  data._pfOtherIncome = JSON.parse(JSON.stringify(pfOtherIncome));
  data._agents = JSON.parse(JSON.stringify(agents));
  data._showSqFt = showSqFt;
  data._photos = photos.map(function(p){ return p || null; });
  return data;
}
function restoreOMData(data) {
  var fields = ['propName1','propName2','address','askingPrice','totalUnits','downPayment',
    'execDesc','callout','noi','grm','propType','yearBuilt','lotSize','parking',
    'hl1','hl2','hl3','hl4','occupancy','features',
    'curIncome','pfIncome','cashOnCash','capRate','pricePerUnit',
    'mktCity','mktState','mktCounty','mktDesc',
    'population','medianIncome','unemployment','avgRent','medianAge',
    'households','ownerOcc','renterOcc','housingUnits','hhSize',
    'drv1Title','drv1Desc','drv2Title','drv2Desc','drv3Title','drv3Desc',
    'disclaimer'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && data[id] !== undefined) el.value = data[id];
  });
  if (data._unitData) { unitData = data._unitData; renderUnits(); }
  if (data._curExpenses) { curExpenses = data._curExpenses; renderExpenses('cur'); }
  if (data._pfExpenses) { pfExpenses = data._pfExpenses; renderExpenses('pf'); }
  if (data._curOtherIncome) { curOtherIncome = data._curOtherIncome; renderOtherIncome('cur'); }
  if (data._pfOtherIncome) { pfOtherIncome = data._pfOtherIncome; renderOtherIncome('pf'); }
  if (data._agents) { agents = data._agents; renderAgents(); }
  if (data._photos) { photos = data._photos; renderPhotos(); }
  if (data._showSqFt !== undefined) { showSqFt = data._showSqFt; document.getElementById('showSqFt').checked = showSqFt; toggleSqFt(); }
  calcNOI('cur'); calcNOI('pf');
}
function getSavedOMs() { try { return JSON.parse(localStorage.getItem('gatewayOMs') || '{}'); } catch(e) { return {}; } }
function saveCurrentOM() {
  var nameInput = document.getElementById('saveOmName');
  var name = nameInput.value.trim();
  if (!name) { alert('Please enter a name for this OM.'); return; }
  var saved = getSavedOMs();
  var key = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  var city = document.getElementById('address').value.split(',').pop().trim() || 'Unknown';
  saved[key] = { name: name, city: city, date: new Date().toLocaleDateString(), data: gatherOMData() };
  localStorage.setItem('gatewayOMs', JSON.stringify(saved));
  nameInput.value = '';
  renderPastOMs();
  alert('OM saved: ' + name);
}
function loadOM(key) {
  var saved = getSavedOMs();
  if (saved[key]) {
    if (!confirm('Load "' + saved[key].name + '"? This will replace all current data.')) return;
    restoreOMData(saved[key].data);
    showTab(0);
    alert('Loaded: ' + saved[key].name);
  }
}
function deleteOM(key) {
  var saved = getSavedOMs();
  if (saved[key] && confirm('Delete "' + saved[key].name + '"?')) {
    delete saved[key];
    localStorage.setItem('gatewayOMs', JSON.stringify(saved));
    renderPastOMs();
  }
}
function renderPastOMs() {
  var container = document.getElementById('pastOmList');
  if (!container) return;
  var saved = getSavedOMs();
  var keys = Object.keys(saved);
  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--brand-gray)"><p style="font-size:24px;margin-bottom:8px">\ud83d\udcc2</p><p>No saved OMs yet.<br>Fill in your data and click Save above.</p></div>';
    return;
  }
  var byCityMap = {};
  keys.forEach(function(k) { var city = saved[k].city || 'Other'; if (!byCityMap[city]) byCityMap[city] = []; byCityMap[city].push(k); });
  var cities = Object.keys(byCityMap).sort();
  var out = '';
  cities.forEach(function(city) {
    out += '<div style="margin-bottom:20px">';
    out += '<div style="font-size:12px;font-weight:600;color:var(--brand-blue);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--brand-navy)">' + city + '</div>';
    byCityMap[city].forEach(function(k) {
      var om = saved[k];
      out += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;margin-bottom:6px;background:var(--brand-navy);border-radius:6px">';
      out += '<div><span style="color:var(--brand-cream);font-weight:500">' + om.name + '</span><span style="color:var(--brand-gray);font-size:11px;margin-left:12px">Saved ' + om.date + '</span></div>';
      out += '<div style="display:flex;gap:8px">';
      out += "<button class=\"btn-sm\" onclick=\"loadOM('" + k + "')\" style=\"background:var(--brand-blue);color:var(--brand-dark)\">Load</button>";
      out += "<button class=\"btn-sm danger\" onclick=\"deleteOM('" + k + "')\">Delete</button>";
      out += '</div></div>';
    });
    out += '</div>';
  });
  container.innerHTML = out;
}
renderPastOMs();


// ============================================================
// OM BUILDER OVERLAY V4 — Enhances V9 with new features
// Runs after V9 code has loaded
// ============================================================
// OMISSIONS:
// - PDF upload/parse: Omitted — requires pdf.js (~500KB). PPTX parsing supported via JSZip.
//   PDF support flagged as future enhancement.
// - STDB live data pull: Omitted — CORS blocks requests from static HTML.
//   Employers/industries use built-in curated database with fallback manual entry.
// - Live web search for employers: Omitted — no server-side proxy available in static HTML.
//   Built-in database covers major Iowa/Midwest markets.
// ============================================================

(function() {
  "use strict";

  var _origShowTab = window.showTab;
  var totalTabs = 12;

  // ============================================================
  // EMPLOYER DATABASE — curated for Iowa/Midwest markets
  // Source: built-in database (no API — static HTML limitation)
  // ============================================================
  var EMPLOYER_DB = {
    "sioux city": {
      employers: [
        { name: "Tyson Fresh Meats", employees: "4,000+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "MercyOne Siouxland", employees: "2,800+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "UnityPoint Health — St. Luke's", employees: "2,400+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Woodbury County", employees: "1,200+", industry: "Government", logo: "\u{1F3DB}\uFE0F" },
        { name: "Wells Enterprises (Blue Bunny)", employees: "3,000+", industry: "Food Manufacturing", logo: "\u{1F3ED}" },
        { name: "Sioux City Community School District", employees: "2,000+", industry: "Education", logo: "\u{1F393}" },
        { name: "Sabre Industries", employees: "1,000+", industry: "Manufacturing", logo: "\u2699\uFE0F" },
        { name: "CF Industries", employees: "800+", industry: "Chemical Manufacturing", logo: "\u{1F9EA}" },
        { name: "Western Iowa Tech", employees: "600+", industry: "Education", logo: "\u{1F393}" },
        { name: "Ho-Chunk Inc.", employees: "1,500+", industry: "Diversified Holdings", logo: "\u{1F3E2}" }
      ],
      industries: [
        { name: "Healthcare", pct: 22 },
        { name: "Food Processing & Agriculture", pct: 18 },
        { name: "Manufacturing", pct: 15 },
        { name: "Education", pct: 14 },
        { name: "Government", pct: 12 },
        { name: "Retail & Services", pct: 10 },
        { name: "Transportation & Logistics", pct: 9 }
      ]
    },
    "omaha": {
      employers: [
        { name: "Offutt Air Force Base", employees: "10,000+", industry: "Military", logo: "\u{1F396}\uFE0F" },
        { name: "Nebraska Medicine / UNMC", employees: "8,500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "CHI Health", employees: "7,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Union Pacific Railroad", employees: "5,500+", industry: "Transportation", logo: "\u{1F682}" },
        { name: "Mutual of Omaha", employees: "5,000+", industry: "Insurance/Finance", logo: "\u{1F3E6}" },
        { name: "Werner Enterprises", employees: "3,200+", industry: "Trucking & Logistics", logo: "\u{1F69B}" },
        { name: "First National of Nebraska", employees: "3,000+", industry: "Banking", logo: "\u{1F3E6}" },
        { name: "ConAgra Brands", employees: "2,800+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "TD Ameritrade / Schwab", employees: "2,500+", industry: "Financial Services", logo: "\u{1F4B0}" },
        { name: "Kiewit Corporation", employees: "2,000+", industry: "Construction", logo: "\u{1F3D7}\uFE0F" }
      ],
      industries: [
        { name: "Healthcare", pct: 18 },
        { name: "Financial Services & Insurance", pct: 16 },
        { name: "Transportation & Logistics", pct: 14 },
        { name: "Military/Government", pct: 12 },
        { name: "Food Processing", pct: 10 },
        { name: "Technology", pct: 9 },
        { name: "Construction & Engineering", pct: 8 },
        { name: "Education", pct: 7 },
        { name: "Retail & Services", pct: 6 }
      ]
    },
    "des moines": {
      employers: [
        { name: "Principal Financial Group", employees: "9,500+", industry: "Financial Services", logo: "\u{1F3E6}" },
        { name: "UnityPoint Health", employees: "7,500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Wells Fargo", employees: "6,000+", industry: "Banking", logo: "\u{1F3E6}" },
        { name: "Hy-Vee", employees: "5,500+", industry: "Retail Grocery", logo: "\u{1F6D2}" },
        { name: "MercyOne Des Moines", employees: "4,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "John Deere (Ankeny)", employees: "3,200+", industry: "Manufacturing", logo: "\u{1F69C}" },
        { name: "Nationwide Insurance", employees: "2,500+", industry: "Insurance", logo: "\u{1F3E2}" },
        { name: "EMC Insurance", employees: "2,000+", industry: "Insurance", logo: "\u{1F3E2}" },
        { name: "Iowa State Government", employees: "8,000+", industry: "Government", logo: "\u{1F3DB}\uFE0F" },
        { name: "Meredith Corporation", employees: "1,800+", industry: "Media", logo: "\u{1F4FA}" }
      ],
      industries: [
        { name: "Financial Services & Insurance", pct: 24 },
        { name: "Healthcare", pct: 18 },
        { name: "Government", pct: 14 },
        { name: "Retail & Services", pct: 12 },
        { name: "Manufacturing", pct: 10 },
        { name: "Technology", pct: 9 },
        { name: "Agriculture", pct: 7 },
        { name: "Education", pct: 6 }
      ]
    },
    "cedar rapids": {
      employers: [
        { name: "Collins Aerospace (Rockwell Collins)", employees: "10,000+", industry: "Aerospace & Defense", logo: "\u2708\uFE0F" },
        { name: "UnityPoint Health — St. Luke's", employees: "4,500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Mercy Medical Center", employees: "3,200+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "General Mills (Quaker Oats)", employees: "2,000+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "Transamerica/Aegon", employees: "1,800+", industry: "Financial Services", logo: "\u{1F3E6}" },
        { name: "Cedar Rapids CSD", employees: "3,500+", industry: "Education", logo: "\u{1F393}" },
        { name: "Kirkwood Community College", employees: "1,200+", industry: "Education", logo: "\u{1F393}" },
        { name: "Linn County Government", employees: "900+", industry: "Government", logo: "\u{1F3DB}\uFE0F" }
      ],
      industries: [
        { name: "Aerospace & Defense", pct: 22 },
        { name: "Healthcare", pct: 18 },
        { name: "Manufacturing", pct: 14 },
        { name: "Education", pct: 12 },
        { name: "Financial Services", pct: 10 },
        { name: "Food Processing", pct: 8 },
        { name: "Government", pct: 8 },
        { name: "Retail & Services", pct: 8 }
      ]
    },
    "lincoln": {
      employers: [
        { name: "University of Nebraska\u2013Lincoln", employees: "7,500+", industry: "Education", logo: "\u{1F393}" },
        { name: "Bryan Health", employees: "4,500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "CHI Health St. Elizabeth", employees: "2,200+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "State of Nebraska", employees: "6,000+", industry: "Government", logo: "\u{1F3DB}\uFE0F" },
        { name: "Kawasaki Motors", employees: "2,500+", industry: "Manufacturing", logo: "\u2699\uFE0F" },
        { name: "Lincoln Public Schools", employees: "6,500+", industry: "Education", logo: "\u{1F393}" },
        { name: "Nelnet", employees: "2,000+", industry: "Financial Services", logo: "\u{1F3E6}" },
        { name: "Lincoln Financial Group", employees: "1,200+", industry: "Insurance", logo: "\u{1F3E2}" }
      ],
      industries: [
        { name: "Education", pct: 22 },
        { name: "Government", pct: 18 },
        { name: "Healthcare", pct: 16 },
        { name: "Manufacturing", pct: 12 },
        { name: "Financial Services", pct: 10 },
        { name: "Retail & Services", pct: 9 },
        { name: "Agriculture", pct: 7 },
        { name: "Technology", pct: 6 }
      ]
    },
    "south sioux city": {
      employers: [
        { name: "Tyson Fresh Meats", employees: "4,000+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "Cargill", employees: "1,500+", industry: "Agriculture/Food", logo: "\u{1F33E}" },
        { name: "South Sioux City Schools", employees: "500+", industry: "Education", logo: "\u{1F393}" },
        { name: "Siouxland Community Health", employees: "400+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Winnebago Tribe of Nebraska", employees: "1,000+", industry: "Tribal Government", logo: "\u{1F3DB}\uFE0F" }
      ],
      industries: [
        { name: "Food Processing & Agriculture", pct: 30 },
        { name: "Manufacturing", pct: 18 },
        { name: "Healthcare", pct: 14 },
        { name: "Retail & Services", pct: 13 },
        { name: "Education", pct: 10 },
        { name: "Government", pct: 9 },
        { name: "Transportation", pct: 6 }
      ]
    },
    "council bluffs": {
      employers: [
        { name: "CHI Health Mercy", employees: "2,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Ameristar Casino / Harrah's", employees: "1,500+", industry: "Gaming & Hospitality", logo: "\u{1F3B0}" },
        { name: "Google Data Center", employees: "300+", industry: "Technology", logo: "\u{1F4BB}" },
        { name: "Council Bluffs CSD", employees: "1,200+", industry: "Education", logo: "\u{1F393}" },
        { name: "Pottawattamie County", employees: "800+", industry: "Government", logo: "\u{1F3DB}\uFE0F" },
        { name: "Katelman Foundry", employees: "400+", industry: "Manufacturing", logo: "\u2699\uFE0F" }
      ],
      industries: [
        { name: "Healthcare", pct: 18 },
        { name: "Gaming & Hospitality", pct: 16 },
        { name: "Transportation & Logistics", pct: 14 },
        { name: "Education", pct: 12 },
        { name: "Manufacturing", pct: 11 },
        { name: "Government", pct: 10 },
        { name: "Technology (Data Centers)", pct: 10 },
        { name: "Retail & Services", pct: 9 }
      ]
    },
    "waterloo": {
      employers: [
        { name: "John Deere (Waterloo Works)", employees: "6,000+", industry: "Manufacturing", logo: "\u{1F69C}" },
        { name: "UnityPoint Health — Allen", employees: "2,800+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Tyson Fresh Meats", employees: "2,500+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "Waterloo CSD", employees: "1,800+", industry: "Education", logo: "\u{1F393}" },
        { name: "Target Distribution", employees: "1,200+", industry: "Logistics", logo: "\u{1F4E6}" },
        { name: "Black Hawk County", employees: "800+", industry: "Government", logo: "\u{1F3DB}\uFE0F" }
      ],
      industries: [
        { name: "Manufacturing", pct: 24 },
        { name: "Healthcare", pct: 16 },
        { name: "Food Processing", pct: 14 },
        { name: "Education", pct: 12 },
        { name: "Logistics & Distribution", pct: 10 },
        { name: "Government", pct: 9 },
        { name: "Retail & Services", pct: 8 },
        { name: "Agriculture", pct: 7 }
      ]
    },
    "davenport": {
      employers: [
        { name: "Genesis Health System", employees: "5,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "John Deere HQ", employees: "4,000+", industry: "Manufacturing", logo: "\u{1F69C}" },
        { name: "Rock Island Arsenal", employees: "6,500+", industry: "Military", logo: "\u{1F396}\uFE0F" },
        { name: "Arconic (Alcoa)", employees: "2,200+", industry: "Manufacturing", logo: "\u2699\uFE0F" },
        { name: "Davenport CSD", employees: "2,000+", industry: "Education", logo: "\u{1F393}" },
        { name: "Scott County", employees: "1,000+", industry: "Government", logo: "\u{1F3DB}\uFE0F" }
      ],
      industries: [
        { name: "Manufacturing & Defense", pct: 24 },
        { name: "Healthcare", pct: 18 },
        { name: "Government/Military", pct: 14 },
        { name: "Education", pct: 12 },
        { name: "Logistics", pct: 10 },
        { name: "Retail & Services", pct: 9 },
        { name: "Agriculture", pct: 7 },
        { name: "Technology", pct: 6 }
      ]
    },
    "sioux falls": {
      employers: [
        { name: "Sanford Health", employees: "10,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Avera Health", employees: "7,500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Wells Fargo", employees: "3,200+", industry: "Banking", logo: "\u{1F3E6}" },
        { name: "Citibank (Citigroup)", employees: "3,000+", industry: "Financial Services", logo: "\u{1F3E6}" },
        { name: "Smithfield Foods (John Morrell)", employees: "3,500+", industry: "Food Processing", logo: "\u{1F3ED}" },
        { name: "Sioux Falls School District", employees: "4,000+", industry: "Education", logo: "\u{1F393}" },
        { name: "Hy-Vee", employees: "2,000+", industry: "Retail Grocery", logo: "\u{1F6D2}" },
        { name: "POET Bioprocessing", employees: "600+", industry: "Energy/Agriculture", logo: "\u{1F33E}" }
      ],
      industries: [
        { name: "Healthcare", pct: 24 },
        { name: "Financial Services & Banking", pct: 18 },
        { name: "Food Processing", pct: 12 },
        { name: "Education", pct: 11 },
        { name: "Manufacturing", pct: 10 },
        { name: "Retail & Services", pct: 9 },
        { name: "Government", pct: 8 },
        { name: "Agriculture & Energy", pct: 8 }
      ]
    },
    "kansas city": {
      employers: [
        { name: "Cerner Corporation (Oracle Health)", employees: "13,000+", industry: "Health IT", logo: "\u{1F4BB}" },
        { name: "HCA Midwest Health", employees: "8,000+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Sprint/T-Mobile", employees: "6,000+", industry: "Telecommunications", logo: "\u{1F4F1}" },
        { name: "Ford Motor Co. (Claycomo)", employees: "7,200+", industry: "Manufacturing", logo: "\u{1F697}" },
        { name: "Hallmark Cards", employees: "4,000+", industry: "Consumer Products", logo: "\u{1F3E2}" },
        { name: "Burns & McDonnell", employees: "3,500+", industry: "Engineering", logo: "\u{1F3D7}\uFE0F" },
        { name: "BNSF Railway", employees: "3,000+", industry: "Transportation", logo: "\u{1F682}" },
        { name: "Garmin", employees: "3,200+", industry: "Technology", logo: "\u{1F4BB}" }
      ],
      industries: [
        { name: "Healthcare & Health IT", pct: 18 },
        { name: "Technology", pct: 14 },
        { name: "Manufacturing & Automotive", pct: 13 },
        { name: "Financial Services", pct: 12 },
        { name: "Transportation & Logistics", pct: 10 },
        { name: "Engineering & Construction", pct: 9 },
        { name: "Government/Military", pct: 8 },
        { name: "Retail & Services", pct: 8 },
        { name: "Education", pct: 8 }
      ]
    },
    "le mars": {
      employers: [
        { name: "Wells Enterprises (Blue Bunny)", employees: "3,500+", industry: "Food Manufacturing", logo: "\u{1F3ED}" },
        { name: "Floyd Valley Healthcare", employees: "500+", industry: "Healthcare", logo: "\u{1F3E5}" },
        { name: "Le Mars CSD", employees: "400+", industry: "Education", logo: "\u{1F393}" },
        { name: "Ag Processing Inc (AGP)", employees: "300+", industry: "Agriculture", logo: "\u{1F33E}" },
        { name: "Plymouth County", employees: "250+", industry: "Government", logo: "\u{1F3DB}\uFE0F" }
      ],
      industries: [
        { name: "Food Manufacturing", pct: 32 },
        { name: "Agriculture", pct: 20 },
        { name: "Healthcare", pct: 14 },
        { name: "Education", pct: 10 },
        { name: "Retail & Services", pct: 10 },
        { name: "Government", pct: 8 },
        { name: "Transportation", pct: 6 }
      ]
    }
  };

  function matchCity(input) {
    if (!input) return null;
    var lower = input.toLowerCase().trim();
    if (EMPLOYER_DB[lower]) return lower;
    var keys = Object.keys(EMPLOYER_DB);
    for (var i = 0; i < keys.length; i++) {
      if (lower.indexOf(keys[i]) !== -1 || keys[i].indexOf(lower) !== -1) return keys[i];
    }
    return null;
  }

  // ---- INJECT NEW TAB BUTTONS ----
  function injectTabs() {
    var tabBar = document.querySelector('#page-multifamily .tabs');
    if (!tabBar) return;
    var compTab = document.createElement('div');
    compTab.className = 'tab';
    compTab.onclick = function() { showTab(8); };
    compTab.textContent = 'Comparable Sales';
    compTab.style.borderLeft = '2px solid var(--brand-blue)';
    var analysisTab = document.createElement('div');
    analysisTab.className = 'tab';
    analysisTab.onclick = function() { showTab(9); };
    analysisTab.textContent = '\u{1F4CA} Investment Analysis';
    var agentBioTab = document.createElement('div');
    agentBioTab.className = 'tab';
    agentBioTab.onclick = function() { showTab(10); };
    agentBioTab.textContent = '\u{1F464} Agent Bio';
    agentBioTab.style.borderLeft = '2px solid var(--brand-gold,#C8A84B)';
    var gatewayTab = document.createElement('div');
    gatewayTab.className = 'tab';
    gatewayTab.onclick = function() { showTab(11); };
    gatewayTab.textContent = '\u{1F3E2} About Gateway';
    gatewayTab.style.borderLeft = '2px solid var(--brand-gold,#C8A84B)';
    tabBar.appendChild(compTab);
    tabBar.appendChild(analysisTab);
    tabBar.appendChild(agentBioTab);
    tabBar.appendChild(gatewayTab);
  }

  // ---- INJECT COMPARABLE SALES PANEL (TAB 8) ----
  function injectCompsPanel() {
    var container = document.querySelector('#page-multifamily');
    if (!container) return;
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'tab8';
    panel.innerHTML = '<div class="section-title">Comparable Sales</div>' +
      '<p style="color:var(--brand-gray);font-size:13px;margin-bottom:16px">Enter comparable property sales to include in the OM. Averages calculate automatically.</p>' +
      '<div style="margin-bottom:12px">' +
        '<button class="btn-sm" onclick="addCompRow()">+ Add Comparable</button>' +
        '<button class="btn-sm" onclick="document.getElementById(\'compUploadInput\').click()" style="margin-left:8px">\u{1F4C4} Upload CSV/XLSX</button>' +
        '<input type="file" id="compUploadInput" accept=".csv,.xlsx,.xls" style="display:none" onchange="handleCompUpload(this)">' +
      '</div>' +
      '<table id="compTable" style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="border-bottom:2px solid var(--brand-blue)">' +
          '<th style="text-align:left;padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Address</th>' +
          '<th style="text-align:left;padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Sale Price</th>' +
          '<th style="text-align:left;padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Units</th>' +
          '<th style="padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Price/Unit</th>' +
          '<th style="padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Cap Rate</th>' +
          '<th style="text-align:left;padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Date Sold</th>' +
          '<th style="text-align:left;padding:8px;color:var(--brand-blue);font-weight:600;font-size:12px;text-transform:uppercase">Notes</th>' +
          '<th></th></tr></thead>' +
        '<tbody id="compRows"></tbody>' +
        '<tfoot id="compAvgs"></tfoot>' +
      '</table>' +
      '<div style="margin-top:16px"><label style="font-size:13px;cursor:pointer"><input type="checkbox" id="compIncludePPTX" checked style="margin-right:6px">Include Comparable Sales slide in PPTX export</label></div>';
    container.appendChild(panel);
  }

  // ---- INJECT 5-10 YEAR ANALYSIS PANEL (TAB 9) ----
  function injectAnalysisPanel() {
    var container = document.querySelector('#page-multifamily');
    if (!container) return;
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'tab9';
    panel.innerHTML = '<div class="section-title">Investment Analysis \u2014 5 to 10 Year Projection</div>' +
      '<p style="color:var(--brand-gray);font-size:13px;margin-bottom:16px">Configure assumptions and generate a multi-year financial forecast. Values auto-pull from the Cover and Financials tabs where possible.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-row"><label>Purchase Price ($)</label><input id="iaPrice" type="number" placeholder="from Cover tab" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Down Payment ($)</label><input id="iaDown" type="number" placeholder="from Cover tab" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Loan Amount ($)</label><input id="iaLoan" type="number" readonly style="opacity:0.7"></div>' +
        '<div class="form-row"><label>Interest Rate (%)</label><input id="iaRate" type="number" step="0.1" value="6.5" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Amortization (Years)</label><input id="iaAmort" type="number" value="25" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Projection Years</label><select id="iaYears" onchange="calcAnalysis()"><option value="5">5 Years</option><option value="7">7 Years</option><option value="10" selected>10 Years</option></select></div>' +
      '</div>' +
      '<div class="section-title" style="margin-top:20px">Growth Assumptions</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-row"><label>Annual Income Growth (%)</label><input id="iaIncGrowth" type="number" step="0.1" value="3.0" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Annual Expense Growth (%)</label><input id="iaExpGrowth" type="number" step="0.1" value="2.0" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Annual Appreciation (%)</label><input id="iaAppreciation" type="number" step="0.1" value="2.0" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Base Year Gross Income ($)</label><input id="iaBaseIncome" type="number" placeholder="from Financials" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Base Year Expenses ($)</label><input id="iaBaseExpenses" type="number" placeholder="from Financials" oninput="calcAnalysis()"></div>' +
        '<div class="form-row"><label>Vacancy Rate (%)</label><input id="iaVacancy" type="number" step="0.1" value="5.0" oninput="calcAnalysis()"></div>' +
      '</div>' +
      '<button class="btn-sm" onclick="pullAnalysisFromOM()" style="margin-top:12px;margin-bottom:16px">\u2B07\uFE0F Pull Values from Cover & Financials</button>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap">' +
        '<button class="btn-sm" onclick="window.calcAnalysis&&calcAnalysis()" style="background:var(--brand-blue,#A2B6C0);color:#1E2F39;font-weight:700">\u{1F4CA} Run Analysis</button>' +
        '<label style="font-size:12px;color:var(--brand-gray);cursor:pointer"><input type="checkbox" id="iaIncludePPTX" checked style="margin-right:4px"> Include in PPTX export</label>' +
        '<label style="font-size:12px;color:var(--brand-gray);cursor:pointer"><input type="checkbox" id="iaLandscape" checked style="margin-right:4px"> Landscape export</label>' +
      '</div>' +
      '<div id="analysisResults" style="display:none;margin-top:16px;overflow-x:auto;max-width:100%">' +
        '<table id="analysisTable" style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px">' +
          '<thead id="analysisHead"></thead><tbody id="analysisBody"></tbody>' +
        '</table>' +
      '</div>';
    container.appendChild(panel);
  }

  // ---- INJECT VACANCY/CREDIT LOSS INTO FINANCIALS ----
  function injectVacancyLoss() {
    ['cur', 'pf'].forEach(function(prefix) {
      var grossIncome = document.getElementById(prefix + 'Income');
      if (!grossIncome) return;
      var wrapper = grossIncome.closest('.form-group') || grossIncome.parentNode;
      var div = document.createElement('div');
      div.style.cssText = 'margin:8px 0';
      div.innerHTML = '<div class="form-row" style="margin:0;max-width:220px"><label style="font-size:11px">Vacancy/Credit Loss (%)</label><input id="' + prefix + 'Vacancy" type="number" step="0.1" value="5" oninput="calcNOI(\'' + prefix + '\')" style="font-size:13px"></div>';
      wrapper.parentNode.insertBefore(div, wrapper.nextSibling);
    });
  }

  // ---- INJECT AI GENERATE BUTTONS ----
  function injectAIButtons() {
    var fields = [
      { id: 'execDesc', label: 'Generate Executive Summary', tab: 1 },
      { id: 'propDesc', label: 'Generate Property Description', tab: 2 },
      { id: 'mktDesc', label: 'Generate Market Overview', tab: 4 }
    ];
    fields.forEach(function(f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      var btn = document.createElement('button');
      btn.className = 'btn-sm';
      btn.textContent = '\u2726 ' + f.label;
      btn.setAttribute('data-ai-field', f.id);
      btn.setAttribute('data-ai-label', '\u2726 ' + f.label);
      btn.style.cssText = 'margin-bottom:8px;background:linear-gradient(135deg,#1E2F39,#2a4a5a);border:1px solid var(--brand-blue)';
      btn.onclick = function() { generateAIContent(f.id); };
      el.parentNode.insertBefore(btn, el);
    });
    var hl1 = document.getElementById('hl1');
    if (hl1) {
      var hlBtn = document.createElement('button');
      hlBtn.className = 'btn-sm';
      hlBtn.textContent = '\u2726 Generate Highlights';
      hlBtn.setAttribute('data-ai-field', 'highlights');
      hlBtn.setAttribute('data-ai-label', '\u2726 Generate Highlights');
      hlBtn.style.cssText = 'margin-bottom:8px;background:linear-gradient(135deg,#1E2F39,#2a4a5a);border:1px solid var(--brand-blue)';
      hlBtn.onclick = function() { generateHighlights(); };
      hl1.parentNode.parentNode.insertBefore(hlBtn, hl1.parentNode);
    }
  }

  // ---- INJECT OM SAVE / LOAD BAR ----
  function injectOMUpload() {
    var tab0 = document.querySelector('#tab0');
    if (!tab0) return;

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;padding:14px 16px;background:linear-gradient(135deg,rgba(30,47,57,0.9),rgba(21,34,41,0.95));border-radius:10px;border:1px solid rgba(162,182,192,0.18);flex-wrap:wrap';

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:rgba(162,182,192,0.12);display:flex;align-items:center;justify-content:center;font-size:17px">📋</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--brand-cream)">OM Session</div>' +
          '<div style="font-size:11px;color:var(--brand-gray);margin-top:1px">Save your work or load a previous OM</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn-sm" onclick="document.getElementById(\'omJsonInput\').click()" style="display:flex;align-items:center;gap:5px">📂 Load OM</button>' +
        '<input type="file" id="omJsonInput" accept=".json" style="display:none" onchange="handleOMJsonLoad(this)">' +
        '<button class="btn-sm" onclick="exportOMData()" style="display:flex;align-items:center;gap:5px;background:rgba(162,182,192,0.12);border-color:rgba(162,182,192,0.3)">💾 Save OM</button>' +
        '<button class="btn-sm" onclick="confirmClearOM()" style="display:flex;align-items:center;gap:5px;background:rgba(231,76,60,0.08);border-color:rgba(231,76,60,0.2);color:#e74c3c">✕ Clear</button>' +
      '</div>';

    tab0.insertBefore(bar, tab0.firstChild);
  }

  window.handleOMJsonLoad = function(input) {
    if (!input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    if (!file.name.endsWith('.json')) { showGlobalStatus('⚠️ Please upload a .json file saved from this tool'); input.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        if (typeof window.restoreOMData === 'function') {
          window.restoreOMData(data);
          showGlobalStatus('✓ OM loaded — ' + (data.propName1 || 'Untitled') + ' ' + (data.propName2 || ''));
        }
      } catch(err) { showGlobalStatus('⚠️ Could not read file: ' + err.message); }
    };
    reader.readAsText(file);
    input.value = '';
  };

  window.confirmClearOM = function() {
    if (!confirm('Clear all OM fields and start fresh? This cannot be undone.')) return;
    var fields = ['propName1','propName2','address','askingPrice','totalUnits','downPayment',
      'execDesc','callout','noi','grm','propType','yearBuilt','lotSize','parking',
      'hl1','hl2','hl3','hl4','occupancy','features','curIncome','pfIncome',
      'mktCity','mktState','mktCounty','mktDesc'];
    fields.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    showGlobalStatus('OM cleared — ready for new property');
  };

  // ---- INJECT RENT ROLL UPLOAD ----
  function injectRentRollUpload() {
    var tab2 = document.querySelector('#tab2');
    if (!tab2) return;
    var div = document.createElement('div');
    div.style.cssText = 'margin:12px 0;padding:12px;background:rgba(162,182,192,0.08);border-radius:8px';
    div.innerHTML = '<strong style="font-size:13px">📋 Rent Roll Upload</strong>' +
      '<p style="color:var(--brand-gray);font-size:12px;margin:4px 0 8px">Upload XLSX, CSV, or PDF. Columns auto-detected: Unit, Beds, Baths, SqFt, Current Rent, Market Rent, Tenant, Lease Start/End, Status, Section 8, Deposit</p>' +
      '<button class="btn-sm" onclick="document.getElementById(\'rentRollInput\').click()">📂 Upload Rent Roll</button>' +
      '<input type="file" id="rentRollInput" accept=".csv,.xlsx,.xls,.pdf" style="display:none" onchange="handleRentRollUpload(this)">' +
      '<div id="rentRollStatus" style="margin-top:8px;font-size:12px;display:none"></div>';
    tab2.insertBefore(div, tab2.firstChild);
  }

  // ---- INJECT T12 UPLOAD ----
  function injectT12Upload() {
    var tab3 = document.querySelector('#tab3');
    if (!tab3) return;
    var div = document.createElement('div');
    div.style.cssText = 'margin:12px 0;padding:12px;background:rgba(162,182,192,0.08);border-radius:8px';
    div.innerHTML = '<strong style="font-size:13px">\u{1F4CA} T12 / Financials Upload</strong>' +
      '<p style="color:var(--brand-gray);font-size:12px;margin:4px 0 8px">Upload CSV, XLSX, or PDF with income & expense data (auto-detects monthly vs annual)</p>' +
      '<button class="btn-sm" onclick="document.getElementById(\'t12Input\').click()">Upload T12</button>' +
      '<input type="file" id="t12Input" accept=".csv,.xlsx,.xls,.pdf" style="display:none" onchange="handleT12Upload(this)">' +
      '<div id="t12Status" style="display:none;margin-top:8px;padding:8px 12px;border-radius:6px;font-size:12px"></div>';
    tab3.insertBefore(div, tab3.firstChild);
  }

  // ---- INJECT LOCAL EMPLOYERS & INDUSTRY SECTION ----
  function injectLocalEmployers() {
    var tab4 = document.querySelector('#tab4');
    if (!tab4) return;
    var div = document.createElement('div');
    div.style.cssText = 'margin-top:20px;padding:16px;background:rgba(162,182,192,0.06);border-radius:10px';
    div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div class="section-title" style="margin:0">Local Employers & Industry</div>' +
      '<label style="font-size:12px;cursor:pointer;color:var(--brand-gray)"><input type="checkbox" id="employerToggle" checked onchange="toggleEmployerSection()" style="margin-right:4px"> Include in report</label></div>' +
      '<div id="employerSectionContent">' +
      '<p style="color:var(--brand-gray);font-size:12px;margin-bottom:12px">Auto-populated from built-in market database. Click "Auto-Populate" after entering city in Market tab, or add manually.</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
      '<button class="btn-sm" onclick="autoPopulateEmployers()">\u{1F504} Auto-Populate from City</button>' +
      '<button class="btn-sm" onclick="addEmployer()">+ Add Employer Manually</button></div>' +
      '<div id="employerAutoStatus" style="display:none;margin-bottom:10px;padding:8px;border-radius:6px;font-size:12px"></div>' +
      '<div id="employerRows"></div>' +
      '<div class="section-title" style="margin-top:16px;font-size:15px">Dominant Industries</div>' +
      '<div id="industryBreakdown" style="margin-top:8px"></div></div>';
    tab4.appendChild(div);

    var stdbDiv = document.createElement('div');
    stdbDiv.style.cssText = 'margin-top:16px;padding:12px;background:rgba(162,182,192,0.1);border-radius:8px';
    stdbDiv.innerHTML = '<div style="display:flex;align-items:center;gap:12px">' +
      '<a href="https://www.stdb.com/dashboard" target="_blank" class="btn-sm" style="background:var(--brand-blue);color:var(--brand-navy);font-weight:600;text-decoration:none">\u{1F517} Open STDB Dashboard</a>' +
      '<span style="color:var(--brand-gray);font-size:12px">Pull additional market data from your STDB account</span></div>';
    tab4.appendChild(stdbDiv);
  }

  // ============================================================
  // LOGIC FUNCTIONS
  // ============================================================

  // ---- COMPARABLE SALES ----
  var compSales = [{ address: '', price: '', units: '', cap: '', date: '', notes: '' }];

  window.addCompRow = function(data) {
    if (data) compSales.push(data);
    else compSales.push({ address: '', price: '', units: '', cap: '', date: '', notes: '' });
    renderComps();
  };
  window.removeComp = function(i) {
    compSales.splice(i, 1);
    if (compSales.length === 0) compSales.push({ address: '', price: '', units: '', cap: '', date: '', notes: '' });
    renderComps();
  };

  function renderComps() {
    var tbody = document.getElementById('compRows');
    var avgFoot = document.getElementById('compAvgs');
    if (!tbody) return;
    tbody.innerHTML = '';
    compSales.forEach(function(c, i) {
      var ppu = (parseFloat(c.price) && parseFloat(c.units)) ? Math.round(parseFloat(c.price) / parseFloat(c.units)) : '';
      var tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--input-border)';
      tr.innerHTML = '<td style="padding:6px"><input value="' + (c.address||'') + '" onchange="compSales['+i+'].address=this.value;renderComps()" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px"><input value="' + (c.price||'') + '" onchange="compSales['+i+'].price=this.value;renderComps()" style="width:80px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px"><input value="' + (c.units||'') + '" onchange="compSales['+i+'].units=this.value;renderComps()" style="width:50px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px;text-align:center;font-weight:600;color:var(--brand-cream)">' + (ppu ? '<strong>$' + ppu.toLocaleString() + '</strong>' : '\u2014') + '</td>' +
        '<td style="padding:6px"><input value="' + (c.cap||'') + '" onchange="compSales['+i+'].cap=this.value;renderComps()" style="width:50px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px"><input type="date" value="' + (c.date||'') + '" onchange="compSales['+i+'].date=this.value" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px"><input value="' + (c.notes||'') + '" onchange="compSales['+i+'].notes=this.value" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:6px;color:white;font-size:12px"></td>' +
        '<td style="padding:6px"><button onclick="removeComp('+i+')" style="background:none;border:none;color:var(--brand-gray);cursor:pointer;font-size:16px">\u2715</button></td>';
      tbody.appendChild(tr);
    });
    var validComps = compSales.filter(function(c) { return parseFloat(c.price) > 0; });
    if (validComps.length > 0 && avgFoot) {
      var avgPrice = validComps.reduce(function(s,c){return s+parseFloat(c.price);},0)/validComps.length;
      var unitsComps = validComps.filter(function(c){return parseFloat(c.units)>0;});
      var avgUnits = unitsComps.length>0 ? unitsComps.reduce(function(s,c){return s+parseFloat(c.units);},0)/unitsComps.length : 0;
      var ppuComps = validComps.filter(function(c){return parseFloat(c.price)>0&&parseFloat(c.units)>0;});
      var avgPPU = ppuComps.length>0 ? ppuComps.reduce(function(s,c){return s+parseFloat(c.price)/parseFloat(c.units);},0)/ppuComps.length : 0;
      var capComps = validComps.filter(function(c){return parseFloat(c.cap)>0;});
      var avgCap = capComps.length>0 ? capComps.reduce(function(s,c){return s+parseFloat(c.cap);},0)/capComps.length : 0;
      avgFoot.innerHTML = '<tr style="font-weight:700;color:var(--brand-cream)"><td style="padding:8px">Averages</td><td style="padding:8px">$'+Math.round(avgPrice).toLocaleString()+'</td><td style="padding:8px">'+(avgUnits?avgUnits.toFixed(1):'\u2014')+'</td><td style="padding:8px;text-align:center">$'+(avgPPU?Math.round(avgPPU).toLocaleString():'\u2014')+'</td><td style="padding:8px">'+(avgCap?avgCap.toFixed(2)+'%':'\u2014')+'</td><td colspan="3"></td></tr>';
    }
  }
  window.compSales = compSales;
  window.renderComps = renderComps;

  window.handleCompUpload = function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      readXlsxFile(file, function(rows) { parseCompRows(rows); });
    } else {
      var reader = new FileReader();
      reader.onload = function(e) { parseCompRows(parseCSVRows(e.target.result)); };
      reader.readAsText(file);
    }
    input.value = '';
  };

  function parseCompRows(rows) {
    if (rows.length < 2) return;
    rows.slice(1).forEach(function(cols) {
      if (cols.length >= 3) {
        compSales.push({
          address: (cols[0]||'').toString().trim(),
          price: (cols[1]||'').toString().replace(/[^0-9.]/g,''),
          units: (cols[2]||'').toString().replace(/[^0-9.]/g,''),
          cap: cols.length > 3 ? (cols[3]||'').toString().replace(/[^0-9.]/g,'') : '',
          date: cols.length > 4 ? (cols[4]||'').toString().trim() : '',
          notes: cols.length > 5 ? (cols[5]||'').toString().trim() : ''
        });
      }
    });
    renderComps();
    showGlobalStatus('Loaded ' + (rows.length - 1) + ' comparable sales');
  }

  // ---- OVERRIDE calcNOI TO INCLUDE VACANCY ----
  // Total Income = GRI × (1 − vacancy%) + Other Income
  window.calcNOI = function(prefix) {
    var gri = parseFloat(document.getElementById(prefix + 'Income')?.value) || 0;
    var vacPct = parseFloat(document.getElementById(prefix + 'Vacancy')?.value) || 0;
    var effectiveGRI = gri * (1 - vacPct / 100);

    var otherList = prefix === 'cur' ? curOtherIncome : pfOtherIncome;
    var otherTotal = otherList.reduce(function(s, o) { return s + (+o.amount || 0); }, 0);
    var totalIncome = effectiveGRI + otherTotal;

    var expList = prefix === 'cur' ? curExpenses : pfExpenses;
    var totalExpenses = expList.reduce(function(s, e) { return s + (+e.amount || 0); }, 0);

    var noi = totalIncome - totalExpenses;

    document.getElementById(prefix + 'TotalIncome').textContent = '$' + Math.round(totalIncome).toLocaleString();
    document.getElementById(prefix + 'NOI').textContent = '$' + Math.round(noi).toLocaleString();
    recalcMetrics();
  };

  // Override recalcMetrics to include vacancy in all derived metrics
  window.recalcMetrics = function() {
    var askingPrice = +(document.getElementById('askingPrice').value) || 0;
    var totalUnits = +(document.getElementById('totalUnits').value) || 0;
    var downPayment = +(document.getElementById('downPayment').value) || 0;

    var curGross = +(document.getElementById('curIncome').value) || 0;
    var curVac = parseFloat(document.getElementById('curVacancy')?.value) || 0;
    var curEffGRI = curGross * (1 - curVac / 100);
    var curOtherTot = curOtherIncome.reduce(function(s,o){ return s + (+o.amount||0); }, 0);
    var curTotalIncome = curEffGRI + curOtherTot;
    var curTotExp = curExpenses.reduce(function(s,e){ return s + (+e.amount||0); }, 0);
    var curNOI = curTotalIncome - curTotExp;

    if (curNOI) document.getElementById('noi').value = Math.round(curNOI);
    if (askingPrice > 0 && curNOI) document.getElementById('capRate').value = ((curNOI / askingPrice) * 100).toFixed(2);
    if (askingPrice > 0 && totalUnits > 0) document.getElementById('pricePerUnit').value = Math.round(askingPrice / totalUnits);
    if (askingPrice > 0 && curTotalIncome > 0) document.getElementById('grm').value = (askingPrice / curTotalIncome).toFixed(1);
    if (downPayment > 0 && curNOI) {
      document.getElementById('cashOnCash').value = ((curNOI / downPayment) * 100).toFixed(1) + '%';
    } else if (askingPrice > 0 && curNOI) {
      document.getElementById('cashOnCash').value = '\u2014';
    }
  };

  // ---- 5-10 YEAR ANALYSIS ----
  window.pullAnalysisFromOM = function() {
    var price = document.getElementById('askingPrice');
    var down = document.getElementById('downPayment');
    var noiEl = document.getElementById('noi');
    var incEl = document.getElementById('curTotalIncome') || document.getElementById('pfTotalIncome');
    if (price && price.value) document.getElementById('iaPrice').value = price.value;
    if (down && down.value) document.getElementById('iaDown').value = down.value;
    if (incEl && incEl.value) document.getElementById('iaBaseIncome').value = parseFloat(incEl.value) || '';
    var inc = parseFloat(document.getElementById('iaBaseIncome').value) || 0;
    var noi = parseFloat(noiEl?.value) || 0;
    if (inc > 0 && noi > 0) document.getElementById('iaBaseExpenses').value = Math.round(inc - noi);
    calcAnalysis();
    showGlobalStatus('Values pulled from Cover & Financials tabs');
  };

  window.calcAnalysis = function() {
    var price = parseFloat(document.getElementById('iaPrice').value) || 0;
    var down = parseFloat(document.getElementById('iaDown').value) || 0;
    if (price <= 0) return;
    var loan = price - down;
    document.getElementById('iaLoan').value = loan;
    var rate = (parseFloat(document.getElementById('iaRate').value) || 6.5) / 100;
    var amort = parseInt(document.getElementById('iaAmort').value) || 25;
    var years = parseInt(document.getElementById('iaYears').value) || 10;
    var incGrowth = (parseFloat(document.getElementById('iaIncGrowth').value) || 3) / 100;
    var expGrowth = (parseFloat(document.getElementById('iaExpGrowth').value) || 2) / 100;
    var appreciation = (parseFloat(document.getElementById('iaAppreciation').value) || 2) / 100;
    var baseIncome = parseFloat(document.getElementById('iaBaseIncome').value) || 0;
    var baseExpenses = parseFloat(document.getElementById('iaBaseExpenses').value) || 0;
    var vacRate = (parseFloat(document.getElementById('iaVacancy').value) || 5) / 100;
    var monthlyRate = rate / 12;
    var totalPayments = amort * 12;
    var monthlyPayment = loan > 0 ? loan * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1) : 0;
    var annualDebt = monthlyPayment * 12;
    var data = [];
    var loanBalance = loan;
    for (var yr = 1; yr <= years; yr++) {
      var grossIncome = baseIncome * Math.pow(1 + incGrowth, yr - 1);
      var vacancy = grossIncome * vacRate;
      var effectiveIncome = grossIncome - vacancy;
      var expenses = baseExpenses * Math.pow(1 + expGrowth, yr - 1);
      var noi = effectiveIncome - expenses;
      var cashFlow = noi - annualDebt;
      var propertyValue = price * Math.pow(1 + appreciation, yr);
      var paymentsM = yr * 12;
      var balanceAfter = loan > 0 ? loan * (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, paymentsM)) / (Math.pow(1 + monthlyRate, totalPayments) - 1) : 0;
      var principalPaid = loanBalance - balanceAfter;
      loanBalance = balanceAfter;
      var equity = propertyValue - balanceAfter;
      var capRateYr = price > 0 ? (noi / price * 100) : 0;
      var cocReturn = down > 0 ? (cashFlow / down * 100) : 0;
      var grm = grossIncome > 0 ? (price / grossIncome) : 0;
      var oer = effectiveIncome > 0 ? (expenses / effectiveIncome * 100) : 0;
      var ltv = propertyValue > 0 ? (balanceAfter / propertyValue * 100) : 0;
      var dscr = annualDebt > 0 ? (noi / annualDebt) : 0;
      var ber = grossIncome > 0 ? ((expenses + annualDebt) / grossIncome * 100) : 0;
      var totalReturn = down > 0 ? ((cashFlow * yr + equity - down) / down * 100) : 0;
      data.push({ year: yr, grossIncome: grossIncome, vacancy: vacancy, effectiveIncome: effectiveIncome, expenses: expenses, noi: noi, annualDebt: annualDebt, cashFlow: cashFlow, propertyValue: propertyValue, balanceAfter: balanceAfter, principalPaid: principalPaid, equity: equity, capRate: capRateYr, cocReturn: cocReturn, grm: grm, oer: oer, ltv: ltv, dscr: dscr, ber: ber, totalReturn: totalReturn });
    }
    renderAnalysis(data);
    document.getElementById('analysisResults').style.display = 'block';
  };

  function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
  function fmtPct(n) { return n.toFixed(2) + '%'; }
  function fmtDec(n) { return n.toFixed(2); }

  function renderAnalysis(data) {
    var head = document.getElementById('analysisHead');
    var body = document.getElementById('analysisBody');
    if (!head || !body) return;
    // Header row — navy bg, white text, sticky
    var headerRow = '<tr style="background:#1E2F39;position:sticky;top:0;z-index:2">' +
      '<th style="padding:8px 10px;text-align:left;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;min-width:160px;position:sticky;left:0;background:#1E2F39;z-index:3">Metric</th>';
    data.forEach(function(d) {
      headerRow += '<th style="padding:8px 10px;text-align:right;color:#A2B6C0;font-size:11px;font-weight:600;white-space:nowrap">Year ' + d.year + '</th>';
    });
    headerRow += '</tr>';
    head.innerHTML = headerRow;

    var sections = [
      { title: 'INCOMES & EXPENSES', rows: [
        { label: 'Gross Income',        key: 'grossIncome',     format: 'dollar' },
        { label: 'Vacancy Loss',        key: 'vacancy',         format: 'dollar' },
        { label: 'Effective Income',    key: 'effectiveIncome', format: 'dollar' },
        { label: 'Operating Expenses',  key: 'expenses',        format: 'dollar' },
        { label: 'Net Operating Income',key: 'noi',             format: 'dollar', bold: true }
      ]},
      { title: 'FINANCING', rows: [
        { label: 'Annual Debt Service',    key: 'annualDebt',    format: 'dollar' },
        { label: 'Cash Flow After Debt',   key: 'cashFlow',      format: 'dollar', bold: true },
        { label: 'Loan Balance',           key: 'balanceAfter',  format: 'dollar' },
        { label: 'Principal Paid',         key: 'principalPaid', format: 'dollar' }
      ]},
      { title: 'PROFITABILITY', rows: [
        { label: 'GRM',              key: 'grm',       format: 'decimal' },
        { label: 'OER',              key: 'oer',       format: 'percent' },
        { label: 'LTV',              key: 'ltv',       format: 'percent' },
        { label: 'DSCR',             key: 'dscr',      format: 'decimal' },
        { label: 'Break-Even Ratio', key: 'ber',       format: 'percent' },
        { label: 'Cap Rate',         key: 'capRate',   format: 'percent' },
        { label: 'Cash-on-Cash Return', key: 'cocReturn', format: 'percent', bold: true }
      ]},
      { title: 'EQUITY', rows: [
        { label: 'Property Value',         key: 'propertyValue', format: 'dollar' },
        { label: 'Total Equity',           key: 'equity',        format: 'dollar', bold: true },
        { label: 'Total Return on Investment', key: 'totalReturn', format: 'percent', bold: true }
      ]}
    ];

    var html = '';
    var rowIdx = 0;
    sections.forEach(function(sec) {
      // Section header row
      html += '<tr style="background:#1E2F39"><td colspan="' + (data.length + 1) + '" style="padding:10px 10px 4px;font-weight:800;font-size:11px;text-transform:uppercase;color:#A2B6C0;border-bottom:2px solid var(--brand-blue);letter-spacing:1.5px;position:sticky;left:0">' + sec.title + '</td></tr>';
      sec.rows.forEach(function(row) {
        var isEven = (rowIdx % 2 === 0);
        rowIdx++;
        var rowBg = row.bold ? 'rgba(30,47,57,0.7)' : (isEven ? 'rgba(162,182,192,0.04)' : 'transparent');
        var lblColor = row.bold ? '#E4E3D4' : 'rgba(228,227,212,0.65)';
        var lblWeight = row.bold ? '700' : '400';
        var tdStyle = 'position:sticky;left:0;background:' + rowBg + ';z-index:1';
        html += '<tr style="border-bottom:1px solid rgba(162,182,192,0.1);background:' + rowBg + '">' +
          '<td style="padding:6px 10px;font-size:12px;color:' + lblColor + ';font-weight:' + lblWeight + ';' + tdStyle + '">' +
          (row.bold ? '<strong>' : '') + row.label + (row.bold ? '</strong>' : '') + '</td>';
        data.forEach(function(d) {
          var val = d[row.key];
          var formatted = row.format === 'dollar' ? fmt(val) : row.format === 'percent' ? fmtPct(val) : fmtDec(val);
          var color = row.bold ? '#E4E3D4' : (row.format === 'dollar' && val < 0 ? '#ff6b6b' : '#aabbc6');
          html += '<td style="padding:6px 10px;text-align:right;font-size:12px;color:' + color + ';font-weight:' + (row.bold ? '700' : '400') + '">' + formatted + '</td>';
        });
        html += '</tr>';
      });
    });
    body.innerHTML = html;

    // Apply overflow-x scroll to the table wrapper
    var table = document.getElementById('analysisTable');
    if (table && table.parentNode) {
      table.parentNode.style.overflowX = 'auto';
      table.parentNode.style.maxWidth = '100%';
      table.style.tableLayout = 'auto';
    }
  }
  // ---- AI CONTENT GENERATION (Claude API) ----
  function _omContext() {
    var propName = ((document.getElementById('propName1') || {}).value || '') + ' ' + ((document.getElementById('propName2') || {}).value || '');
    propName = propName.trim() || 'the subject property';
    return {
      propName: propName,
      address: (document.getElementById('address') || {}).value || '',
      units: (document.getElementById('totalUnits') || {}).value || '',
      price: (document.getElementById('askingPrice') || {}).value || '',
      cap: (document.getElementById('capRate') || {}).value || '',
      occ: (document.getElementById('occupancy') || {}).value || '',
      yearBuilt: (document.getElementById('yearBuilt') || {}).value || '',
      city: (document.getElementById('mktCity') || {}).value || '',
      propType: (document.getElementById('propType') || {}).value || 'multifamily',
      noi: (document.getElementById('noi') || {}).value || ''
    };
  }

  function _showAIIndicator(fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return;
    var ind = document.getElementById(fieldId + '_aiInd');
    if (!ind) {
      ind = document.createElement('div');
      ind.id = fieldId + '_aiInd';
      ind.style.cssText = 'font-size:11px;color:var(--brand-blue);margin-top:3px';
      el.parentNode.insertBefore(ind, el.nextSibling);
    }
    ind.textContent = '\u2726 AI Generated \u2014 review before export';
    ind.style.display = 'block';
    setTimeout(function(){ ind.style.display = 'none'; }, 10000);
  }

  function _aiBtn(fieldId, running) {
    var btns = document.querySelectorAll('[data-ai-field="' + fieldId + '"]');
    btns.forEach(function(b){ b.disabled = running; b.textContent = running ? '\u23F3 Generating\u2026' : (b.getAttribute('data-ai-label') || '\u2726 AI Assist'); });
  }

  window.generateAIContent = function(fieldId) {
    var ctx = _omContext();
    var fmtPrice = ctx.price ? '$' + parseInt(ctx.price).toLocaleString() : '';
    var sys = 'You are a professional commercial real estate marketing writer for Gateway Real Estate Advisors. Write concise, compelling, broker-quality copy. Use active voice. Do not use bullet points unless specifically asked. Return only the requested text with no preamble.';
    var prompt = '';
    if (fieldId === 'execDesc') {
      prompt = 'Write a 3-4 sentence executive summary paragraph for a multifamily investment OM for: Property: ' + (ctx.address || ctx.propName) +
        (ctx.units ? ', ' + ctx.units + ' units' : '') + (fmtPrice ? ', asking price ' + fmtPrice : '') +
        (ctx.cap ? ', cap rate ' + ctx.cap + '%' : '') + (ctx.occ ? ', occupancy ' + ctx.occ : '') +
        (ctx.city ? ', located in ' + ctx.city : '') + '. Begin with "Gateway Real Estate Advisors is pleased to present..."';
    } else if (fieldId === 'propDesc') {
      prompt = 'Write a 3-4 sentence property description for: ' + (ctx.address || ctx.propName) +
        (ctx.units ? ', ' + ctx.units + ' units' : '') + (ctx.yearBuilt ? ', built ' + ctx.yearBuilt : '') +
        (ctx.city ? ', ' + ctx.city : '') + '. Focus on physical attributes, location, and tenant appeal.';
    } else if (fieldId === 'mktDesc') {
      prompt = 'Write a 4-5 sentence market overview paragraph for the ' + (ctx.city || 'subject') + ' real estate market. Cover economic drivers, rental demand, employment base, and multifamily market fundamentals. Be specific and market-focused.';
    }
    if (!prompt) return;
    _aiBtn(fieldId, true);
    claudeRequest(sys, prompt, function(text) {
      var el = document.getElementById(fieldId);
      if (el) el.value = text;
      _showAIIndicator(fieldId);
      _aiBtn(fieldId, false);
    }, function(err) {
      showGlobalStatus('AI error: ' + err);
      _aiBtn(fieldId, false);
    });
  };

  window.generateHighlights = function() {
    var ctx = _omContext();
    var sys = 'You are a commercial real estate marketing writer. Return exactly 4 concise investment highlight sentences (1 sentence each, no bullet symbols, no numbering). Each on its own line. No preamble.';
    var prompt = 'Write 4 investment highlights for: ' + (ctx.address || ctx.propName) +
      (ctx.units ? ', ' + ctx.units + ' units' : '') +
      (ctx.cap ? ', cap rate ' + ctx.cap + '%' : '') +
      (ctx.occ ? ', occupancy ' + ctx.occ : '') +
      (ctx.yearBuilt ? ', built ' + ctx.yearBuilt : '') +
      (ctx.city ? ', ' + ctx.city : '') +
      '. Focus on cap rate/returns, occupancy, location, and value-add or condition.';
    var hlBtn = document.querySelector('[data-ai-field="highlights"]');
    if (hlBtn) { hlBtn.disabled = true; hlBtn.textContent = '\u23F3 Generating\u2026'; }
    claudeRequest(sys, prompt, function(text) {
      var lines = text.split('\n').map(function(l){ return l.replace(/^[\-\*\d\.\s]+/, '').trim(); }).filter(function(l){ return l.length > 5; });
      for (var i = 0; i < 4; i++) {
        var el = document.getElementById('hl' + (i + 1));
        if (el && lines[i]) el.value = lines[i];
      }
      if (hlBtn) { hlBtn.disabled = false; hlBtn.textContent = hlBtn.getAttribute('data-ai-label') || '\u2726 Generate Highlights'; }
    }, function(err) {
      showGlobalStatus('AI error: ' + err);
      if (hlBtn) { hlBtn.disabled = false; hlBtn.textContent = hlBtn.getAttribute('data-ai-label') || '\u2726 Generate Highlights'; }
    });
  };

  // ---- OM UPLOAD / EXPORT ----
  window.handleOMUpload = function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = JSON.parse(e.target.result);
          if (typeof window.restoreOMData === 'function') { window.restoreOMData(data); showGlobalStatus('OM data loaded from JSON'); }
        } catch(err) { showGlobalStatus('Error parsing JSON: ' + err.message); }
      };
      reader.readAsText(file);
    } else if (ext === 'pptx') {
      parsePptxUpload(file);
    } else if (ext === 'pdf') {
      // PDF text extraction via FileReader (text-based PDFs only)
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var text = e.target.result;
          if (!text || text.length < 100) throw new Error('PDF appears to be scanned/image-only and cannot be parsed as text');
          autoPopulateFromText(text);
        } catch(err) {
          showGlobalStatus('⚠️ PDF parse error: ' + err.message + '. Try uploading PPTX or JSON format instead.');
        }
      };
      reader.onerror = function() { showGlobalStatus('⚠️ Could not read PDF file.'); };
      reader.readAsText(file);
    } else {
      showGlobalStatus('Unsupported format. Please upload .pdf, .pptx, or .json');
    }
    input.value = '';
  };

  // PPTX Parser using JSZip
  function parsePptxUpload(file) {
    if (typeof JSZip === 'undefined') { showGlobalStatus('JSZip not loaded \u2014 cannot parse PPTX'); return; }
    showGlobalStatus('Parsing PPTX file...');
    var reader = new FileReader();
    reader.onload = function(e) {
      JSZip.loadAsync(e.target.result).then(function(zip) {
        var slideFiles = [];
        zip.forEach(function(path, entry) {
          if (path.match(/ppt\/slides\/slide\d+\.xml$/)) slideFiles.push(entry);
        });
        var allText = [];
        var promises = slideFiles.map(function(entry) {
          return entry.async('text').then(function(content) {
            var texts = [];
            var matches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
            if (matches) matches.forEach(function(m) { var t = m.replace(/<[^>]+>/g, '').trim(); if (t) texts.push(t); });
            allText.push(texts.join(' '));
          });
        });
        Promise.all(promises).then(function() {
          autoPopulateFromText(allText.join('\n'));
          showGlobalStatus('PPTX parsed \u2014 ' + slideFiles.length + ' slides processed. Review and edit all fields.');
        });
      }).catch(function(err) { showGlobalStatus('Error parsing PPTX: ' + err.message); });
    };
    reader.readAsArrayBuffer(file);
  }

  function autoPopulateFromText(text) {
    var populated = [];

    function trySet(id, value, label) {
      if (!value) return;
      var el = document.getElementById(id);
      if (el) { el.value = value; populated.push(label); }
    }

    // Property name (first substantial line or heading)
    var nameMatch = text.match(/^([A-Z][A-Za-z0-9\s\-&',\.]{4,60})(?:\n|\r)/m);
    if (nameMatch) {
      trySet('propName1', nameMatch[1].trim(), 'Property Name');
      trySet('propName2', nameMatch[1].trim(), '');
    }

    // Address
    var addrMatch = text.match(/(\d+\s+[A-Z][a-zA-Z\s]+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Ct|Court|Pl(?:ace)?|Circle|Pkwy|Highway|Hwy)[.,]?\s*(?:[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5})?)/);
    if (addrMatch) trySet('address', addrMatch[1].trim(), 'Address');

    // Asking price
    var pricePatterns = [
      /asking\s*price[:\s]*\$?\s*([\d,]+(?:\.\d{0,2})?)/i,
      /list(?:ing)?\s*price[:\s]*\$?\s*([\d,]+(?:\.\d{0,2})?)/i,
      /offering\s*price[:\s]*\$?\s*([\d,]+(?:\.\d{0,2})?)/i,
      /sale\s*price[:\s]*\$?\s*([\d,]+(?:\.\d{0,2})?)/i,
      /\$\s*([\d,]+(?:\.\d{0,2})?)\s*(?:million|MM|M)\b/i
    ];
    for (var pi = 0; pi < pricePatterns.length; pi++) {
      var pm = text.match(pricePatterns[pi]);
      if (pm) {
        var priceVal = pm[1].replace(/,/g,'');
        if (/million|MM|M/i.test(pm[0])) priceVal = (parseFloat(priceVal) * 1000000).toString();
        trySet('askingPrice', priceVal, 'Asking Price');
        break;
      }
    }

    // Cap rate
    var capMatch = text.match(/([\d.]+)\s*%\s*cap\s*rate|(cap\s*rate|cap)[:\s]*([\d.]+)\s*%?/i);
    if (capMatch) trySet('capRate', (capMatch[1]||capMatch[3]||''), 'Cap Rate');

    // NOI
    var noiMatch = text.match(/NOI[:\s]*\$?\s*([\d,]+(?:\.\d{0,2})?)|net\s*operating\s*income[:\s]*\$?\s*([\d,]+)/i);
    if (noiMatch) trySet('noi', (noiMatch[1]||noiMatch[2]||'').replace(/,/g,''), 'NOI');

    // Total units
    var unitMatch = text.match(/(\d+)\s*(?:total\s*)?units?(?:\s*total)?|total\s*units?[:\s]*(\d+)/i);
    if (unitMatch) trySet('totalUnits', unitMatch[1]||unitMatch[2], 'Total Units');

    // Year built
    var yrMatch = text.match(/(?:year\s*built|built\s*in|constructed)[:\s]*(\d{4})|(\d{4})\s*(?:year\s*built|construction)/i);
    if (yrMatch) trySet('yearBuilt', yrMatch[1]||yrMatch[2], 'Year Built');

    // Total SF / Square Footage
    var sfMatch = text.match(/([\d,]+)\s*(?:sq\.?\s*ft\.?|SF|square\s*feet)/i);
    if (sfMatch) trySet('totalSF', sfMatch[1].replace(/,/g,''), 'Square Footage');

    // Occupancy
    var occMatch = text.match(/([\d.]+)\s*%\s*(?:occupied|occupancy|leased)|(occupancy|occupi(?:ed|ancy))[:\s]*([\d.]+)\s*%?/i);
    if (occMatch) trySet('occupancy', (occMatch[1]||occMatch[3]||'')+'%', 'Occupancy');

    // Property description — grab substantial paragraph
    var descMatch = text.match(/(?:overview|description|executive\s*summary|property\s*overview|about\s*the\s*property)[:\s\n]*([A-Za-z][\s\S]{80,600}?)(?:\n\n|\r\n\r\n|$)/i);
    if (descMatch) trySet('executiveSummary', descMatch[1].trim().replace(/\s+/g,' '), 'Property Description');

    if (typeof window.recalcMetrics === 'function') window.recalcMetrics();

    // Show confirmation
    var confirmed = populated.filter(function(v) { return v; });
    if (confirmed.length > 0) {
      showGlobalStatus('✓ Extracted: ' + confirmed.join(', ') + '. Review and fill in any missing fields.');
    } else {
      showGlobalStatus('⚠️ Could not extract structured data. Please fill in fields manually.');
    }
  }

  window.exportOMData = function() {
    if (typeof window.gatherOMData === 'function') {
      var data = window.gatherOMData();
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = (document.getElementById('propName1')?.value || 'om_data') + '.json';
      a.click(); URL.revokeObjectURL(url);
      showGlobalStatus('OM data exported');
    }
  };

  // ---- XLSX PARSING HELPER ----
  function readXlsxFile(file, callback) {
    if (typeof XLSX === 'undefined') { showGlobalStatus('XLSX library not loaded'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        callback(rows);
      } catch(err) { showGlobalStatus('Error reading XLSX: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }
  window.readXlsxFile = readXlsxFile;

  function parseCSVRows(text) {
    var lines = text.trim().split('\n');
    return lines.map(function(line) { return line.split(',').map(function(c) { return c.trim().replace(/^["']|["']$/g, ''); }); });
  }
  window.parseCSVRows = parseCSVRows;

  // ---- RENT ROLL UPLOAD ----
  function rrStatus(msg, isError) {
    var el = document.getElementById('rentRollStatus');
    if (!el) return;
    el.style.display = 'block';
    el.style.color = isError ? '#e74c3c' : '#4CAF50';
    el.textContent = msg;
  }

  window.handleRentRollUpload = function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      // PDF text extraction via binary stream parsing
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var text = extractPDFText(e.target.result);
          if (!text || text.replace(/\s/g,'').length < 20) throw new Error('No readable text found — this may be a scanned/image PDF');
          var rows = parseFlatTextRentRoll(text);
          if (!rows || rows.length < 2) throw new Error('No unit data detected. Ensure the PDF contains readable rent roll data (not a scan). Try CSV or XLSX for best results.');
          parseRentRollRows(rows);
        } catch(err) {
          rrStatus('⚠️ ' + err.message + '. For best results, export rent roll as CSV or XLSX.', true);
        }
      };
      reader.onerror = function() { rrStatus('⚠️ Could not read PDF file. Try CSV or XLSX.', true); };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      readXlsxFile(file, function(rows) {
        if (!rows || rows.length < 2) { rrStatus('⚠️ Could not read file or file is empty. Check the format and try again.', true); return; }
        parseRentRollRows(rows);
      });
    } else if (ext === 'csv') {
      var reader = new FileReader();
      reader.onload = function(e) {
        var rows = parseCSVRows(e.target.result);
        if (!rows || rows.length < 2) { rrStatus('⚠️ CSV appears empty or unreadable. Check the file and try again.', true); return; }
        parseRentRollRows(rows);
      };
      reader.onerror = function() { rrStatus('⚠️ Could not read CSV file.', true); };
      reader.readAsText(file);
    } else {
      rrStatus('⚠️ Unsupported file format ".' + ext + '". Please upload a PDF, XLSX, or CSV file.', true);
    }
    input.value = '';
  };

  // ---- PDF TEXT EXTRACTOR ----
  // Extracts visible text from PDF binary using BT...ET stream parsing
  function extractPDFText(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var str = '';
    for (var i = 0; i < Math.min(bytes.length, 500000); i++) {
      str += String.fromCharCode(bytes[i]);
    }
    var texts = [];
    // Match BT...ET content blocks
    var btRe = /BT\s([\s\S]*?)ET/g;
    var m;
    while ((m = btRe.exec(str)) !== null) {
      var block = m[1];
      // Extract string literals: (text) Tj or (text) TJ or [(text)] TJ
      var strRe = /\(([^)]*)\)\s*(?:Tj|TJ|'|")/g;
      var sm;
      var blockTexts = [];
      while ((sm = strRe.exec(block)) !== null) {
        var t = sm[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
        if (t.trim()) blockTexts.push(t.trim());
      }
      if (blockTexts.length) texts.push(blockTexts.join(' '));
    }
    // Fallback: try extracting any printable text lines
    if (texts.length === 0) {
      var printable = str.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/ {3,}/g, '\n');
      texts = printable.split(/\n+/).filter(function(l) { return l.trim().length > 4; });
    }
    return texts.join('\n');
  }

  function parseFlatTextRentRoll(text) {
    var lines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 2; });

    // Strategy: group lines into units by looking for rent amounts and bed/bath patterns
    var unitGroups = [];
    var currentGroup = null;

    var rentPattern = /\$[\d,]+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\/\s*(?:mo|month)/i;
    var unitTypePattern = /(\d+)\s*(?:bed|br|bdrm|bedroom).*?(\d+(?:\.\d)?)\s*(?:bath|ba|bth)/i;
    var datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/;
    var unitNumPattern = /^(?:unit\s*)?#?\s*(\d+[a-z]?)\b/i;

    lines.forEach(function(line) {
      var unitTypeM = line.match(unitTypePattern);
      var unitNumM = line.match(unitNumPattern);
      var hasRent = rentPattern.test(line);
      var hasDate = datePattern.test(line);

      if (unitTypeM || (unitNumM && (hasRent || hasDate))) {
        if (currentGroup) unitGroups.push(currentGroup);
        currentGroup = { lines: [line], unitType: unitTypeM ? (unitTypeM[1] + 'BR/' + unitTypeM[2] + 'BA') : '', unitNum: unitNumM ? unitNumM[1] : '' };
      } else if (currentGroup && (hasRent || hasDate || line.length < 60)) {
        currentGroup.lines.push(line);
      }
    });
    if (currentGroup) unitGroups.push(currentGroup);

    // If no groups found, try a simpler approach: look for dollar amounts on each line
    if (unitGroups.length === 0) {
      lines.forEach(function(line) {
        if (rentPattern.test(line)) {
          unitGroups.push({ lines: [line], unitType: '', unitNum: '' });
        }
      });
    }

    if (unitGroups.length === 0) return null;

    // Now consolidate into unit mix rows (aggregated by type)
    var unitMix = {};
    unitGroups.forEach(function(grp) {
      var fullText = grp.lines.join(' ');
      var typeM = fullText.match(unitTypePattern);
      var type = grp.unitType || (typeM ? (typeM[1] + 'BR/' + typeM[2] + 'BA') : 'Unit');
      var rentM = fullText.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
      var rent = rentM ? parseFloat(rentM[1].replace(/,/g,'')) : 0;
      var sfM = fullText.match(/([\d,]+)\s*(?:sq\.?\s*ft\.?|SF)\b/i);
      var sf = sfM ? parseFloat(sfM[1].replace(/,/g,'')) : 0;
      var isVacant = /vacant|empty|unoccupied/i.test(fullText);
      var dateMatches = fullText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
      var leaseStart = dateMatches[0] || '';
      var leaseEnd = dateMatches[1] || '';
      var tenantM = fullText.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/);
      var tenant = isVacant ? 'Vacant' : (tenantM ? tenantM[0] : '');

      if (!unitMix[type]) unitMix[type] = { type: type, count: 0, sf: sf, rents: [], vacantCount: 0, tenants: [], leaseStarts: [], leaseEnds: [] };
      unitMix[type].count++;
      if (rent > 0) unitMix[type].rents.push(rent);
      if (isVacant) unitMix[type].vacantCount++;
      if (tenant) unitMix[type].tenants.push(tenant);
      if (leaseStart) unitMix[type].leaseStarts.push(leaseStart);
      if (leaseEnd) unitMix[type].leaseEnds.push(leaseEnd);
    });

    // Build rows array: header + one row per unit type
    var rows = [['Unit Type', 'Units', 'Sq Ft', 'Avg Rent', 'Vacancy', 'Sample Tenant', 'Lease Start', 'Lease End']];
    Object.values(unitMix).forEach(function(um) {
      var avgRent = um.rents.length > 0 ? Math.round(um.rents.reduce(function(a,b){return a+b;},0)/um.rents.length) : 0;
      rows.push([
        um.type,
        um.count,
        um.sf || '',
        avgRent || '',
        um.vacantCount,
        um.tenants[0] || '',
        um.leaseStarts[0] || '',
        um.leaseEnds[0] || ''
      ]);
    });
    return rows;
  }

  function parseRentRollRows(rows) {
    if (!rows || rows.length < 2) {
      rrStatus('⚠️ No data rows found. Ensure the file has a header row plus data rows.', true);
      return;
    }
    var tbody = document.getElementById('unitRows');
    if (!tbody) return;

    // Detect column indices from header row
    var headers = rows[0].map(function(h) { return (h||'').toString().toLowerCase().trim(); });
    function findCol() {
      var keywords = Array.prototype.slice.call(arguments);
      for (var i = 0; i < headers.length; i++) {
        for (var k = 0; k < keywords.length; k++) {
          if (headers[i].indexOf(keywords[k]) !== -1) return i;
        }
      }
      return -1;
    }
    var colUnit     = findCol('unit #', 'unit#', 'unit no', 'unit', 'apt', 'type', '#');
    var colBeds     = findCol('beds', 'bed', 'br', 'bdrm', 'bedroom');
    var colBaths    = findCol('baths', 'bath', 'ba', 'bth');
    var colSqft     = findCol('sqft', 'sq ft', 'sf', 'square', 'size');
    var colCurRent  = findCol('current rent', 'cur rent', 'actual rent', 'contract rent', 'monthly rent', 'rent', 'monthly', 'amount', 'rate');
    var colMktRent  = findCol('market rent', 'mkt rent', 'market rate', 'pro forma rent', 'market');
    var colTenant   = findCol('tenant', 'resident', 'lessee', 'occupant', 'name');
    var colStart    = findCol('lease start', 'start date', 'move in', 'begin', 'from', 'commence');
    var colEnd      = findCol('lease end', 'expir', 'end date', 'move out', 'thru');
    var colStatus   = findCol('status', 'occupied', 'vacant', 'vacancy');
    var colSec8     = findCol('section 8', 'sec 8', 'hcv', 'voucher', 'housing');
    var colDeposit  = findCol('deposit', 'security dep', 'sec dep');

    // Fallback positional mapping if key columns not found
    if (colUnit === -1) colUnit = 0;
    if (colCurRent === -1) colCurRent = Math.min(4, headers.length - 1);
    if (colSqft === -1 && headers.length > 2) colSqft = 3;

    var parsed = [];
    var totalUnits = 0, totalVacant = 0, totalCurRent = 0, totalMktRent = 0;
    var sec8Count = 0, sec8Rent = 0;
    tbody.innerHTML = '';

    rows.slice(1).forEach(function(cols) {
      if (!cols || cols.length < 2) return;
      var unit       = colUnit >= 0 ? (cols[colUnit]||'').toString().trim() : '';
      var beds       = colBeds >= 0 ? (cols[colBeds]||'').toString().trim() : '';
      var baths      = colBaths >= 0 ? (cols[colBaths]||'').toString().trim() : '';
      var sqft       = colSqft >= 0 ? (cols[colSqft]||'').toString().replace(/[^0-9.]/g,'') : '';
      var curRent    = colCurRent >= 0 ? parseFloat((cols[colCurRent]||'').toString().replace(/[^0-9.]/g,'')) || 0 : 0;
      var mktRent    = colMktRent >= 0 ? parseFloat((cols[colMktRent]||'').toString().replace(/[^0-9.]/g,'')) || 0 : 0;
      var tenant     = colTenant >= 0 ? (cols[colTenant]||'').toString().trim() : '';
      var leaseStart = colStart >= 0 ? (cols[colStart]||'').toString().trim() : '';
      var leaseEnd   = colEnd >= 0 ? (cols[colEnd]||'').toString().trim() : '';
      var status     = colStatus >= 0 ? (cols[colStatus]||'').toString().trim().toLowerCase() : '';
      var isSec8     = colSec8 >= 0 ? !!(cols[colSec8]||'').toString().trim() : false;
      if (isSec8) { var v = (cols[colSec8]||'').toString().toLowerCase().trim(); isSec8 = v === 'yes' || v === 'y' || v === '1' || v === 'true' || v === 'x'; }
      var deposit    = colDeposit >= 0 ? (cols[colDeposit]||'').toString().replace(/[^0-9.]/g,'') : '';

      var isVacant = status.indexOf('vacant') !== -1 || status.indexOf('v') === 0 || (!tenant && !curRent);
      if (!unit && !curRent && !tenant) return;

      // Derive unit type label from beds/baths if unit column is just a number
      var unitLabel = unit;
      if (beds && !isNaN(parseFloat(beds))) {
        unitLabel = beds + 'BD' + (baths ? '/' + parseFloat(baths) + 'BA' : '') + (unit && unit !== beds ? ' – ' + unit : '');
      }

      var tr = document.createElement('tr');
      var tooltip = (tenant ? 'Tenant: ' + tenant : '') +
                    (leaseStart ? ' | Lease: ' + leaseStart + (leaseEnd ? ' – ' + leaseEnd : '') : '') +
                    (isSec8 ? ' | Sec 8' : '') + (deposit ? ' | Dep: $' + deposit : '');
      tr.innerHTML = '<td><input value="' + unitLabel.replace(/"/g,'&quot;') + '" class="unit-type" title="' + tooltip.replace(/"/g,'&quot;') + '"></td>' +
        '<td><input type="number" value="1" class="unit-count" oninput="recalcMetrics()"></td>' +
        '<td><input type="number" value="' + (sqft||'') + '" class="unit-sqft"></td>' +
        '<td><input type="number" value="' + (curRent||'') + '" class="unit-rent" oninput="recalcMetrics()"></td>';
      tbody.appendChild(tr);

      totalUnits += 1;
      if (isVacant) totalVacant++;
      totalCurRent += curRent;
      totalMktRent += mktRent || curRent;
      if (isSec8) { sec8Count++; sec8Rent += curRent; }
      parsed.push({ unit: unit, beds: beds, baths: baths, sqft: sqft, curRent: curRent, mktRent: mktRent,
                    tenant: tenant, leaseStart: leaseStart, leaseEnd: leaseEnd, status: status, isSec8: isSec8, deposit: deposit, vacant: isVacant });
    });

    if (parsed.length === 0) {
      rrStatus('⚠️ Data found but no rows parsed. For PDF, ensure it is not a scanned image. Try CSV or XLSX for best results.', true);
      return;
    }

    // Auto-populate summary fields
    var occupancyPct = totalUnits > 0 ? Math.round(((totalUnits - totalVacant) / totalUnits) * 100) : 0;
    var vacancyPct = 100 - occupancyPct;
    var lossToLease = totalMktRent - totalCurRent;

    if (document.getElementById('totalUnits') && !document.getElementById('totalUnits').value) document.getElementById('totalUnits').value = totalUnits;
    if (document.getElementById('occupancy') && !document.getElementById('occupancy').value) document.getElementById('occupancy').value = occupancyPct + '%';

    var successMsg = '✓ Imported ' + parsed.length + ' unit' + (parsed.length !== 1 ? 's' : '') +
      ' · Occ: ' + occupancyPct + '%' + (totalVacant ? ' (' + totalVacant + ' vacant)' : '') +
      (totalCurRent > 0 ? ' · Actual Gross Rent: $' + Math.round(totalCurRent).toLocaleString() + '/mo' : '') +
      (lossToLease > 0 ? ' · Loss to Lease: $' + Math.round(lossToLease).toLocaleString() + '/mo' : '') +
      (sec8Count > 0 ? ' · Sec 8: ' + sec8Count + ' units ($' + Math.round(sec8Rent).toLocaleString() + '/mo)' : '');
    rrStatus(successMsg, false);
    showGlobalStatus('Rent roll imported: ' + totalUnits + ' units');
    if (typeof window.recalcMetrics === 'function') window.recalcMetrics();
  }
  // ---- T12 UPLOAD ----
  function t12Status(msg, isError) {
    var el = document.getElementById('t12Status');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(231,76,60,0.15)' : 'rgba(76,175,80,0.15)';
    el.style.color = isError ? '#e74c3c' : '#4CAF50';
    el.textContent = msg;
  }

  window.handleT12Upload = function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var ext = file.name.split('.').pop().toLowerCase();
    t12Status('⏳ Reading ' + file.name + '…', false);

    if (ext === 'xlsx' || ext === 'xls') {
      readXlsxFile(file, function(rows) {
        var key = getClaudeKeyGlobal();
        if (key) {
          var textFromRows = rows.map(function(r){ return r.join('\t'); }).join('\n');
          parseT12WithClaude(textFromRows);
        } else {
          parseT12Rows(rows);
        }
      });
    } else if (ext === 'pdf') {
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = extractPDFText(e.target.result);
        if (!text || text.trim().length < 20) {
          t12Status('⚠️ This PDF appears to be a scanned image — selectable text is required. Try exporting your T12 as CSV or XLSX from your accounting software.', true);
          return;
        }
        var key = getClaudeKeyGlobal();
        if (key) {
          parseT12WithClaude(text);
        } else {
          parseFlatTextT12(text);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      var reader2 = new FileReader();
      reader2.onload = function(e) {
        var key = getClaudeKeyGlobal();
        if (key) {
          parseT12WithClaude(e.target.result);
        } else {
          parseT12Rows(parseCSVRows(e.target.result));
        }
      };
      reader2.readAsText(file);
    }
    input.value = '';
  };

  function parseT12WithClaude(rawText) {
    t12Status('✦ AI is reading your T12…', false);
    var sys = 'You are a commercial real estate financial analyst. The user will give you raw text from a T12 (trailing 12-month) income/expense statement. Extract ALL income line items and ALL expense line items. Return ONLY valid JSON in this exact format, no explanation:\n{"income":[{"label":"Gross Rental Income","amount":123456},...],"expenses":[{"label":"Property Taxes","amount":12000},...]}';
    var prompt = 'Parse this T12 statement and return the JSON:\n\n' + rawText.slice(0, 8000);
    claudeRequest(sys, prompt, function(result) {
      try {
        var clean = result.replace(/```json?/g,'').replace(/```/g,'').trim();
        var parsed = JSON.parse(clean);
        if (!parsed.income && !parsed.expenses) throw new Error('No income or expense data found');
        applyT12Data(parsed.income || [], parsed.expenses || []);
        t12Status('✦ AI imported: ' + (parsed.income||[]).length + ' income lines, ' + (parsed.expenses||[]).length + ' expense lines — review all values before export', false);
        showGlobalStatus('✓ T12 imported via AI — review and adjust as needed');
      } catch(e) {
        t12Status('⚠️ AI could not parse this file. Try exporting as CSV from your accounting software.', true);
      }
    }, function(err) {
      t12Status('⚠️ AI error: ' + err + '. Falling back to standard parser.', true);
      parseFlatTextT12(rawText);
    });
  }

  // Parse flat text from a PDF T12 into income/expense line items
  function parseFlatTextT12(text) {
    var lines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 1; });

    // Keywords that mark section boundaries
    var incomeKeywords = /^(income|revenue|gross rent|rental income|total income|operating income)/i;
    var expenseKeywords = /^(expense|operating expense|total expense|deduction)/i;
    var skipKeywords = /^(net operating|noi|total|page|date|property|month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i;

    // Well-known income line items
    var knownIncome = /gross\s*rent|rental\s*(?:income|revenue)|laundry|parking|storage|late\s*fee|application|other\s*income|miscellaneous\s*income|vacancy\s*(?:loss|credit)|concession/i;
    // Well-known expense line items
    var knownExpense = /tax|insurance|maintenance|repair|management|utility|utilities|electric|gas|water|sewer|trash|landscap|lawn|snow|plowing|advertis|legal|accounting|janitorial|cleaning|pest|reserve|capital|payroll|salary|wage/i;

    var incomes = [], expenses = [], section = 'income';

    lines.forEach(function(line) {
      // Detect section switches
      if (incomeKeywords.test(line) && !line.match(/\d{3,}/)) { section = 'income'; return; }
      if (expenseKeywords.test(line) && !line.match(/\d{3,}/)) { section = 'expense'; return; }

      // Extract numeric values from the line (handles $1,234.56 or 1234.56 patterns)
      var numMatches = line.match(/[\$\(]?\s*[\d,]+(?:\.\d{1,2})?\s*[\)]?/g) || [];
      var values = numMatches.map(function(v) {
        var neg = /^\(/.test(v.trim()) || /\)$/.test(v.trim());
        var n = parseFloat(v.replace(/[^0-9.]/g,'')) || 0;
        return neg ? -n : n;
      }).filter(function(v) { return v !== 0; });

      if (values.length === 0) return;

      // Extract label (text before the first number)
      var labelMatch = line.match(/^([A-Za-z][A-Za-z\s\/\-&'\.]{2,50})/);
      var label = labelMatch ? labelMatch[1].trim().replace(/\s+/g, ' ') : '';
      if (!label || skipKeywords.test(label)) return;

      // Skip summary/total lines
      if (/^total\s/i.test(label) || /^net\s/i.test(label)) return;

      // For monthly layouts (12+ numbers on a line), use last number if it looks like a total,
      // otherwise sum the monthly values (skip the last one if it's a pre-computed total)
      var annual;
      if (values.length >= 12) {
        // Last value is typically the annual total column
        annual = values[values.length - 1];
        // Sanity check: if sum of first 12 ≈ last value, use last value; else sum first 12
        var sumFirst12 = values.slice(0, 12).reduce(function(a,b){return a+b;},0);
        if (Math.abs(sumFirst12 - annual) / (Math.abs(annual) + 1) < 0.15) {
          annual = annual; // use the pre-computed total
        } else {
          annual = sumFirst12;
        }
      } else if (values.length > 1) {
        // Could be partial year or quarterly; sum all
        annual = values.reduce(function(a,b){return a+b;},0);
      } else {
        annual = values[0];
      }

      annual = Math.round(annual);
      if (annual === 0) return;

      // Classify into income or expense based on section context and known keywords
      var forceIncome = knownIncome.test(label);
      var forceExpense = knownExpense.test(label);
      var effectiveSection = forceIncome ? 'income' : (forceExpense ? 'expense' : section);

      if (effectiveSection === 'income') {
        incomes.push({ label: label, amount: Math.abs(annual) });
      } else {
        expenses.push({ label: label, amount: Math.abs(annual) });
      }
    });

    // Deduplicate (sometimes PDF extraction creates duplicate lines)
    function dedup(arr) {
      var seen = {};
      return arr.filter(function(item) {
        var key = item.label.toLowerCase().slice(0, 20);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
    incomes = dedup(incomes);
    expenses = dedup(expenses);

    if (incomes.length === 0 && expenses.length === 0) {
      t12Status('⚠️ Could not identify income or expense line items. Check that the PDF has selectable text (not a scanned image).', true);
      return;
    }

    applyT12Data(incomes, expenses);
  }

  function parseT12Rows(rows) {
    if (!rows || rows.length < 2) {
      t12Status('⚠️ No data found. Make sure the file has a header row and data rows.', true);
      return;
    }

    var incomes = [], expenses = [], section = 'income';
    // Determine if monthly layout: look at max column count in data rows
    var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 0);
    // Monthly if we have 13+ columns (label + 12 months) or 14+ (label + 12 months + total)
    var isMonthly = maxCols >= 13;

    rows.slice(1).forEach(function(cols) {
      var label = (cols[0]||'').toString().trim();
      if (!label) return;

      var lc = label.toLowerCase();
      // Section markers
      if (lc.match(/^(?:operating\s+)?expense/)) { section = 'expense'; return; }
      if (lc.match(/^(?:total\s+)?income|^revenue/)) { section = 'income'; return; }
      // Skip total/NOI summary rows
      if (lc.match(/^(?:total|net\s+operating|noi|gross\s+(?:income|revenue))/)) return;

      // Parse numeric values from columns 1..end
      var values = [];
      for (var i = 1; i < cols.length; i++) {
        var raw = (cols[i]||'').toString().replace(/[^0-9.\-]/g,'');
        var v = parseFloat(raw) || 0;
        values.push(v);
      }
      if (values.length === 0) return;

      var annual;
      if (isMonthly && values.length >= 12) {
        // If last column is close to sum of 12 months, it's the annual total column
        var sumMonths = values.slice(0, 12).reduce(function(a,b){return a+b;},0);
        var lastVal = values[values.length - 1];
        if (values.length >= 13 && Math.abs(sumMonths - lastVal) / (Math.abs(lastVal) + 1) < 0.15) {
          annual = lastVal;
        } else {
          annual = sumMonths;
        }
      } else {
        annual = values[0] || values.reduce(function(a,b){return a+b;},0);
      }

      annual = Math.round(annual);
      if (annual === 0) return;

      if (section === 'income') incomes.push({ label: label, amount: Math.abs(annual) });
      else expenses.push({ label: label, amount: Math.abs(annual) });
    });

    applyT12Data(incomes, expenses);
  }

  function applyT12Data(incomes, expenses) {
    if (incomes.length > 0) {
      var totalIncome = incomes.reduce(function(s,i){return s+i.amount;},0);
      var el = document.getElementById('curTotalIncome');
      if (el) el.value = totalIncome;
    }
    if (expenses.length > 0) {
      if (typeof window.curExpenses !== 'undefined') {
        window.curExpenses = expenses;
        if (typeof window.renderExpenseRows === 'function') window.renderExpenseRows('cur');
      }
    }
    if (typeof window.calcNOI === 'function') window.calcNOI('cur');

    var totalIncome = incomes.reduce(function(s,i){return s+i.amount;},0);
    var totalExpense = expenses.reduce(function(s,e){return s+e.amount;},0);
    var noi = totalIncome - totalExpense;
    var summary = '✓ T12 imported: ' + incomes.length + ' income line' + (incomes.length !== 1 ? 's' : '') +
      ' ($' + totalIncome.toLocaleString() + '), ' +
      expenses.length + ' expense line' + (expenses.length !== 1 ? 's' : '') +
      ' ($' + totalExpense.toLocaleString() + ')' +
      (noi !== 0 ? ' · NOI: $' + noi.toLocaleString() : '');
    t12Status(summary, false);
    showGlobalStatus('T12 imported: income $' + totalIncome.toLocaleString() + ', expenses $' + totalExpense.toLocaleString());
  }

  // ---- EMPLOYERS AUTO-POPULATE ----
  var employerData = [];
  var industryData = [];

  window.autoPopulateEmployers = function() {
    var city = (document.getElementById('mktCity')?.value || '').trim();
    var statusEl = document.getElementById('employerAutoStatus');
    if (!city) {
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.background = 'rgba(255,193,7,0.15)'; statusEl.style.color = '#FFC107'; statusEl.textContent = '\u26A0\uFE0F Please enter a city in the Market tab fields above first.'; }
      return;
    }
    var matched = matchCity(city);
    if (matched && EMPLOYER_DB[matched]) {
      var db = EMPLOYER_DB[matched];
      employerData = db.employers.map(function(e) { return { name: e.name, employees: e.employees, industry: e.industry, logo: e.logo }; });
      industryData = db.industries || [];
      renderEmployers();
      renderIndustries();
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.background = 'rgba(76,175,80,0.15)'; statusEl.style.color = '#4CAF50'; statusEl.textContent = '\u2705 Loaded ' + employerData.length + ' employers for ' + matched.charAt(0).toUpperCase() + matched.slice(1) + ' from built-in database. You can edit or add more.'; }
      showGlobalStatus('Employers loaded for ' + matched);
    } else {
      if (statusEl) { statusEl.style.display = 'block'; statusEl.style.background = 'rgba(255,193,7,0.15)'; statusEl.style.color = '#FFC107'; statusEl.textContent = '\u26A0\uFE0F "' + city + '" not found in database. Covered cities: ' + Object.keys(EMPLOYER_DB).map(function(k){return k.charAt(0).toUpperCase()+k.slice(1);}).join(', ') + '. Add employers manually below.'; }
    }
  };

  window.addEmployer = function() {
    employerData.push({ name: '', employees: '', industry: '', logo: '\u{1F3E2}' });
    renderEmployers();
  };

  function renderEmployers() {
    var container = document.getElementById('employerRows');
    if (!container) return;
    container.innerHTML = '';
    employerData.forEach(function(emp, i) {
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:center';
      div.innerHTML = '<span style="font-size:20px;min-width:28px;text-align:center">' + (emp.logo || '\u{1F3E2}') + '</span>' +
        '<input value="' + (emp.name||'') + '" onchange="employerData['+i+'].name=this.value" placeholder="Company name" style="flex:2;background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 10px;color:white;font-size:13px">' +
        '<input value="' + (emp.employees||'') + '" onchange="employerData['+i+'].employees=this.value" placeholder="Employees" style="flex:0.7;background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 10px;color:white;font-size:13px">' +
        '<input value="' + (emp.industry||'') + '" onchange="employerData['+i+'].industry=this.value" placeholder="Industry" style="flex:1;background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 10px;color:white;font-size:13px">' +
        '<button onclick="employerData.splice('+i+',1);renderEmployers()" style="background:none;border:none;color:var(--brand-gray);cursor:pointer;font-size:16px">\u2715</button>';
      container.appendChild(div);
    });
  }

  function renderIndustries() {
    var container = document.getElementById('industryBreakdown');
    if (!container || industryData.length === 0) return;
    container.innerHTML = '';
    industryData.forEach(function(ind) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px';
      row.innerHTML = '<span style="font-size:13px;color:var(--brand-cream);min-width:200px">' + ind.name + '</span>' +
        '<div style="flex:1;background:rgba(162,182,192,0.15);border-radius:4px;height:20px;overflow:hidden"><div style="width:' + ind.pct + '%;background:var(--brand-blue);height:100%;border-radius:4px;transition:width 0.5s"></div></div>' +
        '<span style="font-size:12px;color:var(--brand-gray);min-width:36px;text-align:right">' + ind.pct + '%</span>';
      container.appendChild(row);
    });
  }

  window.toggleEmployerSection = function() {
    var content = document.getElementById('employerSectionContent');
    var toggle = document.getElementById('employerToggle');
    if (content) content.style.display = toggle && toggle.checked ? 'block' : 'none';
  };

  window.employerData = employerData;
  window.industryData = industryData;
  window.renderEmployers = renderEmployers;
  window.renderIndustries = renderIndustries;

  // ---- CLAUDE API HELPER ----
  function getClaudeKey() {
    return (localStorage.getItem('gw_claude_api_key') || '').trim();
  }

  function claudeRequest(systemPrompt, userPrompt, onResult, onError) {
    var key = getClaudeKey();
    if (!key) { onError('No API key provided.'); return; }
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    }).then(function(r) {
      if (!r.ok) { return r.json().then(function(e){ throw new Error(e.error && e.error.message || ('HTTP ' + r.status)); }); }
      return r.json();
    }).then(function(data) {
      var text = data.content && data.content[0] && data.content[0].text || '';
      onResult(text.trim());
    }).catch(function(err) { onError(err.message || String(err)); });
  }

  // ---- INJECT AGENT BIO PANEL (TAB 10) ----
  function injectAgentBioPanel() {
    var container = document.querySelector('#page-multifamily');
    if (!container) return;
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'tab10';
    panel.style.cssText = 'display:none';
    panel.innerHTML =
      '<div class="section-title">About the Agent(s)</div>' +
      '<p style="color:var(--brand-gray);font-size:13px;margin-bottom:16px">Build detailed agent bio pages for the OM. Profiles save locally by email address.</p>' +
      '<div id="agentBioList"></div>' +
      '<button class="btn-sm" onclick="addAgentBioCard()" style="margin-top:8px">+ Add Agent Bio</button>';
    container.appendChild(panel);
    // Render one blank card to start
    setTimeout(function() { addAgentBioCard(); }, 50);
  }

  var _agentBioCards = [];

  window.addAgentBioCard = function() {
    if (_agentBioCards.length >= 4) { showGlobalStatus('Maximum 4 agents supported'); return; }
    var idx = _agentBioCards.length;
    var id = 'abc' + idx;
    _agentBioCards.push({ id: id });
    var container = document.getElementById('agentBioList');
    if (!container) return;
    var card = document.createElement('div');
    card.id = id;
    card.style.cssText = 'border:1px solid rgba(162,182,192,0.2);border-radius:10px;padding:16px;margin-bottom:16px;background:rgba(30,47,57,0.4)';
    if (idx === 0) card.style.borderColor = 'var(--brand-gold,#C8A84B)';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<span style="font-size:13px;font-weight:600;color:var(--brand-cream)">' + (idx === 0 ? '★ Primary Agent' : 'Agent ' + (idx + 1)) + '</span>' +
        (idx > 0 ? '<button class="btn-sm" style="padding:2px 10px;font-size:11px" onclick="removeAgentBioCard(\'' + id + '\')">✕ Remove</button>' : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div>' +
          '<div style="margin-bottom:10px;text-align:center">' +
            '<div id="' + id + '_photoPreview" style="width:120px;height:150px;border-radius:10px;background:rgba(162,182,192,0.1);border:2px dashed rgba(162,182,192,0.3);margin:0 auto 6px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden" onclick="document.getElementById(\'' + id + '_photoInput\').click()">' +
              '<span style="color:var(--brand-gray);font-size:12px">Click to upload</span>' +
            '</div>' +
            '<input type="file" id="' + id + '_photoInput" accept="image/*" style="display:none" onchange="previewAgentPhoto(\'' + id + '\',this)">' +
          '</div>' +
          '<div class="form-row"><label>Full Name</label><input id="' + id + '_name" placeholder="Jane Smith" oninput="autoSaveAgentBio(\'' + id + '\')"></div>' +
          '<div class="form-row"><label>Title</label><input id="' + id + '_title" placeholder="Senior Advisor" oninput="autoSaveAgentBio(\'' + id + '\')"></div>' +
          '<div class="form-row"><label>Phone</label><input id="' + id + '_phone" placeholder="(712) 555-0100" oninput="autoSaveAgentBio(\'' + id + '\')"></div>' +
          '<div class="form-row"><label>Email</label><input id="' + id + '_email" type="email" placeholder="jane@gatewayrea.com" oninput="autoSaveAgentBio(\'' + id + '\')"></div>' +
          '<div class="form-row"><label>License #</label><input id="' + id + '_license" placeholder="B12345" oninput="autoSaveAgentBio(\'' + id + '\')"></div>' +
          '<div class="form-row"><label>QR Code URL</label><input id="' + id + '_qrurl" placeholder="https://..." oninput="renderQR(\'' + id + '\')"></div>' +
          '<div id="' + id + '_qr" style="margin-top:6px;text-align:center"></div>' +
        '</div>' +
        '<div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
            '<label style="font-size:12px;color:var(--brand-gray);text-transform:uppercase;letter-spacing:1px">Bio / Area of Expertise</label>' +
            '<button class="btn-sm" style="font-size:11px;padding:2px 10px;background:linear-gradient(135deg,#1E2F39,#2a4a5a);border:1px solid var(--brand-blue)" onclick="writeBioAI(\'' + id + '\')">✦ Write Bio</button>' +
          '</div>' +
          '<textarea id="' + id + '_bio" rows="5" placeholder="Specializes in multifamily and commercial investment properties..." style="width:100%;margin-bottom:8px" oninput="autoSaveAgentBio(\'' + id + '\')"></textarea>' +
          '<div id="' + id + '_aiIndicator" style="display:none;font-size:11px;color:var(--brand-blue);margin-bottom:6px">✦ AI Generated — review before export</div>' +
          '<div class="form-row"><label>Professional Accomplishments</label>' +
            '<textarea id="' + id + '_accomplishments" rows="3" placeholder="Top Producer 2023, $50M+ in transactions..." oninput="autoSaveAgentBio(\'' + id + '\')"></textarea></div>' +
          '<div class="form-row"><label>Affiliations</label>' +
            '<textarea id="' + id + '_affiliations" rows="2" placeholder="NAR, Iowa Association of Realtors..." oninput="autoSaveAgentBio(\'' + id + '\')"></textarea></div>' +
          '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
            '<button class="btn-sm" onclick="saveAgentProfile(\'' + id + '\')">💾 Save Profile</button>' +
            '<button class="btn-sm" onclick="loadAgentProfile(\'' + id + '\')">📂 Load Saved</button>' +
            '<button class="btn-sm" style="background:linear-gradient(135deg,#1E2F39,#2a4a5a);border-color:#C8A84B;color:#C8A84B" onclick="publishAgentProfile(\'' + id + '\')">🌐 Publish to Roster</button>' +
            '<button class="btn-sm" style="background:linear-gradient(135deg,#1E2F39,#2a4a5a);border-color:#5a9aaa;color:#aaccd8" onclick="loadAgentFromRoster(\'' + id + '\')">👥 Load from Roster</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    container.appendChild(card);
  };

  window.removeAgentBioCard = function(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
    _agentBioCards = _agentBioCards.filter(function(c){ return c.id !== id; });
  };

  window.previewAgentPhoto = function(id, input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var preview = document.getElementById(id + '_photoPreview');
      if (preview) { preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover">'; }
      var photoData = document.getElementById(id + '_photoData');
      if (!photoData) {
        photoData = document.createElement('input');
        photoData.type = 'hidden';
        photoData.id = id + '_photoData';
        var card = document.getElementById(id);
        if (card) card.appendChild(photoData);
      }
      photoData.value = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.renderQR = function(id) {
    var url = (document.getElementById(id + '_qrurl') || {}).value || '';
    var container = document.getElementById(id + '_qr');
    if (!container) return;
    if (!url) { container.innerHTML = ''; return; }
    if (typeof qrcode !== 'undefined') {
      try {
        var qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        container.innerHTML = qr.createImgTag(3);
      } catch(e) { container.innerHTML = ''; }
    }
  };

  window.writeBioAI = function(id) {
    var name = (document.getElementById(id + '_name') || {}).value || 'the agent';
    var title = (document.getElementById(id + '_title') || {}).value || 'Real Estate Advisor';
    var accomplishments = (document.getElementById(id + '_accomplishments') || {}).value || '';
    var affiliations = (document.getElementById(id + '_affiliations') || {}).value || '';
    var propName = ((document.getElementById('propName1') || {}).value || '') + ' ' + ((document.getElementById('propName2') || {}).value || '');
    var btn = document.querySelector('#' + id + ' button[onclick*="writeBioAI"]');
    if (btn) { btn.textContent = '⏳ Writing...'; btn.disabled = true; }
    var sys = 'You are a professional real estate marketing copywriter specializing in agent bios for commercial and multifamily investment sales. Write in a confident, professional tone. Be concise (3-4 sentences max).';
    var prompt = 'Write a professional real estate agent bio for: Name: ' + name + ', Title: ' + title +
      (accomplishments ? ', Accomplishments: ' + accomplishments : '') +
      (affiliations ? ', Affiliations: ' + affiliations : '') +
      '. The agent works at Gateway Real Estate Advisors.';
    claudeRequest(sys, prompt, function(text) {
      var el = document.getElementById(id + '_bio');
      if (el) el.value = text;
      var ind = document.getElementById(id + '_aiIndicator');
      if (ind) { ind.style.display = 'block'; setTimeout(function(){ ind.style.display='none'; }, 10000); }
      if (btn) { btn.textContent = '✦ Write Bio'; btn.disabled = false; }
      autoSaveAgentBio(id);
    }, function(err) {
      showGlobalStatus('AI error: ' + err);
      if (btn) { btn.textContent = '✦ Write Bio'; btn.disabled = false; }
    });
  };

  window.autoSaveAgentBio = function(id) {
    var email = (document.getElementById(id + '_email') || {}).value || '';
    if (!email) return;
    saveAgentProfile(id, true);
  };

  window.saveAgentProfile = function(id, silent) {
    var email = (document.getElementById(id + '_email') || {}).value || '';
    if (!email) { if (!silent) showGlobalStatus('Enter an email address to save the profile'); return; }
    var profile = {
      name: (document.getElementById(id + '_name') || {}).value || '',
      title: (document.getElementById(id + '_title') || {}).value || '',
      phone: (document.getElementById(id + '_phone') || {}).value || '',
      email: email,
      license: (document.getElementById(id + '_license') || {}).value || '',
      qrurl: (document.getElementById(id + '_qrurl') || {}).value || '',
      bio: (document.getElementById(id + '_bio') || {}).value || '',
      accomplishments: (document.getElementById(id + '_accomplishments') || {}).value || '',
      affiliations: (document.getElementById(id + '_affiliations') || {}).value || '',
      photo: (document.getElementById(id + '_photoData') || {}).value || ''
    };
    localStorage.setItem('gateway_agent_profile_' + email.toLowerCase(), JSON.stringify(profile));
    if (!silent) showGlobalStatus('Profile saved for ' + email);
  };

  window.loadAgentProfile = function(id) {
    // Build list of saved profiles
    var profiles = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('gateway_agent_profile_') === 0) {
        try { var p = JSON.parse(localStorage.getItem(key)); if (p && p.email) profiles.push(p); } catch(e) {}
      }
    }
    if (profiles.length === 0) { showGlobalStatus('No saved profiles found'); return; }
    var options = profiles.map(function(p, i){ return i + ': ' + (p.name || p.email); }).join('\n');
    var choice = prompt('Select profile number:\n' + options);
    var idx2 = parseInt(choice);
    if (isNaN(idx2) || idx2 < 0 || idx2 >= profiles.length) return;
    var p2 = profiles[idx2];
    var fields = ['name','title','phone','email','license','qrurl','bio','accomplishments','affiliations'];
    fields.forEach(function(f) {
      var el = document.getElementById(id + '_' + f);
      if (el && p2[f]) el.value = p2[f];
    });
    if (p2.photo) {
      var preview = document.getElementById(id + '_photoPreview');
      if (preview) preview.innerHTML = '<img src="' + p2.photo + '" style="width:100%;height:100%;object-fit:cover">';
      var photoData = document.getElementById(id + '_photoData');
      if (!photoData) {
        photoData = document.createElement('input');
        photoData.type = 'hidden';
        photoData.id = id + '_photoData';
        var card = document.getElementById(id);
        if (card) card.appendChild(photoData);
      }
      photoData.value = p2.photo;
    }
    if (p2.qrurl) renderQR(id);
    showGlobalStatus('Profile loaded: ' + (p2.name || p2.email));
  };

  // ── SHARED TEAM ROSTER (GitHub-backed) ───────────────────────────────────
  var GW_ROSTER_REPO   = 'gatewayhq/gatewayhq.github.io';
  var GW_ROSTER_PATH   = 'data/agents.json';
  var GW_ROSTER_BRANCH = 'main';

  async function gwFetchRoster() {
    var url = 'https://raw.githubusercontent.com/' + GW_ROSTER_REPO + '/' + GW_ROSTER_BRANCH + '/' + GW_ROSTER_PATH + '?t=' + Date.now();
    try {
      var res = await fetch(url);
      if (!res.ok) return { agents: [] };
      return await res.json();
    } catch(e) { return { agents: [] }; }
  }

  window.gwPublishToRoster = async function(profile) {
    var token = (localStorage.getItem('gh_pat') || '').trim();
    if (!token) {
      showGlobalStatus('Add your GitHub token (Video Generator → ⚙ Settings) to publish to the team roster.');
      return false;
    }
    if (!profile.email) { showGlobalStatus('Agent must have an email address to publish.'); return false; }
    showGlobalStatus('Publishing ' + (profile.name || profile.email) + ' to team roster…');
    try {
      var metaRes = await fetch('https://api.github.com/repos/' + GW_ROSTER_REPO + '/contents/' + GW_ROSTER_PATH, {
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
      });
      var currentSHA = null;
      var roster = { agents: [] };
      if (metaRes.ok) {
        var meta = await metaRes.json();
        currentSHA = meta.sha;
        try {
          var decoded = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
          roster = JSON.parse(decoded);
          if (!roster.agents) roster.agents = [];
        } catch(e) {}
      }
      var idx = roster.agents.findIndex(function(a) { return (a.email||'').toLowerCase() === profile.email.toLowerCase(); });
      var entry = Object.assign({}, profile, { updatedAt: new Date().toISOString() });
      if (idx >= 0) roster.agents[idx] = entry; else roster.agents.push(entry);
      var content = btoa(unescape(encodeURIComponent(JSON.stringify(roster, null, 2))));
      var body = { message: 'Update agent roster: ' + (profile.name || profile.email), content: content, branch: GW_ROSTER_BRANCH };
      if (currentSHA) body.sha = currentSHA;
      var putRes = await fetch('https://api.github.com/repos/' + GW_ROSTER_REPO + '/contents/' + GW_ROSTER_PATH, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
        body: JSON.stringify(body)
      });
      if (!putRes.ok) { var e2 = await putRes.json(); throw new Error(e2.message || putRes.status); }
      showGlobalStatus('✅ ' + (profile.name || profile.email) + ' published to team roster!');
      return true;
    } catch(e) {
      showGlobalStatus('Roster publish failed: ' + e.message);
      return false;
    }
  };

  window.gwOpenRosterModal = async function(onLoadCallback) {
    var existing = document.getElementById('gw-roster-modal-wrap');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'gw-roster-modal-wrap';
    wrap.className = 'gw-roster-modal-wrap';
    wrap.innerHTML =
      '<div class="gw-roster-modal">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
          '<h3>👥 Team Roster</h3>' +
          '<button onclick="document.getElementById(\'gw-roster-modal-wrap\').remove()" style="background:none;border:none;color:var(--brand-gray);font-size:22px;cursor:pointer;line-height:1;padding:0">&times;</button>' +
        '</div>' +
        '<div class="gw-roster-list" id="gw-roster-list"><div style="text-align:center;padding:40px 0;color:var(--brand-gray);font-size:13px">Loading roster…</div></div>' +
      '</div>';
    wrap.addEventListener('click', function(e) { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);

    var roster = await gwFetchRoster();
    var list = document.getElementById('gw-roster-list');
    if (!list) return;
    if (!roster.agents || roster.agents.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--brand-gray);font-size:13px">No agents in the roster yet.<br><br>Use <strong>🌐 Publish to Roster</strong> on an agent profile to add them.</div>';
      return;
    }
    window._gwRosterAgents = roster.agents;
    window._gwRosterOnLoad = onLoadCallback;
    list.innerHTML = roster.agents.map(function(a, i) {
      return '<div class="gw-roster-card">' +
        '<div class="gw-roster-avatar">' + (a.photo ? '<img src="' + a.photo + '">' : '<span style="font-size:22px">👤</span>') + '</div>' +
        '<div class="gw-roster-info">' +
          '<div class="gw-roster-name">' + (a.name || '—') + '</div>' +
          '<div class="gw-roster-sub">' + [a.title, a.phone].filter(Boolean).join(' · ') + '</div>' +
          '<div class="gw-roster-email">' + (a.email || '') + '</div>' +
        '</div>' +
        '<button class="btn-sm" style="flex-shrink:0;white-space:nowrap" onclick="gwRosterLoadAgent(' + i + ')">Load →</button>' +
      '</div>';
    }).join('');
  };

  window.gwRosterLoadAgent = function(i) {
    var agents = window._gwRosterAgents || [];
    var cb = window._gwRosterOnLoad;
    var a = agents[i];
    if (!a) return;
    var wrap = document.getElementById('gw-roster-modal-wrap');
    if (wrap) wrap.remove();
    if (cb) cb(a);
  };

  // OM agent-specific roster actions
  window.publishAgentProfile = function(id) {
    var email = (document.getElementById(id + '_email') || {}).value || '';
    if (!email) { showGlobalStatus('Enter the agent\'s email address first.'); return; }
    saveAgentProfile(id, true);
    var profile = {};
    try { profile = JSON.parse(localStorage.getItem('gateway_agent_profile_' + email.toLowerCase()) || '{}'); } catch(e) {}
    gwPublishToRoster(profile);
  };

  window.loadAgentFromRoster = function(id) {
    gwOpenRosterModal(function(a) {
      var fields = ['name','title','phone','email','license','qrurl','bio','accomplishments','affiliations'];
      fields.forEach(function(f) {
        var el = document.getElementById(id + '_' + f);
        if (el && a[f] != null) el.value = a[f];
      });
      if (a.photo) {
        var preview = document.getElementById(id + '_photoPreview');
        if (preview) preview.innerHTML = '<img src="' + a.photo + '" style="width:100%;height:100%;object-fit:cover">';
        var pd = document.getElementById(id + '_photoData');
        if (!pd) {
          pd = document.createElement('input');
          pd.type = 'hidden';
          pd.id = id + '_photoData';
          var card = document.getElementById(id);
          if (card) card.appendChild(pd);
        }
        pd.value = a.photo;
      }
      if (a.qrurl) renderQR(id);
      showGlobalStatus('Loaded ' + (a.name || a.email) + ' from team roster.');
    });
  };

  // ── SHARED TEAM ROSTER — SM agent wrappers ───────────────────────────────
  window.gwSmPublishToRoster = function(i) {
    var a = smAgents[i] || {};
    if (!a.email) { showGlobalStatus('Enter the agent\'s email first.'); return; }
    gwPublishToRoster({
      name: a.name || '', title: a.title || '', phone: a.phone || '',
      email: a.email, license: a.license || '', photo: a.photo || '',
      bio: '', accomplishments: '', affiliations: '', qrurl: ''
    });
  };

  window.gwSmLoadFromRoster = function(i) {
    gwOpenRosterModal(function(a) {
      smAgents[i] = Object.assign(smAgents[i] || {}, {
        name: a.name || '', title: a.title || '', phone: a.phone || '',
        email: a.email || '', license: a.license || '', photo: a.photo || ''
      });
      renderSocialAgents();
      updateSocialPreview();
      showGlobalStatus('Loaded ' + (a.name || a.email) + ' from team roster.');
    });
  };

  // ---- INJECT ABOUT GATEWAY PANEL (TAB 11) ----
  var _gwAdminUnlocked = false;
  // Password reads from config.js (adminPassword field) → localStorage → fallback
  var GW_ADMIN_PASS = localStorage.getItem('gw_admin_pass') || (window.CONFIG && window.CONFIG.adminPassword) || 'gateway2025';

  function injectGatewayPanel() {
    var container = document.querySelector('#page-multifamily');
    if (!container) return;
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'tab11';
    panel.style.cssText = 'display:none';

    // Try loading saved data
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('gateway_about_company') || '{}'); } catch(e) {}
    var services = saved.services || 'Investment Sales · Multifamily · Commercial · Land · 1031 Exchange Advisory';
    var additionalServices = saved.additionalServices || 'Buyer Representation · Seller Representation · Market Analysis · Lease Advisory';
    var stat1v = saved.stat1v || '$1B+'; var stat1l = saved.stat1l || 'Total Transaction Volume';
    var stat2v = saved.stat2v || '500+'; var stat2l = saved.stat2l || 'Transactions Closed';
    var stat3v = saved.stat3v || '20+'; var stat3l = saved.stat3l || 'Years Experience';
    var stat4v = saved.stat4v || '4'; var stat4l = saved.stat4l || 'States Covered';
    var para1 = saved.para1 || 'Gateway Real Estate Advisors is a boutique commercial real estate brokerage specializing in investment sales across the Midwest. Our team combines deep local market knowledge with institutional-grade analysis to deliver superior results for our clients.';
    var para2 = saved.para2 || 'We represent owners, buyers, and investors across multifamily, commercial, industrial, and land asset classes. Our advisors average over 10 years of experience and have facilitated hundreds of transactions valued at over $1 billion in aggregate.';
    var supportTeam = saved.supportTeam || '';
    var readonlyAttr = _gwAdminUnlocked ? '' : 'readonly';
    var editBtnStyle = _gwAdminUnlocked ? 'display:none' : '';
    var saveBtnStyle = _gwAdminUnlocked ? '' : 'display:none';

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
        '<div class="section-title" style="margin:0">About Gateway Real Estate Advisors</div>' +
        '<div id="gwAdminBar" style="display:flex;gap:8px;align-items:center">' +
          '<span id="gwAdminBadge" style="font-size:11px;color:var(--brand-gray);' + (readonlyAttr ? '' : 'display:none') + '">🔒 Read-only</span>' +
          '<button id="gwEditBtn" class="btn-sm" style="font-size:11px;' + editBtnStyle + '" onclick="unlockGatewayEdit()">🔓 Admin Edit</button>' +
          '<button id="gwSaveBtn" class="btn-sm" style="font-size:11px;background:var(--brand-gold,#C8A84B);color:#1E2F39;' + saveBtnStyle + '" onclick="saveGatewayData()">💾 Save Changes</button>' +
        '</div>' +
      '</div>' +
      '<p style="color:var(--brand-gray);font-size:13px;margin-bottom:16px">This page auto-loads for all agents in the OM export. Admin login required to edit.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
        '<div style="background:var(--brand-navy,#1E2F39);border-radius:10px;padding:16px">' +
          '<div class="form-row"><label>Office Photo URL</label>' +
            '<input id="gw_officePhoto" placeholder="https://... or upload below" ' + readonlyAttr + ' value="' + (saved.officePhoto||'').replace(/"/g,'&quot;') + '">' +
          '</div>' +
          '<div class="form-row" style="margin-top:8px"><label>Investment Sales / Primary Services</label>' +
            '<textarea id="gw_services" rows="3" ' + readonlyAttr + '>' + services + '</textarea>' +
          '</div>' +
          '<div class="form-row"><label>Additional Services</label>' +
            '<textarea id="gw_additionalServices" rows="2" ' + readonlyAttr + '>' + additionalServices + '</textarea>' +
          '</div>' +
          '<div style="margin-top:12px"><div style="font-size:11px;color:var(--brand-gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Company Stats</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
              '<div style="text-align:center;background:rgba(162,182,192,0.08);border-radius:8px;padding:8px">' +
                '<input id="gw_stat1v" value="' + stat1v + '" ' + readonlyAttr + ' style="text-align:center;font-size:22px;font-weight:200;color:var(--brand-cream);border:none;background:transparent;width:100%">' +
                '<input id="gw_stat1l" value="' + stat1l + '" ' + readonlyAttr + ' style="text-align:center;font-size:10px;color:var(--brand-gray);border:none;background:transparent;width:100%;letter-spacing:1px">' +
              '</div>' +
              '<div style="text-align:center;background:rgba(162,182,192,0.08);border-radius:8px;padding:8px">' +
                '<input id="gw_stat2v" value="' + stat2v + '" ' + readonlyAttr + ' style="text-align:center;font-size:22px;font-weight:200;color:var(--brand-cream);border:none;background:transparent;width:100%">' +
                '<input id="gw_stat2l" value="' + stat2l + '" ' + readonlyAttr + ' style="text-align:center;font-size:10px;color:var(--brand-gray);border:none;background:transparent;width:100%;letter-spacing:1px">' +
              '</div>' +
              '<div style="text-align:center;background:rgba(162,182,192,0.08);border-radius:8px;padding:8px">' +
                '<input id="gw_stat3v" value="' + stat3v + '" ' + readonlyAttr + ' style="text-align:center;font-size:22px;font-weight:200;color:var(--brand-cream);border:none;background:transparent;width:100%">' +
                '<input id="gw_stat3l" value="' + stat3l + '" ' + readonlyAttr + ' style="text-align:center;font-size:10px;color:var(--brand-gray);border:none;background:transparent;width:100%;letter-spacing:1px">' +
              '</div>' +
              '<div style="text-align:center;background:rgba(162,182,192,0.08);border-radius:8px;padding:8px">' +
                '<input id="gw_stat4v" value="' + stat4v + '" ' + readonlyAttr + ' style="text-align:center;font-size:22px;font-weight:200;color:var(--brand-cream);border:none;background:transparent;width:100%">' +
                '<input id="gw_stat4l" value="' + stat4l + '" ' + readonlyAttr + ' style="text-align:center;font-size:10px;color:var(--brand-gray);border:none;background:transparent;width:100%;letter-spacing:1px">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="border-radius:10px;padding:16px;background:rgba(228,227,212,0.05);border:1px solid rgba(162,182,192,0.15)">' +
          '<div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--brand-gray);margin-bottom:6px">WHO WE ARE</div>' +
          '<textarea id="gw_para1" rows="4" ' + readonlyAttr + ' style="margin-bottom:10px">' + para1 + '</textarea>' +
          '<textarea id="gw_para2" rows="4" ' + readonlyAttr + '>' + para2 + '</textarea>' +
          '<div style="margin-top:14px"><div style="font-size:11px;color:var(--brand-gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Support Team</div>' +
            '<div id="gwSupportTeam"></div>' +
            '<button id="gwAddSupportBtn" class="btn-sm" style="font-size:11px;margin-top:6px;' + saveBtnStyle + '" onclick="addGWSupportMember()">+ Add Member</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    container.appendChild(panel);
    // Render support team
    if (saved.supportTeamMembers) {
      _gwSupportMembers = saved.supportTeamMembers;
      renderGWSupportTeam();
    }
  }

  var _gwSupportMembers = [];

  window.unlockGatewayEdit = function() {
    // Re-read dynamically so config.js or localStorage changes take effect immediately
    var currentPass = localStorage.getItem('gw_admin_pass') || (window.CONFIG && window.CONFIG.adminPassword) || 'gateway2025';
    var pass = prompt('Enter admin password:');
    if (pass === currentPass) {
      _gwAdminUnlocked = true;
      // Enable all fields
      ['gw_officePhoto','gw_services','gw_additionalServices','gw_para1','gw_para2',
       'gw_stat1v','gw_stat1l','gw_stat2v','gw_stat2l','gw_stat3v','gw_stat3l','gw_stat4v','gw_stat4l'].forEach(function(id2) {
        var el = document.getElementById(id2);
        if (el) el.removeAttribute('readonly');
      });
      var badge = document.getElementById('gwAdminBadge');
      var editBtn = document.getElementById('gwEditBtn');
      var saveBtn = document.getElementById('gwSaveBtn');
      var addBtn = document.getElementById('gwAddSupportBtn');
      if (badge) badge.style.display = 'none';
      if (editBtn) editBtn.style.display = 'none';
      if (saveBtn) saveBtn.style.display = '';
      if (addBtn) addBtn.style.display = '';
      renderGWSupportTeam();
      showGlobalStatus('Admin mode unlocked');
    } else {
      showGlobalStatus('Incorrect password');
    }
  };

  window.saveGatewayData = function() {
    var data = {
      officePhoto: (document.getElementById('gw_officePhoto')||{}).value||'',
      services: (document.getElementById('gw_services')||{}).value||'',
      additionalServices: (document.getElementById('gw_additionalServices')||{}).value||'',
      stat1v: (document.getElementById('gw_stat1v')||{}).value||'',
      stat1l: (document.getElementById('gw_stat1l')||{}).value||'',
      stat2v: (document.getElementById('gw_stat2v')||{}).value||'',
      stat2l: (document.getElementById('gw_stat2l')||{}).value||'',
      stat3v: (document.getElementById('gw_stat3v')||{}).value||'',
      stat3l: (document.getElementById('gw_stat3l')||{}).value||'',
      stat4v: (document.getElementById('gw_stat4v')||{}).value||'',
      stat4l: (document.getElementById('gw_stat4l')||{}).value||'',
      para1: (document.getElementById('gw_para1')||{}).value||'',
      para2: (document.getElementById('gw_para2')||{}).value||'',
      supportTeamMembers: _gwSupportMembers
    };
    localStorage.setItem('gateway_about_company', JSON.stringify(data));
    showGlobalStatus('Gateway company info saved');
  };

  window.addGWSupportMember = function() {
    if (!_gwAdminUnlocked) return;
    _gwSupportMembers.push({ role: '', name: '', photo: '' });
    renderGWSupportTeam();
  };

  function renderGWSupportTeam() {
    var container = document.getElementById('gwSupportTeam');
    if (!container) return;
    container.innerHTML = '';
    _gwSupportMembers.forEach(function(m, i) {
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
      div.innerHTML =
        '<div style="width:50px;height:50px;border-radius:50%;background:rgba(162,182,192,0.15);border:1px dashed rgba(162,182,192,0.3);flex-shrink:0;cursor:' + (_gwAdminUnlocked?'pointer':'default') + ';overflow:hidden;display:flex;align-items:center;justify-content:center" ' +
          (_gwAdminUnlocked ? 'onclick="document.getElementById(\'gwSupportPhotoInput_' + i + '\').click()"' : '') + '>' +
          (m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover">' : '<span style="font-size:18px">👤</span>') +
        '</div>' +
        (_gwAdminUnlocked ? '<input type="file" id="gwSupportPhotoInput_' + i + '" accept="image/*" style="display:none" onchange="loadGWSupportPhoto(' + i + ',this)">' : '') +
        '<div style="flex:1">' +
          '<input value="' + (m.role||'') + '" placeholder="Role" ' + (_gwAdminUnlocked?'':'readonly') + ' style="margin-bottom:4px;font-size:12px" oninput="_gwSupportMembers[' + i + '].role=this.value">' +
          '<input value="' + (m.name||'') + '" placeholder="Full Name" ' + (_gwAdminUnlocked?'':'readonly') + ' style="font-size:12px" oninput="_gwSupportMembers[' + i + '].name=this.value">' +
        '</div>' +
        (_gwAdminUnlocked ? '<button class="btn-sm" style="font-size:11px;padding:2px 8px" onclick="_gwSupportMembers.splice(' + i + ',1);renderGWSupportTeam()">✕</button>' : '');
      container.appendChild(div);
    });
  }

  window.loadGWSupportPhoto = function(idx, input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _gwSupportMembers[idx].photo = e.target.result;
      renderGWSupportTeam();
    };
    reader.readAsDataURL(input.files[0]);
  };

  // ---- INIT ----
  function initOverlay() {
    injectTabs();
    injectCompsPanel();
    injectAnalysisPanel();
    injectAgentBioPanel();
    injectGatewayPanel();
    injectVacancyLoss();
    injectAIButtons();
    injectOMUpload();
    injectRentRollUpload();
    injectT12Upload();
    injectLocalEmployers();
    window.showTab = function(n) {
      for (var i = 0; i < totalTabs; i++) { var p = document.getElementById('tab' + i); if (p) p.style.display = 'none'; }
      var p = document.getElementById('tab' + n);
      if (p) p.style.display = 'block';
      var tabs = document.querySelectorAll('#page-multifamily .tab');
      tabs.forEach(function(t, i) { t.classList.toggle('active', i === n); });
    };
    renderComps();
  }

  var _checkInterval = setInterval(function() {
    if (document.querySelector('#page-multifamily .tabs')) { clearInterval(_checkInterval); initOverlay(); }
  }, 100);
  if (document.querySelector('#page-multifamily .tabs')) { clearInterval(_checkInterval); initOverlay(); }

})();
