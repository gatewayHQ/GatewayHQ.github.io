// ===================================================================
// SOCIAL MEDIA BUILDER
// ===================================================================
var socialInitialized = false;
var invoiceInitialized = false;
var smAgents = [];
var smPhotos = [null, null];

// ── Template Preset Save / Load / Delete ─────────────────────────────────
var SM_PRESET_KEY = 'gw_template_presets';
var SM_METRIC_KEYS = ['price-unit','price-sf','units','cap','noi','year-built',
  'occupancy','lot-size','bldg-sf','zoning','market-badge','dom','submarket',
  'prop-class','financing','sf'];
var SM_FIELD_IDS = [
  'sm-heading','sm-prop-name','sm-address','sm-price',
  'sm-comm-sf','sm-comm-rate','sm-comm-detail',
  'sm-res-beds','sm-res-baths','sm-res-sqft','sm-res-lot','sm-res-garage','sm-res-year',
  'sm-js-bldg-type','sm-js-buildings','sm-js-sqft','sm-js-occupancy',
  'sm-js-close-escrow','sm-js-price-sf','sm-js-off-market',
  'sm-js-unit1-label','sm-js-unit1-units','sm-js-unit1-pct',
  'sm-js-unit2-label','sm-js-unit2-units','sm-js-unit2-pct',
  'sm-js-unit3-label','sm-js-unit3-units','sm-js-unit3-pct',
  'sm-broker-record','sm-photo1-label'
];

// Cache filter value per render cycle — avoids DOM query on every canvas draw call
var _smFilterCache = null;
function smPhotoFilter() {
  if (_smFilterCache !== null) return _smFilterCache;
  var el = document.getElementById('sm-enhance-photo');
  _smFilterCache = (el && el.checked) ? 'brightness(1.12) contrast(1.08) saturate(1.22)' : 'none';
  return _smFilterCache;
}
function smInvalidateFilterCache() { _smFilterCache = null; }

function renderTemplatePresetSelect() {
  var sel = document.getElementById('sm-preset-sel');
  if (!sel) return;
  var saved = JSON.parse(localStorage.getItem(SM_PRESET_KEY) || '[]');
  sel.innerHTML = '<option value="">Load saved template\u2026</option>' +
    saved.map(function(p) {
      return '<option value="' + encodeURIComponent(p.name) + '">' + p.name + '</option>';
    }).join('');
}

function saveTemplatePreset() {
  var name = prompt('Name this template:');
  if (!name || !name.trim()) return;
  name = name.trim();
  var data = { name: name, palette: smPalette, fields: {}, metrics: {},
               agents: smAgents.map(function(a) {
                 return { name: a.name, title: a.title, phone: a.phone,
                          email: a.email, license: a.license };
               }) };
  SM_FIELD_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) data.fields[id] = el.value;
  });
  SM_METRIC_KEYS.forEach(function(key) {
    var tog = document.getElementById('sm-show-' + key);
    var inp = document.getElementById('sm-' + key);
    data.metrics[key] = { show: tog ? tog.checked : false, value: inp ? inp.value : '' };
  });
  var saved = JSON.parse(localStorage.getItem(SM_PRESET_KEY) || '[]');
  var idx = saved.findIndex(function(p) { return p.name === name; });
  if (idx >= 0) { if (!confirm('Overwrite "' + name + '"?')) return; saved[idx] = data; }
  else saved.push(data);
  localStorage.setItem(SM_PRESET_KEY, JSON.stringify(saved));
  renderTemplatePresetSelect();
  // Select the just-saved item
  var sel = document.getElementById('sm-preset-sel');
  if (sel) sel.value = encodeURIComponent(name);
  alert('Template "' + name + '" saved! Load it any time to restore all settings.');
}

function loadTemplatePreset() {
  var sel = document.getElementById('sm-preset-sel');
  if (!sel || !sel.value) { alert('Select a saved template from the dropdown first.'); return; }
  var saved = JSON.parse(localStorage.getItem(SM_PRESET_KEY) || '[]');
  var preset = saved.find(function(p) { return encodeURIComponent(p.name) === sel.value; });
  if (!preset) { alert('Preset not found.'); return; }

  // Restore palette
  if (preset.palette) setSocialPalette(preset.palette);

  // Restore all simple fields
  if (preset.fields) {
    Object.keys(preset.fields).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = preset.fields[id] || '';
    });
  }

  // Restore metrics
  if (preset.metrics) {
    SM_METRIC_KEYS.forEach(function(key) {
      var tog = document.getElementById('sm-show-' + key);
      var inp = document.getElementById('sm-' + key);
      if (tog) tog.checked = !!(preset.metrics[key] && preset.metrics[key].show);
      if (inp) inp.value = (preset.metrics[key] && preset.metrics[key].value) || '';
    });
    smMetricToggle();
  }

  // Restore agents (no photos — too large to store)
  if (preset.agents && preset.agents.length) {
    smAgents = preset.agents.map(function(a) {
      return { name: a.name||'', title: a.title||'', phone: a.phone||'',
               email: a.email||'', license: a.license||'', photo: null };
    });
    renderSocialAgents();
  }

  onTemplateChange();
  updateSocialPreview();
  alert('Template "' + preset.name + '" loaded!\nNote: Photos are not stored \u2014 upload a new one or the previous one.');
}

function deleteTemplatePreset() {
  var sel = document.getElementById('sm-preset-sel');
  if (!sel || !sel.value) { alert('Select a preset to delete.'); return; }
  var saved = JSON.parse(localStorage.getItem(SM_PRESET_KEY) || '[]');
  var preset = saved.find(function(p) { return encodeURIComponent(p.name) === sel.value; });
  if (!preset) return;
  if (!confirm('Delete template "' + preset.name + '"?')) return;
  saved = saved.filter(function(p) { return p.name !== preset.name; });
  localStorage.setItem(SM_PRESET_KEY, JSON.stringify(saved));
  renderTemplatePresetSelect();
}

function initSocialBuilder() {
  socialInitialized = true;
  smAgents = [{ name: '', title: '', phone: '', email: '', license: '', photo: null }];
  renderSocialAgents();
  smMetricToggle();
  renderTemplatePresetSelect();
  updateSocialPreview();
}

function addSocialAgent() {
  smAgents.push({ name: '', title: '', phone: '', email: '', license: '', photo: null });
  renderSocialAgents();
  updateSocialPreview();
}

function removeSocialAgent(i) {
  if (smAgents.length <= 1) return;
  smAgents.splice(i, 1);
  renderSocialAgents();
  updateSocialPreview();
}

function renderSocialAgents() {
  var c = document.getElementById('sm-agents-container');
  c.innerHTML = '';
  smAgents.forEach((a, i) => {
    var card = document.createElement('div');
    card.className = 'agent-form-card';
    card.innerHTML = `
      <button class="remove-agent" onclick="removeSocialAgent(${i})" title="Remove">&times;</button>
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <div class="agent-photo-upload" onclick="document.getElementById('sm-agent-photo-${i}').click()">
          ${a.photo ? '<img src="'+a.photo+'">' : '<div class="upload-hint"><span class="icon">👤</span><span class="label">Click to upload<br>agent photo</span></div>'}
          <input type="file" id="sm-agent-photo-${i}" accept="image/*,.heic,.HEIC" style="display:none" onchange="handleSocialAgentPhoto(${i}, this)">
        </div>
        <div class="agent-fields" style="flex:1;min-width:0">
          <input type="text" placeholder="Name" value="${a.name}" oninput="smAgents[${i}].name=this.value; updateSocialPreview()">
          <input type="text" placeholder="Title" value="${a.title}" oninput="smAgents[${i}].title=this.value; updateSocialPreview()">
          <input type="text" placeholder="Phone" value="${a.phone}" oninput="smAgents[${i}].phone=this.value; updateSocialPreview()">
          <input type="text" placeholder="Email" value="${a.email}" oninput="smAgents[${i}].email=this.value; updateSocialPreview()">
          <input type="text" placeholder="Licensed in (e.g. Iowa, Nebraska, SD)" value="${a.license}" oninput="smAgents[${i}].license=this.value; updateSocialPreview()" style="grid-column:1/-1">
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
        <button class="btn-sm" title="Save current agent details (re-save with same name to update)" style="font-size:12px;padding:4px 10px;background:#1E3040;border:1px solid #C8A84B;color:#C8A84B;white-space:nowrap" onclick="saveAgentPreset(${i})">💾 Save</button>
        <select id="sm-agent-load-sel-${i}" style="flex:1;min-width:100px;font-size:12px;padding:4px 8px;background:#1E3040;color:#E4E3D4;border:1px solid #2a4050;border-radius:4px" onchange="loadAgentPreset(${i}, this)">
          <option value="">Load saved agent…</option>
          ${(JSON.parse(localStorage.getItem('gw_saved_agents')||'[]')).map(p=>`<option value="${encodeURIComponent(JSON.stringify(p))}">${p.name}</option>`).join('')}
        </select>
        <button class="btn-sm" title="Delete selected saved agent" style="font-size:12px;padding:4px 9px;background:#1E3040;border:1px solid #7a3030;color:#e07070;white-space:nowrap" onclick="deleteSavedAgent('sm-agent-load-sel-${i}')">🗑️ Delete</button>
        <button class="btn-sm" title="Publish this agent to the shared team roster" style="font-size:12px;padding:4px 10px;background:#1E3040;border:1px solid #C8A84B;color:#C8A84B;white-space:nowrap" onclick="gwSmPublishToRoster(${i})">🌐 Publish</button>
        <button class="btn-sm" title="Load an agent from the shared team roster" style="font-size:12px;padding:4px 10px;background:#1E3040;border:1px solid #5a9aaa;color:#aaccd8;white-space:nowrap" onclick="gwSmLoadFromRoster(${i})">👥 Roster</button>
      </div>
      <div style="font-size:10px;color:#5a7a8a;margin-top:3px;padding-left:2px">Tip: load an agent, edit fields above, then re-save to update.</div>
    `;
    c.appendChild(card);
  });
}

function deleteSavedAgent(selId) {
  var sel = document.getElementById(selId);
  if (!sel || !sel.value) { alert('Select a saved agent from the dropdown first.'); return; }
  var p = JSON.parse(decodeURIComponent(sel.value));
  if (!confirm('Remove saved agent "' + p.name + '\nThis cannot be undone.')) return;
  var saved = JSON.parse(localStorage.getItem('gw_saved_agents') || '[]');
  saved = saved.filter(function(a) { return a.name !== p.name; });
  localStorage.setItem('gw_saved_agents', JSON.stringify(saved));
  renderSocialAgents();
}

function saveAgentPreset(i) {
  var a = smAgents[i];
  if (!a.name) { alert('Enter an agent name first.'); return; }
  var saved = JSON.parse(localStorage.getItem('gw_saved_agents') || '[]');
  var idx = saved.findIndex(function(p){ return p.name === a.name; });
  var preset = { name: a.name, title: a.title, phone: a.phone, email: a.email, license: a.license };
  if (idx >= 0) saved[idx] = preset; else saved.push(preset);
  localStorage.setItem('gw_saved_agents', JSON.stringify(saved));
  renderSocialAgents();
  alert('Agent "' + a.name + '" saved!');
}

function loadAgentPreset(i, sel) {
  if (!sel.value) return;
  var p = JSON.parse(decodeURIComponent(sel.value));
  smAgents[i] = Object.assign(smAgents[i], p);
  // Update input fields in-place — do NOT call renderSocialAgents() here
  // because that would destroy and recreate the dropdown, resetting its
  // value to empty and breaking the Delete button.
  var container = document.getElementById('sm-agents-container');
  var card = container && container.children[i];
  if (card) {
    var fieldMap = { 'Name': p.name, 'Title': p.title, 'Phone': p.phone, 'Email': p.email, 'Licensed in (e.g. Iowa, Nebraska, SD)': p.license };
    Object.keys(fieldMap).forEach(function(ph) {
      var inp = card.querySelector('input[placeholder="' + ph + '"]');
      if (inp) inp.value = fieldMap[ph] || '';
    });
  }
  updateSocialPreview();
  // sel.value is now preserved — Delete button will find it
}

function handleSocialAgentPhoto(index, input) {
  if (!(input.files && input.files[0])) return;
  var file = input.files[0];
  if (window.GW && GW.compressImage) {
    GW.compressImage(file, 800, 0.88).then(function(dataUrl) {
      if (!dataUrl) return;
      GW.evictImage(smAgents[index].photo);
      smAgents[index].photo = dataUrl;
      renderSocialAgents();
      updateSocialPreview();
    });
  } else {
    var reader = new FileReader();
    reader.onload = function(e) {
      smAgents[index].photo = e.target.result;
      renderSocialAgents();
      updateSocialPreview();
    };
    reader.readAsDataURL(file);
  }
}

function handleSocialPhoto(num, input) {
  if (!(input.files && input.files[0])) return;
  var file = input.files[0];
  var isHeic = /\.heic$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
  function readAndSet(blob) {
    // Compress before storing — reduces base64 size by ~60-70% for large photos
    if (window.GW && GW.compressImage && blob instanceof Blob) {
      GW.compressImage(blob, 1400, 0.88).then(function(dataUrl) {
        if (!dataUrl) return;
        GW.evictImage(smPhotos[num - 1]);
        smPhotos[num - 1] = dataUrl;
        var preview = document.getElementById('sm-photo' + num + '-preview');
        if (preview) preview.innerHTML = '<img src="' + dataUrl + '">';
        var lbl = document.getElementById('sm-photo' + num + '-label');
        if (lbl) lbl.style.display = 'block';
        updateSocialPreview();
      });
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      smPhotos[num - 1] = e.target.result;
      var preview = document.getElementById('sm-photo' + num + '-preview');
      if (preview) preview.innerHTML = '<img src="' + e.target.result + '">';
      var lbl = document.getElementById('sm-photo' + num + '-label');
      if (lbl) lbl.style.display = 'block';
      updateSocialPreview();
    };
    reader.readAsDataURL(blob);
  }
  if (isHeic && typeof heic2any !== 'undefined') {
    heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
      .then(function(jpegBlob) { readAndSet(jpegBlob); })
      .catch(function() { readAndSet(file); }); // fallback: try anyway
  } else {
    readAndSet(file);
  }
}

function loadImageAsync(src) {
  // Use GW image cache when available — prevents re-decoding same image on every keystroke
  if (window.GW && GW.loadImage) return GW.loadImage(src);
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload  = function() { resolve(img); };
    img.onerror = function() { resolve(null); }; // never hard-reject; canvas draws are best-effort
    img.src = src;
  });
}

// Color palette definitions
var smPalette = 'navy';
var PALETTES = {
  navy:  { bg1: '#0D1B22', bg2: '#0A1419', accent: '#A2B6C0', text: '#E4E3D4', label: '#5a6a72', logoKey: 'light', photoBg: '#1a2830' },
  cream: { bg1: '#E4E3D4', bg2: '#D8D7C8', accent: '#1E2F39', text: '#1E2F39', label: '#6a6a5a', logoKey: 'dark', photoBg: '#cccbbc' },
  blue:  { bg1: '#A2B6C0', bg2: '#8FA3AD', accent: '#1E2F39', text: '#1E2F39', label: '#4a5a62', logoKey: 'dark', photoBg: '#8a9ea8' },
  dark:  { bg1: '#0A1419', bg2: '#060D11', accent: '#A2B6C0', text: '#A2B6C0', label: '#4a5a62', logoKey: 'light', photoBg: '#0f1e26' }
};

// V4: Metrics toggle handler
function smMetricToggle() {
  var SM_KEYS = ['price-unit','price-sf','units','cap','noi','year-built','occupancy','lot-size','bldg-sf','zoning','market-badge','dom','submarket','prop-class','financing','sf'];
  var count = 0;
  SM_KEYS.forEach(function(key) {
    var toggle = document.getElementById('sm-show-' + key);
    var row = document.getElementById('sm-' + key + '-row');
    if (toggle && toggle.checked) {
      count++;
      if (row) row.style.display = '';
    } else {
      if (row) row.style.display = 'none';
    }
  });
  var countEl = document.getElementById('sm-metrics-count');
  if (countEl) countEl.textContent = '(' + count + ' selected)';
  var warnEl = document.getElementById('sm-metrics-warn');
  if (warnEl) {
    if (count > 8) {
      warnEl.style.display = 'block';
      warnEl.textContent = '⚠️ ' + count + ' metrics selected — graphic may look crowded. Consider enabling "Condensed layout" below or reducing to 6-8.';
    } else if (count > 6) {
      warnEl.style.display = 'block';
      warnEl.textContent = '💡 ' + count + ' metrics selected — consider enabling "Condensed layout" for better fit.';
      warnEl.style.background = 'rgba(162,182,192,0.1)';
      warnEl.style.color = 'var(--brand-gray)';
    } else {
      warnEl.style.display = 'none';
    }
  }
  updateSocialPreview();
}

function setSocialPalette(name) {
  smPalette = name;
  document.querySelectorAll('.palette-chip').forEach(function(c) {
    c.style.borderColor = 'transparent';
    c.classList.remove('active');
  });
  var el = document.getElementById('pal-' + name);
  if (el) { el.style.borderColor = '#A2B6C0'; el.classList.add('active'); }
  updateSocialPreview();
}

function onTemplateChange() {
  var val = document.getElementById('sm-heading').value;
  var isResidential = val.startsWith('res-');
  var isPremiumComm = val.startsWith('comm-');
  var isNewCommercial = isPremiumComm || ['For Lease','Just Leased','Price Reduced','Investment Opportunity'].indexOf(val) !== -1;
  var isJustSold = (val === 'Just Sold');
  var resFields = document.getElementById('sm-residential-fields');
  var commFields = document.getElementById('sm-commercial-fields');
  var metricsSection = document.getElementById('sm-metrics-grid');
  var metricsValues = document.getElementById('sm-metrics-values');
  if (resFields) resFields.style.display = isResidential ? 'block' : 'none';
  if (commFields) commFields.style.display = isNewCommercial ? 'block' : 'none';
  if (metricsSection) metricsSection.style.display = isResidential ? 'none' : '';
  if (metricsValues) metricsValues.style.display = isResidential ? 'none' : '';
  var jsSoldFields = document.getElementById('sm-just-sold-fields');
  if (jsSoldFields) jsSoldFields.style.display = isJustSold ? 'block' : 'none';
  updateSocialPreview();
}

async function drawResidentialNewListing(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var isSquare = (H <= 1080);

  var topBg = pal.logoKey === 'dark' ? '#f4f4f0' : '#0D1B22';
  ctx.fillStyle = topBg;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var price = document.getElementById('sm-price').value || '';
  var beds = document.getElementById('sm-res-beds').value || '';
  var baths = document.getElementById('sm-res-baths').value || '';
  var sqft = document.getElementById('sm-res-sqft').value || '';
  var lot = document.getElementById('sm-res-lot').value || '';
  var garage = document.getElementById('sm-res-garage').value || '';
  var year = document.getElementById('sm-res-year').value || '';

  // Responsive scale based on canvas height
  var headingFontSz = isSquare ? 72 : 100;
  var addrFontSz    = isSquare ? 22 : 28;
  var priceFontSz   = isSquare ? 26 : 34;
  var detailFontSz  = isSquare ? 18 : 22;
  var agPhotoW      = isSquare ? 110 : 150;
  var agPhotoH      = isSquare ? 140 : 190;
  var agSpacing     = isSquare ? 430 : 480;
  var agNameFontSz  = isSquare ? 22 : 29;
  var agInfoFontSz  = isSquare ? 17 : 22;
  var agLineH       = isSquare ? 22 : 26;
  var logoSz        = isSquare ? 90 : 130;

  // "NEW LISTING" heading
  ctx.fillStyle = pal.logoKey === 'dark' ? '#1E2F39' : '#E4E3D4';
  ctx.font = 'bold ' + headingFontSz + 'px "EB Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  var headingY = isSquare ? 88 : 135;
  ctx.fillText('NEW LISTING', W/2, headingY);

  // Address
  ctx.font = '600 ' + addrFontSz + 'px "Montserrat", sans-serif';
  ctx.fillStyle = pal.logoKey === 'dark' ? '#3a4e5a' : '#A2B6C0';
  var addrY = headingY + (isSquare ? 44 : 57);
  ctx.fillText(address.toUpperCase(), W/2, addrY);

  // Price
  var priceY = addrY + (isSquare ? 44 : 56);
  if (price) {
    ctx.font = '500 ' + priceFontSz + 'px "Montserrat", sans-serif';
    ctx.fillStyle = '#C8A84B';
    ctx.fillText(price, W/2, priceY);
  }

  // Responsive photo height — leave room for banner + agents + logo + footer
  var photoMargin = 60;
  var photoTopY = price ? priceY + (isSquare ? 22 : 32) : addrY + (isSquare ? 22 : 32);
  var bannerReserve = isSquare ? 230 : 300;
  var photoH = Math.max(isSquare ? 340 : 480, H - photoTopY - bannerReserve);
  photoH = Math.min(photoH, isSquare ? 430 : 560);

  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, photoMargin, photoTopY, W - photoMargin*2, photoH, 12);
      ctx.clip();
      var scale = Math.max((W - photoMargin*2)/img.width, photoH/img.height);
      var dw = img.width * scale, dh = img.height * scale;
      ctx.filter = smPhotoFilter();
      ctx.drawImage(img, photoMargin + (W - photoMargin*2 - dw)/2, photoTopY + (photoH - dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#ddddd8';
    ctx.beginPath();
    roundRect(ctx, photoMargin, photoTopY, W - photoMargin*2, photoH, 12);
    ctx.fill();
    ctx.fillStyle = '#aaa';
    ctx.font = '26px Montserrat';
    ctx.textAlign = 'center';
    ctx.fillText('Property Photo', W/2, photoTopY + photoH/2);
  }

  // Banner — palette bg fills everything below photo
  var bannerY = photoTopY + photoH + 12;
  ctx.fillStyle = pal.bg1;
  ctx.fillRect(0, bannerY, W, H - bannerY);
  ctx.fillStyle = '#C8A84B';
  ctx.fillRect(0, bannerY, W, 3);

  // Property details row
  var details = [];
  if (beds)   details.push({ icon:'🛏', val: beds + ' Bed' });
  if (baths)  details.push({ icon:'🚿', val: baths + ' Bath' });
  if (sqft)   details.push({ icon:'📐', val: sqft });
  if (garage) details.push({ icon:'🚗', val: garage });
  if (lot)    details.push({ icon:'🌿', val: lot });
  if (year)   details.push({ icon:'🏗', val: year });

  var dY = bannerY + (isSquare ? 36 : 50);
  if (details.length > 0) {
    ctx.textAlign = 'center';
    ctx.font = '600 ' + detailFontSz + 'px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    var spacing = W / (details.length + 1);
    details.forEach(function(d, i) {
      ctx.fillText(d.icon + '  ' + d.val, spacing * (i + 1), dY);
    });
  }

  dY += isSquare ? 16 : 22;
  ctx.strokeStyle = pal.accent + '44';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, dY); ctx.lineTo(W - 60, dY); ctx.stroke();
  dY += isSquare ? 20 : 28;

  // Agent section — sized to canvas
  ctx.textAlign = 'left';
  var agentStartY = dY;
  var hasAgent = smAgents.length > 0 && smAgents[0].name;
  if (hasAgent) {
    for (var ai = 0; ai < Math.min(smAgents.length, 2); ai++) {
      var ag = smAgents[ai];
      if (!ag.name) continue;
      var agX = 80 + ai * agSpacing;
      if (ag.photo) {
        try {
          var agImg = await loadImageAsync(ag.photo);
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, agX, agentStartY, agPhotoW, agPhotoH, 10);
          ctx.clip();
          var _scag = Math.max(agPhotoW/agImg.width, agPhotoH/agImg.height);
          var _dwag = agImg.width * _scag, _dhag = agImg.height * _scag;
          ctx.drawImage(agImg, agX + (agPhotoW - _dwag)/2, agentStartY + (agPhotoH - _dhag)/2, _dwag, _dhag);
          ctx.restore();
          ctx.strokeStyle = '#C8A84B'; ctx.lineWidth = 2.5;
          ctx.beginPath(); roundRect(ctx, agX, agentStartY, agPhotoW, agPhotoH, 10); ctx.stroke();
        } catch(e) {}
      }
      var tX = ag.photo ? agX + agPhotoW + 14 : agX;
      var lineY = agentStartY + agNameFontSz;
      ctx.font = '700 ' + agNameFontSz + 'px "Montserrat", sans-serif';
      ctx.fillStyle = pal.text;
      ctx.fillText(ag.name, tX, lineY);
      lineY += agLineH;
      ctx.font = '400 ' + agInfoFontSz + 'px "Montserrat", sans-serif';
      ctx.fillStyle = pal.accent;
      if (ag.title)   { ctx.fillText(ag.title, tX, lineY);   lineY += agLineH; }
      if (ag.phone)   { ctx.fillText(ag.phone, tX, lineY);   lineY += agLineH; }
      if (ag.email)   { ctx.font = '400 ' + (agInfoFontSz - 2) + 'px "Montserrat"'; ctx.fillStyle = pal.accent; ctx.fillText(ag.email, tX, lineY); lineY += agLineH; }
      if (ag.license) { ctx.font = '400 ' + (agInfoFontSz - 4) + 'px "Montserrat"'; ctx.fillStyle = pal.logoKey === 'dark' ? '#5a4832' : '#B8CED8'; ctx.fillText(ag.license, tX, lineY); }
    }
  }

  // Gateway logo — always drawn, clamped above website footer
  var logoY = agentStartY + agPhotoH + 10;
  logoY = Math.min(logoY, H - logoSz - 38);
  try {
    var logoSrc = (pal && pal.logoKey === 'dark') ? (LOGO_ROUND_SUBMARK || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png') : (LOGO_CIRCLE_LIGHT || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png');
    var logoImg = await loadImageAsync(logoSrc);
    ctx.drawImage(logoImg, W/2 - logoSz/2, logoY, logoSz, logoSz);
  } catch(e) {}

  // Website footer
  ctx.textAlign = 'center';
  ctx.font = '500 ' + (isSquare ? 16 : 20) + 'px "Montserrat", sans-serif';
  ctx.fillStyle = pal.label;
  ctx.fillText('www.gatewayreadvisors.com  |  712-226-8000', W/2, H - 18);
}

async function drawResidentialJustSold(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var isSquare = H <= 1080;

  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var beds    = document.getElementById('sm-res-beds').value || '';
  var baths   = document.getElementById('sm-res-baths').value || '';
  var sqft    = document.getElementById('sm-res-sqft').value || '';
  var lot     = document.getElementById('sm-res-lot').value || '';
  var garage  = document.getElementById('sm-res-garage').value || '';
  var year    = document.getElementById('sm-res-year').value || '';

  // Responsive sizing
  var agPhotoW  = isSquare ? 120 : 150;
  var agPhotoH  = isSquare ? 152 : 190;
  var agSpacing = isSquare ? 430 : 460;
  var logoSz    = isSquare ? 110 : 155;
  // Reserve bottom zone height for logo + JUST SOLD + subtitle + website
  var bottomZone = isSquare ? 195 : 240;

  // ── Property photo — responsive height ─────────────────────────────────
  var photoY = isSquare ? 40 : 50;
  // Leave room: infoSection (~90px) + sep (~30px) + agent (agPhotoH+30) + bottom zone
  var infoReserve = 90 + 30 + agPhotoH + 36 + bottomZone;
  var photoH = Math.max(isSquare ? 340 : 480, H - photoY - infoReserve);
  photoH = Math.min(photoH, isSquare ? 430 : 600);

  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var border = 10, margin = 60;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(margin - border, photoY - border, W - (margin - border)*2, photoH + border*2);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, margin, photoY, W - margin*2, photoH, 4);
      ctx.clip();
      var scale = Math.max((W - margin*2)/img.width, photoH/img.height);
      var dw = img.width * scale, dh = img.height * scale;
      ctx.filter = smPhotoFilter();
      ctx.drawImage(img, margin + (W - margin*2 - dw)/2, photoY + (photoH - dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    var m2 = 60, b2 = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(m2 - b2, photoY - b2, W - (m2-b2)*2, photoH + b2*2);
    ctx.fillStyle = '#2a3e48'; ctx.fillRect(m2, photoY, W - m2*2, photoH);
    ctx.fillStyle = '#5a6a72'; ctx.textAlign = 'center'; ctx.font = '28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY + photoH/2);
  }

  // ── Address + details ───────────────────────────────────────────────────
  var infoY = photoY + photoH + (isSquare ? 28 : 46);
  ctx.textAlign = 'left';
  ctx.font = '600 ' + (isSquare ? 22 : 26) + 'px "Montserrat", sans-serif';
  ctx.fillStyle = pal.accent;
  ctx.fillText(address, 60, infoY);

  var details = [];
  if (beds)   details.push('🛏 ' + beds);
  if (baths)  details.push('🚿 ' + baths);
  if (sqft)   details.push('📏 ' + sqft);
  if (garage) details.push('🚗 ' + garage);
  if (lot)    details.push('📍 ' + lot);
  if (year)   details.push('🏗 ' + year);
  if (details.length) {
    ctx.font = '400 ' + (isSquare ? 17 : 20) + 'px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText(details.join('  ·  '), 60, infoY + (isSquare ? 28 : 36));
  }

  // ── Separator ────────────────────────────────────────────────────────────
  var sepY = infoY + (isSquare ? 48 : 60);
  ctx.strokeStyle = pal.accent + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W - 60, sepY); ctx.stroke();

  // ── Agent section ────────────────────────────────────────────────────────
  var agentStartY = sepY + (isSquare ? 18 : 26);
  var hasAgent = smAgents.length > 0 && smAgents[0].name;
  if (hasAgent) {
    for (var ai = 0; ai < Math.min(smAgents.length, 2); ai++) {
      var ag = smAgents[ai];
      if (!ag.name) continue;
      var agX = 60 + ai * agSpacing;
      if (ag.photo) {
        try {
          var agImg = await loadImageAsync(ag.photo);
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, agX, agentStartY, agPhotoW, agPhotoH, 10);
          ctx.clip();
          var _scag = Math.max(agPhotoW/agImg.width, agPhotoH/agImg.height);
          var _dwag = agImg.width * _scag, _dhag = agImg.height * _scag;
          ctx.drawImage(agImg, agX + (agPhotoW - _dwag)/2, agentStartY + (agPhotoH - _dhag)/2, _dwag, _dhag);
          ctx.restore();
          ctx.strokeStyle = '#A2B6C0'; ctx.lineWidth = 2.5;
          ctx.beginPath(); roundRect(ctx, agX, agentStartY, agPhotoW, agPhotoH, 10); ctx.stroke();
        } catch(e) {}
      }
      var tX = ag.photo ? agX + agPhotoW + 14 : agX;
      var nameSz = isSquare ? 22 : 27;
      var infoSz = isSquare ? 17 : 21;
      var lineH  = isSquare ? 22 : 25;
      var lineY  = agentStartY + nameSz;
      ctx.font = '700 ' + nameSz + 'px "Montserrat", sans-serif'; ctx.fillStyle = pal.text;
      ctx.textAlign = 'left'; ctx.fillText(ag.name, tX, lineY); lineY += lineH;
      ctx.font = '400 ' + infoSz + 'px "Montserrat", sans-serif'; ctx.fillStyle = pal.accent;
      if (ag.title)   { ctx.fillText(ag.title,   tX, lineY); lineY += lineH; }
      if (ag.phone)   { ctx.fillText(ag.phone,   tX, lineY); lineY += lineH; }
      if (ag.email)   { ctx.font = '400 ' + (infoSz - 2) + 'px Montserrat'; ctx.fillStyle = pal.accent; ctx.fillText(ag.email, tX, lineY); lineY += lineH; }
      if (ag.license) { ctx.font = '400 ' + (infoSz - 4) + 'px Montserrat'; ctx.fillStyle = pal.logoKey === 'dark' ? '#5a4832' : '#B8CED8'; ctx.fillText(ag.license, tX, lineY); }
    }
  }

  // ── Bottom zone — logo left, JUST SOLD right ──────────────────────────
  // Anchored to canvas bottom so it never collides with agent content above
  var bottomY = H - bottomZone;

  // Thin separator above bottom zone
  ctx.strokeStyle = pal.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, bottomY - 8); ctx.lineTo(W - 60, bottomY - 8); ctx.stroke();

  // Gateway circular logo — bottom left
  try {
    var logoSrc = (pal && pal.logoKey === 'dark') ? (LOGO_ROUND_SUBMARK || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png') : (LOGO_CIRCLE_LIGHT || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png');
    var logoImg = await loadImageAsync(logoSrc);
    var logoTopY = bottomY + Math.round((bottomZone - logoSz) / 2);
    ctx.drawImage(logoImg, 60, logoTopY, logoSz, logoSz);
  } catch(e) {}

  // "JUST SOLD!" — bottom right
  var jsFontSz = isSquare ? 72 : 96;
  ctx.textAlign = 'right';
  ctx.font = 'bold ' + jsFontSz + 'px "EB Garamond", Georgia, serif';
  ctx.fillStyle = pal.text;
  ctx.fillText('JUST SOLD!', W - 55, bottomY + Math.round(bottomZone * 0.52));

  // Italic subtitle
  ctx.font = 'italic ' + (isSquare ? 22 : 30) + 'px "EB Garamond", Georgia, serif';
  ctx.fillStyle = pal.accent;
  ctx.fillText('A huge congrats to our happy clients!', W - 55, bottomY + Math.round(bottomZone * 0.72));

  // Website
  ctx.font = '400 ' + (isSquare ? 16 : 20) + 'px "Montserrat", sans-serif';
  ctx.fillStyle = pal.label;
  ctx.fillText('www.gatewayreadvisors.com  |  712-226-8000', W - 55, H - 18);
}

// ---- Shared helper: draw the residential agent strip + logo + footer ----
async function drawResAgentStrip(ctx, pal, startY, W, H) {
  var agentY = startY;
  var hasAgent = smAgents.length > 0 && smAgents[0].name;
  if (hasAgent) {
    ctx.textAlign = 'left';
    for (var ai = 0; ai < Math.min(smAgents.length, 2); ai++) {
      var ag = smAgents[ai];
      if (!ag.name) continue;
      var agX = 70 + ai * 490;
      if (ag.photo) {
        try {
          var agImg = await loadImageAsync(ag.photo);
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, agX, agentY, 150, 190, 10);
          ctx.clip();
          var _scagImg = Math.max(150/agImg.width, 190/agImg.height);
          var _dwagImg = agImg.width * _scagImg, _dhagImg = agImg.height * _scagImg;
          ctx.drawImage(agImg, agX + (150 - _dwagImg)/2, agentY + (190 - _dhagImg)/2, _dwagImg, _dhagImg);
          ctx.restore();
          ctx.strokeStyle = '#C8A84B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          roundRect(ctx, agX, agentY, 150, 190, 10);
          ctx.stroke();
        } catch(e) {}
      }
      var tX = ag.photo ? agX + 166 : agX;
      ctx.font = '700 27px "Montserrat", sans-serif';
      ctx.fillStyle = pal.text;
      ctx.fillText(ag.name, tX, agentY + 27);
      ctx.font = '400 21px "Montserrat", sans-serif';
      ctx.fillStyle = pal.accent;
      if (ag.title) ctx.fillText(ag.title, tX, agentY + 53);
      if (ag.phone) ctx.fillText(ag.phone, tX, agentY + 78);
      if (ag.email) { ctx.font = '400 19px Montserrat'; ctx.fillText(ag.email, tX, agentY + 101); }
      if (ag.license) { ctx.font = '400 17px Montserrat'; ctx.fillStyle = pal.logoKey === 'dark' ? '#5a4832' : '#B8CED8'; ctx.fillText(ag.license, tX, agentY + 122); }
    }
    agentY += 210;
  }
  // Logo centered below agents
  try {
    var logoSrc2 = (pal.logoKey === 'dark') ? (LOGO_ROUND_SUBMARK || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png') : (LOGO_CIRCLE_LIGHT || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png');
    var li = await loadImageAsync(logoSrc2);
    var lsz = 115;
    var lY = agentY + 6;
    if (lY + lsz < H - 36) ctx.drawImage(li, W/2 - lsz/2, lY, lsz, lsz);
  } catch(e) {}
  // Website footer
  ctx.textAlign = 'center';
  ctx.font = '500 19px "Montserrat", sans-serif';
  ctx.fillStyle = pal.label;
  ctx.fillText('www.gatewayreadvisors.com  |  712-226-8000', W/2, H - 18);
}

async function drawResidentialUnderContract(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var price = document.getElementById('sm-price').value || '';
  var beds = document.getElementById('sm-res-beds').value || '';
  var baths = document.getElementById('sm-res-baths').value || '';
  var sqft = document.getElementById('sm-res-sqft').value || '';
  var garage = document.getElementById('sm-res-garage').value || '';

  // Accent bar
  ctx.fillStyle = '#F0A500';
  ctx.fillRect(0, 0, W, 8);

  // "UNDER CONTRACT" heading
  ctx.textAlign = 'center';
  ctx.font = 'bold 82px "EB Garamond", Georgia, serif';
  ctx.fillStyle = '#F0A500';
  ctx.fillText('UNDER CONTRACT', W/2, 100);
  ctx.font = '500 26px "Montserrat", sans-serif';
  ctx.fillStyle = pal.accent;
  ctx.fillText(address.toUpperCase(), W/2, 140);
  if (price) {
    ctx.font = '400 28px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText(price, W/2, 176);
  }

  // Photo with diagonal "PENDING" stamp overlay
  var photoY = price ? 200 : 170, photoH = 590;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var margin = 60;
      ctx.save();
      ctx.beginPath(); roundRect(ctx, margin, photoY, W - margin*2, photoH, 10); ctx.clip();
      var scale = Math.max((W-margin*2)/img.width, photoH/img.height);
      var dw = img.width*scale, dh = img.height*scale;
      ctx.filter = smPhotoFilter();
    ctx.drawImage(img, margin+(W-margin*2-dw)/2, photoY+(photoH-dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = pal.photoBg;
    ctx.save(); roundRect(ctx, 60, photoY, W-120, photoH, 10); ctx.fill(); ctx.restore();
    ctx.fillStyle = pal.label; ctx.textAlign='center'; ctx.font='28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY+photoH/2);
  }

  // "PENDING" diagonal stamp
  ctx.save();
  ctx.translate(W/2, photoY + photoH/2);
  ctx.rotate(-Math.PI/8);
  ctx.font = 'bold 120px "Montserrat", sans-serif';
  ctx.strokeStyle = '#F0A500';
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.55;
  ctx.strokeText('PENDING', -280, 40);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Separator + details
  var sepY = photoY + photoH + 22;
  ctx.strokeStyle = pal.accent + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W-60, sepY); ctx.stroke();
  var details = [];
  if (beds) details.push('🛏 ' + beds + ' Bed');
  if (baths) details.push('🚿 ' + baths + ' Bath');
  if (sqft) details.push('📐 ' + sqft + ' SF');
  if (garage) details.push('🚗 ' + garage);
  if (details.length) {
    ctx.textAlign = 'center'; ctx.font = '500 21px "Montserrat", sans-serif'; ctx.fillStyle = pal.text;
    ctx.fillText(details.join('   ·   '), W/2, sepY + 36);
  }
  var stripY = sepY + (details.length ? 62 : 28);
  ctx.strokeStyle = pal.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, stripY); ctx.lineTo(W-60, stripY); ctx.stroke();
  await drawResAgentStrip(ctx, pal, stripY + 18, W, H);
}

async function drawResidentialOpenHouse(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var price = document.getElementById('sm-price').value || '';
  var beds = document.getElementById('sm-res-beds').value || '';
  var baths = document.getElementById('sm-res-baths').value || '';
  var sqft = document.getElementById('sm-res-sqft').value || '';
  var year = document.getElementById('sm-res-year').value || '';

  // Gold top bar
  ctx.fillStyle = '#C8A84B';
  ctx.fillRect(0, 0, W, 8);

  // "OPEN HOUSE" heading
  ctx.textAlign = 'center';
  ctx.font = 'bold 96px "EB Garamond", Georgia, serif';
  ctx.fillStyle = '#C8A84B';
  ctx.fillText('OPEN HOUSE', W/2, 108);
  ctx.font = '500 26px "Montserrat", sans-serif';
  ctx.fillStyle = pal.text;
  ctx.fillText(address.toUpperCase(), W/2, 148);
  if (price) {
    ctx.font = '500 30px "Montserrat", sans-serif';
    ctx.fillStyle = pal.accent;
    ctx.fillText(price, W/2, 186);
  }

  // Photo
  var photoY = price ? 210 : 178, photoH = 590;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var margin = 60;
      ctx.save();
      ctx.beginPath(); roundRect(ctx, margin, photoY, W-margin*2, photoH, 12); ctx.clip();
      var scale = Math.max((W-margin*2)/img.width, photoH/img.height);
      var dw = img.width*scale, dh = img.height*scale;
      ctx.filter = smPhotoFilter();
    ctx.drawImage(img, margin+(W-margin*2-dw)/2, photoY+(photoH-dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = pal.photoBg;
    ctx.save(); roundRect(ctx, 60, photoY, W-120, photoH, 12); ctx.fill(); ctx.restore();
    ctx.fillStyle = pal.label; ctx.textAlign='center'; ctx.font='28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY+photoH/2);
  }

  // "COME SEE US!" call to action badge on photo
  ctx.save();
  ctx.fillStyle = '#C8A84B';
  var bW = 360, bH = 64, bX = (W-bW)/2, bY = photoY + photoH - 80;
  ctx.beginPath(); roundRect(ctx, bX, bY, bW, bH, 32); ctx.fill();
  ctx.font = 'bold 26px "Montserrat", sans-serif';
  ctx.fillStyle = '#152229';
  ctx.textAlign = 'center';
  ctx.fillText('YOU ARE INVITED!', W/2, bY + 42);
  ctx.restore();

  // Details strip
  var sepY = photoY + photoH + 22;
  ctx.strokeStyle = pal.accent + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W-60, sepY); ctx.stroke();
  var details = [];
  if (beds) details.push('🛏 ' + beds); if (baths) details.push('🚿 ' + baths);
  if (sqft) details.push('📐 ' + sqft); if (year) details.push('🏗 ' + year);
  if (details.length) {
    ctx.textAlign = 'center'; ctx.font = '500 21px "Montserrat", sans-serif'; ctx.fillStyle = pal.text;
    ctx.fillText(details.join('   ·   '), W/2, sepY + 36);
  }
  var stripY = sepY + (details.length ? 58 : 24);
  ctx.strokeStyle = pal.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, stripY); ctx.lineTo(W-60, stripY); ctx.stroke();
  await drawResAgentStrip(ctx, pal, stripY + 18, W, H);
}

async function drawResidentialPriceReduced(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var price = document.getElementById('sm-price').value || '';
  var beds = document.getElementById('sm-res-beds').value || '';
  var baths = document.getElementById('sm-res-baths').value || '';
  var sqft = document.getElementById('sm-res-sqft').value || '';
  var lot = document.getElementById('sm-res-lot').value || '';

  // Red accent top bar
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(0, 0, W, 8);

  // "PRICE REDUCED" heading
  ctx.textAlign = 'center';
  ctx.font = 'bold 90px "EB Garamond", Georgia, serif';
  ctx.fillStyle = '#e74c3c';
  ctx.fillText('PRICE REDUCED', W/2, 100);
  ctx.font = '600 28px "Montserrat", sans-serif';
  ctx.fillStyle = pal.accent;
  ctx.fillText(address.toUpperCase(), W/2, 142);
  if (price) {
    ctx.font = '700 38px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText(price, W/2, 186);
  }

  // Photo
  var photoY = price ? 210 : 172, photoH = 592;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var margin = 60;
      ctx.save();
      ctx.beginPath(); roundRect(ctx, margin, photoY, W-margin*2, photoH, 10); ctx.clip();
      var scale = Math.max((W-margin*2)/img.width, photoH/img.height);
      var dw = img.width*scale, dh = img.height*scale;
      ctx.filter = smPhotoFilter();
    ctx.drawImage(img, margin+(W-margin*2-dw)/2, photoY+(photoH-dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = pal.photoBg;
    ctx.save(); roundRect(ctx, 60, photoY, W-120, photoH, 10); ctx.fill(); ctx.restore();
    ctx.fillStyle = pal.label; ctx.font='28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY+photoH/2);
  }

  // Red "ACT NOW" badge bottom-left of photo
  ctx.save();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); roundRect(ctx, 70, photoY+photoH-72, 220, 54, 6); ctx.fill();
  ctx.font = 'bold 22px "Montserrat", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('ACT NOW!', 180, photoY+photoH-38);
  ctx.restore();

  // Details strip
  var sepY = photoY + photoH + 22;
  ctx.strokeStyle = '#e74c3c44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W-60, sepY); ctx.stroke();
  var details = [];
  if (beds) details.push('🛏 ' + beds); if (baths) details.push('🚿 ' + baths);
  if (sqft) details.push('📐 ' + sqft); if (lot) details.push('🌿 ' + lot);
  if (details.length) {
    ctx.textAlign = 'center'; ctx.font = '500 21px "Montserrat", sans-serif'; ctx.fillStyle = pal.text;
    ctx.fillText(details.join('   ·   '), W/2, sepY + 36);
  }
  var stripY = sepY + (details.length ? 58 : 24);
  ctx.strokeStyle = pal.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, stripY); ctx.lineTo(W-60, stripY); ctx.stroke();
  await drawResAgentStrip(ctx, pal, stripY + 18, W, H);
}

async function drawResidentialComingSoon(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  // Dark overlay background
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var address = document.getElementById('sm-address').value || '1234 Maple Street';
  var beds = document.getElementById('sm-res-beds').value || '';
  var baths = document.getElementById('sm-res-baths').value || '';
  var sqft = document.getElementById('sm-res-sqft').value || '';
  var year = document.getElementById('sm-res-year').value || '';
  var lot = document.getElementById('sm-res-lot').value || '';

  // Gold top accent
  ctx.fillStyle = '#C8A84B';
  ctx.fillRect(0, 0, W, 8);

  // "COMING SOON" large heading
  ctx.textAlign = 'center';
  ctx.font = 'bold 100px "EB Garamond", Georgia, serif';
  ctx.fillStyle = pal.text;
  ctx.fillText('COMING', W/2, 116);
  ctx.fillText('SOON', W/2, 210);
  ctx.font = '500 28px "Montserrat", sans-serif';
  ctx.fillStyle = '#C8A84B';
  ctx.fillText(address.toUpperCase(), W/2, 256);

  // Photo (dimmed/blurred effect via low alpha)
  var photoY = 280, photoH = 580;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var margin = 60;
      ctx.save();
      ctx.beginPath(); roundRect(ctx, margin, photoY, W-margin*2, photoH, 12); ctx.clip();
      ctx.globalAlpha = 0.65;
      var scale = Math.max((W-margin*2)/img.width, photoH/img.height);
      var dw = img.width*scale, dh = img.height*scale;
      ctx.filter = smPhotoFilter();
    ctx.drawImage(img, margin+(W-margin*2-dw)/2, photoY+(photoH-dh)/2, dw, dh);
      ctx.globalAlpha = 1;
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = pal.photoBg;
    ctx.save(); roundRect(ctx, 60, photoY, W-120, photoH, 12); ctx.fill(); ctx.restore();
    ctx.fillStyle = pal.label; ctx.font='28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY+photoH/2);
  }

  // Gold clock/teaser overlay on photo
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#C8A84B';
  var badW = 380, badH = 72, badX = (W-badW)/2, badY = photoY + photoH/2 - 36;
  ctx.beginPath(); roundRect(ctx, badX, badY, badW, badH, 8); ctx.fill();
  ctx.font = 'bold 28px "Montserrat", sans-serif';
  ctx.fillStyle = '#152229';
  ctx.textAlign = 'center';
  ctx.fillText('STAY TUNED!', W/2, badY + 48);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Details
  var sepY = photoY + photoH + 22;
  ctx.strokeStyle = pal.accent + '44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W-60, sepY); ctx.stroke();
  var details = [];
  if (beds) details.push('🛏 ' + beds); if (baths) details.push('🚿 ' + baths);
  if (sqft) details.push('📐 ' + sqft); if (lot) details.push('🌿 ' + lot); if (year) details.push('🏗 ' + year);
  if (details.length) {
    ctx.textAlign = 'center'; ctx.font = '500 21px "Montserrat", sans-serif'; ctx.fillStyle = pal.text;
    ctx.fillText(details.join('   ·   '), W/2, sepY + 36);
  }
  var stripY = sepY + (details.length ? 58 : 24);
  ctx.strokeStyle = pal.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, stripY); ctx.lineTo(W-60, stripY); ctx.stroke();
  await drawResAgentStrip(ctx, pal, stripY + 18, W, H);
}

async function drawJustSoldTemplate(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;
  var NAVY  = pal.bg1;
  var CREAM = pal.text;
  var GOLD  = '#C8A84B';
  var LABEL = pal.label;

  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  var propName    = gv('sm-prop-name');
  var address     = gv('sm-address');
  var price       = gv('sm-price');
  var offMkt      = gv('sm-js-off-market');
  var bldgType    = gv('sm-js-bldg-type');
  var buildings   = gv('sm-js-buildings');
  var sqft        = gv('sm-js-sqft');
  var occupancy   = gv('sm-js-occupancy');
  var closeEscrow = gv('sm-js-close-escrow');
  var priceSF     = gv('sm-js-price-sf');
  var priceUnit   = gv('sm-price-unit');
  var units       = gv('sm-units');
  var cap         = gv('sm-cap');
  var yearBuilt   = gv('sm-year-built');
  var noi         = gv('sm-noi');

  var unitMix = [];
  for (var um = 1; um <= 3; um++) {
    var lbl = gv('sm-js-unit' + um + '-label');
    var unt = gv('sm-js-unit' + um + '-units');
    var pct = gv('sm-js-unit' + um + '-pct');
    if (lbl && unt) unitMix.push({ label: lbl, units: unt, pct: pct });
  }

  // ── Section 1: Navy header ──────────────────────────────────────────────
  // Header height: enough for logo row + separator + property name + metric boxes
  var headerH = 390;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, headerH);

  // Top accent line
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, 6);

  // ── TOP LEFT: "JUST SOLD" — bold gold, dominant ─────────────────────────
  ctx.textAlign = 'left';
  ctx.font = '900 62px "Montserrat", sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText('JUST SOLD', 60, 84);

  // Price under the heading
  if (price) {
    ctx.font = '700 36px "Montserrat", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText(price, 60, 126);
  }
  if (offMkt) {
    ctx.font = '600 13px "Montserrat", sans-serif';
    ctx.fillStyle = LABEL;
    ctx.fillText('SOLD ' + offMkt.toUpperCase(), 60, price ? 148 : 116);
  }

  // ── TOP RIGHT: Gateway wordmark image ────────────────────────────────────
  try {
    var lSrc = LOGO_WORDMARK_LIGHT || LOGO_CIRCLE_LIGHT;
    var lImg = await loadImageAsync(lSrc);
    var lH = 54, lW = lH * (lImg.width / lImg.height);
    ctx.drawImage(lImg, W - 60 - lW, 22, lW, lH);
  } catch(e) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px "Montserrat", sans-serif'; ctx.fillStyle = CREAM;
    ctx.fillText('GATEWAY', W - 60, 62);
    ctx.font = '700 13px "Montserrat", sans-serif'; ctx.fillStyle = LABEL;
    ctx.fillText('REAL ESTATE ADVISORS', W - 60, 80);
  }

  // ── Separator ────────────────────────────────────────────────────────────
  var sepY = 162;
  ctx.strokeStyle = GOLD + '55';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(60, sepY); ctx.lineTo(W - 60, sepY); ctx.stroke();

  // ── PROPERTY label + name + address ─────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.font = '600 11px "Montserrat", sans-serif';
  ctx.fillStyle = LABEL;
  ctx.fillText('PROPERTY', 60, sepY + 20);

  var nameY = sepY + 58;
  if (propName) {
    ctx.font = 'bold 38px "Montserrat", sans-serif';
    ctx.fillStyle = CREAM;
    ctx.fillText(propName, 60, nameY);
    nameY += 38;
  }
  if (address) {
    ctx.font = '400 19px "Montserrat", sans-serif';
    ctx.fillStyle = LABEL;
    ctx.fillText(address, 60, nameY);
    nameY += 26;
  }

  // ── 4 metric boxes ───────────────────────────────────────────────────────
  var boxTop = nameY + 14;
  // Clamp so boxes always fit before headerH
  if (boxTop + 86 > headerH - 6) boxTop = headerH - 92;
  var metrics4 = [
    { label: 'TOTAL UNITS',  val: units     || '\u2014' },
    { label: 'PRICE / UNIT', val: priceUnit || (price || '\u2014') },
    { label: 'CAP RATE',     val: cap       || '\u2014' },
    { label: 'YEAR BUILT',   val: yearBuilt || '\u2014' }
  ];
  var mbW = (W - 120 - 3 * 10) / 4;
  metrics4.forEach(function(m, mi) {
    var mx = 60 + mi * (mbW + 10);
    ctx.strokeStyle = GOLD + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, boxTop, mbW, 84);
    ctx.font = '600 11px "Montserrat", sans-serif';
    ctx.fillStyle = LABEL;
    ctx.textAlign = 'center';
    ctx.fillText(m.label, mx + mbW / 2, boxTop + 20);
    ctx.font = 'bold 28px "Montserrat", sans-serif';
    ctx.fillStyle = CREAM;
    ctx.fillText(m.val, mx + mbW / 2, boxTop + 58);
  });
  ctx.textAlign = 'left';

  // ── Section 2: Hero photo — taller ───────────────────────────────────────
  var photoY = headerH + 2;
  var photoH = 400;                           // was 290 — now much taller
  var photoBottom = photoY + photoH;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, photoY, W, photoH);
      ctx.clip();
      var scale = Math.max(W / img.width, photoH / img.height);
      var dw = img.width * scale, dh = img.height * scale;
      ctx.filter = smPhotoFilter();
      ctx.drawImage(img, (W - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#2a3e4e';
    ctx.fillRect(0, photoY, W, photoH);
    ctx.fillStyle = LABEL;
    ctx.textAlign = 'center';
    ctx.font = '24px Montserrat';
    ctx.fillText('Property Photo', W / 2, photoY + photoH / 2);
    ctx.textAlign = 'left';
  }

  // ── Section 3: Data columns ───────────────────────────────────────────────
  var dataY = photoBottom;

  var overviewRows = [];
  if (bldgType)    overviewRows.push({ k: 'Building type',    v: bldgType    });
  if (buildings)   overviewRows.push({ k: 'Buildings',        v: buildings   });
  if (units)       overviewRows.push({ k: 'Total units',      v: units       });
  if (sqft)        overviewRows.push({ k: 'Total sq ft',      v: sqft        });
  if (occupancy)   overviewRows.push({ k: 'Occupancy at sale',v: occupancy   });
  if (closeEscrow) overviewRows.push({ k: 'Close of escrow',  v: closeEscrow });

  var financialRows = [];
  if (price)     financialRows.push({ k: 'Sale price',  v: price     });
  if (priceUnit) financialRows.push({ k: 'Price / unit',v: priceUnit });
  if (priceSF)   financialRows.push({ k: 'Price / SF',  v: priceSF   });
  if (noi)       financialRows.push({ k: 'NOI',         v: noi       });
  if (cap)       financialRows.push({ k: 'Cap rate',    v: cap       });
  if (offMkt)    financialRows.push({ k: 'Off market',  v: 'Yes'     });

  // Light background palette
  var dataBg       = (pal.logoKey === 'dark') ? '#f0ede6' : '#192c3a';
  var dataTextMain = (pal.logoKey === 'dark') ? '#1E2F39' : '#E4E3D4';
  // ── MORE VISIBLE label colour (was #8aA4B4 — too faint) ─────────────────
  var dataTextSub  = (pal.logoKey === 'dark') ? '#3d5260' : '#C4D8E6';
  var divColor     = (pal.logoKey === 'dark') ? '#ccc8be' : '#2e4757';
  var rowH   = 36;
  var maxRows = Math.max(overviewRows.length, financialRows.length, 1);
  var unitMixH = unitMix.length > 0 ? (50 + unitMix.length * 66 + 8) : 0;
  var dataH  = 56 + maxRows * rowH + unitMixH + 20;

  ctx.fillStyle = dataBg;
  ctx.fillRect(0, dataY, W, dataH);

  var colW = (W - 120) / 2;
  var colL = 60, colR = 60 + colW + 20;
  var colHeaderY = dataY + 30;

  // Section header labels — slightly larger and brighter
  ctx.font = '700 13px "Montserrat", sans-serif';
  ctx.fillStyle = dataTextSub;
  ctx.textAlign = 'left';
  ctx.fillText('PROPERTY OVERVIEW', colL, colHeaderY);
  ctx.fillText('FINANCIAL SUMMARY', colR, colHeaderY);

  // Column divider line
  ctx.strokeStyle = divColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colL + colW + 10, dataY + 10);
  ctx.lineTo(colL + colW + 10, dataY + dataH - 10);
  ctx.stroke();

  var rowStartY = colHeaderY + 20;
  var maxR = Math.max(overviewRows.length, financialRows.length);
  for (var ri = 0; ri < maxR; ri++) {
    var rowY2 = rowStartY + ri * rowH;
    // Row dividers
    ctx.strokeStyle = divColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(colL, rowY2 - 2); ctx.lineTo(colL + colW, rowY2 - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(colR, rowY2 - 2); ctx.lineTo(colR + colW - 20, rowY2 - 2); ctx.stroke();

    if (overviewRows[ri]) {
      ctx.font = '400 17px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextSub;
      ctx.textAlign = 'left';
      ctx.fillText(overviewRows[ri].k, colL, rowY2 + 22);
      ctx.font = '600 17px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextMain;
      ctx.textAlign = 'right';
      ctx.fillText(overviewRows[ri].v, colL + colW, rowY2 + 22);
    }
    if (financialRows[ri]) {
      ctx.font = '400 17px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextSub;
      ctx.textAlign = 'left';
      ctx.fillText(financialRows[ri].k, colR, rowY2 + 22);
      ctx.font = '600 17px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextMain;
      ctx.textAlign = 'right';
      ctx.fillText(financialRows[ri].v, colR + colW - 20, rowY2 + 22);
    }
  }

  // Unit Mix
  if (unitMix.length > 0) {
    var umY = rowStartY + maxR * rowH + 16;
    ctx.font = '700 12px "Montserrat", sans-serif';
    ctx.fillStyle = dataTextSub;
    ctx.textAlign = 'left';
    ctx.fillText('UNIT MIX', colL, umY);
    umY += 16;
    var umBoxW = (W - 120 - (unitMix.length - 1) * 14) / unitMix.length;
    unitMix.forEach(function(um2, umi) {
      var umX2 = colL + umi * (umBoxW + 14);
      ctx.strokeStyle = divColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(umX2, umY, umBoxW, 56);
      ctx.font = '700 16px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextMain;
      ctx.textAlign = 'left';
      ctx.fillText(um2.label, umX2 + 12, umY + 22);
      ctx.font = '400 14px "Montserrat", sans-serif';
      ctx.fillStyle = dataTextSub;
      ctx.fillText(um2.units + ' units' + (um2.pct ? '  \u2022  ' + um2.pct : ''), umX2 + 12, umY + 42);
    });
  }

  // ── Section 4: Navy footer ────────────────────────────────────────────────
  var footerY = dataY + dataH;
  var footerH = H - footerY;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, footerY, W, footerH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, footerY, W, 3);

  var fY = footerY + 44;
  if (smAgents.length > 0 && smAgents[0].name) {
    var ag3 = smAgents[0];
    var photoOffsetX = 0;
    if (ag3.photo) {
      try {
        var agImg3 = await loadImageAsync(ag3.photo);
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, 60, fY, 120, 152, 10);
        ctx.clip();
        var _scagImg3 = Math.max(120/agImg3.width, 152/agImg3.height);
        var _dwagImg3 = agImg3.width * _scagImg3, _dhagImg3 = agImg3.height * _scagImg3;
        ctx.drawImage(agImg3, 60 + (120 - _dwagImg3)/2, fY + (152 - _dhagImg3)/2, _dwagImg3, _dhagImg3);
        ctx.restore();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        roundRect(ctx, 60, fY, 120, 152, 10);
        ctx.stroke();
        photoOffsetX = 136;
      } catch(e3) {}
    }
    var ftX = 60 + photoOffsetX;
    ctx.font = '400 12px "Montserrat", sans-serif';
    ctx.fillStyle = LABEL;
    ctx.textAlign = 'left';
    ctx.fillText('REPRESENTED BY', ftX, fY);
    ctx.font = 'bold 24px "Montserrat", sans-serif';
    ctx.fillStyle = CREAM;
    ctx.fillText(ag3.name.toUpperCase(), ftX, fY + 28);
    if (ag3.title) {
      ctx.font = '400 15px "Montserrat", sans-serif';
      ctx.fillStyle = LABEL;
      ctx.fillText(ag3.title.toUpperCase(), ftX, fY + 48);
    }
    if (ag3.phone) { ctx.font = '400 14px "Montserrat"'; ctx.fillStyle = LABEL; ctx.fillText(ag3.phone, ftX, fY + 68); }
    if (ag3.email) { ctx.fillText(ag3.email, ftX, fY + 86); }
  }

  // Gateway logo — anchored top-right of footer, sized 80×80
  var jsLogoSz = 80;
  var jsLogoX  = W - 60 - jsLogoSz;
  var jsLogoY  = footerY + 14;
  try {
    var lSrc = (pal.logoKey === 'dark') ? (LOGO_ROUND_SUBMARK || '') : (LOGO_CIRCLE_LIGHT || '');
    if (lSrc) {
      var lImg = await loadImageAsync(lSrc);
      ctx.drawImage(lImg, jsLogoX, jsLogoY, jsLogoSz, jsLogoSz);
    }
  } catch(e) {}

  // Company info — right-aligned, sitting left of the logo
  var jsCompX = jsLogoX - 16;
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px "Montserrat", sans-serif';
  ctx.fillStyle = CREAM;
  ctx.fillText('GATEWAY REAL ESTATE ADVISORS', jsCompX, footerY + 38);
  ctx.font = '400 13px "Montserrat", sans-serif';
  ctx.fillStyle = LABEL;
  ctx.fillText('gatewayrealtyadvisors.com', jsCompX, footerY + 58);
  ctx.fillText('info@gatewayrealtyadvisors.com', jsCompX, footerY + 76);
  ctx.fillText('700 Nebraska St  \u2022  Sioux City, IA 51101', jsCompX, footerY + 94);
}

async function drawCommercialTemplate(canvas, ctx, templateName) {
  var W = canvas.width, H = canvas.height;
  var pal = PALETTES[smPalette] || PALETTES.navy;

  // Background — uses palette
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  var propName = (document.getElementById('sm-prop-name') && document.getElementById('sm-prop-name').value) ? document.getElementById('sm-prop-name').value : '';
  var address  = document.getElementById('sm-address').value || '';
  var price    = document.getElementById('sm-price').value || '';
  var commSF   = document.getElementById('sm-comm-sf') ? document.getElementById('sm-comm-sf').value : '';
  var commRate = document.getElementById('sm-comm-rate') ? document.getElementById('sm-comm-rate').value : '';
  var commDetail = document.getElementById('sm-comm-detail') ? document.getElementById('sm-comm-detail').value : '';

  // Template-specific accent colors
  var accentMap = {
    'For Lease': '#5BA4CF',
    'Just Leased': '#4CAF50',
    'Price Reduced': '#e74c3c',
    'Investment Opportunity': '#C8A84B'
  };
  var accent = accentMap[templateName] || '#C8A84B';

  // Top accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 8);

  // Template heading — use palette text color
  ctx.textAlign = 'left';
  ctx.font = 'bold 96px "EB Garamond", Georgia, serif';
  ctx.fillStyle = pal.text;
  var headingText = templateName.toUpperCase();
  if (templateName === 'Investment Opportunity') { headingText = 'INVESTMENT'; }
  ctx.fillText(headingText, 60, 140);
  if (templateName === 'Investment Opportunity') {
    ctx.fillText('OPPORTUNITY', 60, 240);
  }

  // Accent underline
  ctx.fillStyle = accent;
  ctx.fillRect(60, templateName === 'Investment Opportunity' ? 260 : 160, 200, 5);

  // Property photo — slightly shorter to give more room below for details
  var photoY = templateName === 'Investment Opportunity' ? 300 : 210;
  var photoH = templateName === 'Investment Opportunity' ? 420 : 500;
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      var margin = 60;
      ctx.save();
      roundRect(ctx, margin, photoY, W - margin*2, photoH, 8);
      ctx.clip();
      var scale = Math.max((W - margin*2)/img.width, photoH/img.height);
      var dw = img.width * scale, dh = img.height * scale;
      ctx.filter = smPhotoFilter();
      ctx.drawImage(img, margin + (W - margin*2 - dw)/2, photoY + (photoH - dh)/2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#162028';
    ctx.save();
    roundRect(ctx, 60, photoY, W - 120, photoH, 8);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a4e5a';
    ctx.textAlign = 'center';
    ctx.font = '28px Montserrat';
    ctx.fillText('Property Photo', W/2, photoY + photoH/2);
  }

  // ── Metrics overlay at bottom of photo ─────────────────────────────────
  var SM_METRIC_DEFS_COMM = [
    { key: 'price-unit', label: 'Price/Unit' },
    { key: 'price-sf',   label: 'Price/SF'   },
    { key: 'units',      label: 'Units'       },
    { key: 'cap',        label: 'Cap Rate'    },
    { key: 'noi',        label: 'NOI'         },
    { key: 'year-built', label: 'Year Built'  },
    { key: 'occupancy',  label: 'Occupancy'   },
    { key: 'lot-size',   label: 'Lot Size'    },
    { key: 'bldg-sf',    label: 'Building SF' },
    { key: 'zoning',     label: 'Zoning'      },
    { key: 'market-badge', label: 'Badge'     },
    { key: 'dom',        label: 'Days on Mkt' },
    { key: 'submarket',  label: 'Market'      },
    { key: 'prop-class', label: 'Class'       },
    { key: 'financing',  label: 'Financing'   },
    { key: 'sf',         label: 'SF / Acreage'}
  ];
  var metrics = [];
  SM_METRIC_DEFS_COMM.forEach(function(def) {
    var toggle = document.getElementById('sm-show-' + def.key);
    var input  = document.getElementById('sm-' + def.key);
    if (toggle && toggle.checked && input && input.value) {
      metrics.push({ label: def.label, value: input.value });
    }
  });

  if (metrics.length > 0) {
    var maxPerRow = 5;
    var rowH = 54;
    var rowGap = 6;
    // Cap at 2 rows max
    var cappedMetrics = metrics.slice(0, maxPerRow * 2);
    var rows = [];
    for (var ri = 0; ri < cappedMetrics.length; ri += maxPerRow) {
      rows.push(cappedMetrics.slice(ri, ri + maxPerRow));
    }
    var totalOverlayH = rows.length * (rowH + rowGap) + 14;
    var overlayY = photoY + photoH - totalOverlayH;

    // Gradient overlay — transparent at top, dark at bottom (keeps photo visible)
    ctx.save();
    ctx.beginPath();  // must clear path — roundRect() does not call beginPath()
    roundRect(ctx, 60, overlayY, W - 120, totalOverlayH, 0);
    var metGrad = ctx.createLinearGradient(0, overlayY, 0, overlayY + totalOverlayH);
    metGrad.addColorStop(0, 'rgba(0,0,0,0)');
    metGrad.addColorStop(0.3, 'rgba(0,0,0,0.55)');
    metGrad.addColorStop(1, 'rgba(0,0,0,0.80)');
    ctx.fillStyle = metGrad;
    ctx.fill();
    ctx.restore();

    rows.forEach(function(rowMetrics, rowIdx) {
      var rowY = overlayY + 10 + rowIdx * (rowH + rowGap);
      var tileW = (W - 120) / rowMetrics.length;
      rowMetrics.forEach(function(m, mi) {
        var mx = 60 + mi * tileW;
        // Divider
        if (mi > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mx, rowY + 4);
          ctx.lineTo(mx, rowY + rowH - 4);
          ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.font = '500 11px "Montserrat", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(m.label.toUpperCase(), mx + tileW / 2, rowY + 16);
        ctx.font = '700 20px "Montserrat", sans-serif';
        ctx.fillStyle = accent;
        ctx.fillText(m.value, mx + tileW / 2, rowY + 42);
      });
    });
    ctx.textAlign = 'left';
  }
  // ── End metrics overlay ─────────────────────────────────────────────────

  // Property details section — name & address on separate lines
  var detY = photoY + photoH + 44;
  ctx.textAlign = 'left';

  if (propName) {
    ctx.font = 'bold 34px "Montserrat", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(propName, 60, detY);
    detY += 44;
  } else if (address) {
    // If no separate name, show address in accent as first line
    ctx.font = 'bold 34px "Montserrat", sans-serif';
    ctx.fillStyle = accent;
    ctx.fillText(address, 60, detY);
    detY += 44;
    address = ''; // don't repeat
  }

  if (address) {
    ctx.font = '500 24px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText(address, 60, detY);
    detY += 34;
  }

  if (commRate || price) {
    ctx.font = '500 24px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText(commRate || price, 60, detY);
    detY += 34;
  }

  var sfDetailY = detY;
  if (commSF) {
    ctx.font = '400 20px "Montserrat", sans-serif';
    ctx.fillStyle = pal.accent;
    ctx.fillText(commSF, 60, sfDetailY);
    sfDetailY += 30;
  }
  if (commDetail) {
    ctx.font = 'italic 20px "EB Garamond", Georgia, serif';
    ctx.fillStyle = pal.label;
    ctx.fillText(commDetail, 60, sfDetailY);
    sfDetailY += 30;
  }

  // Separator before agents
  var agentSepY = Math.max(sfDetailY + 32, detY + 120);
  ctx.strokeStyle = pal.accent + '44';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, agentSepY); ctx.lineTo(W - 60, agentSepY); ctx.stroke();

  // Agent section
  var agentY = agentSepY + 24;
  if (smAgents.length > 0 && smAgents[0].name) {
    for (var ai2 = 0; ai2 < Math.min(smAgents.length, 2); ai2++) {
      var ag2 = smAgents[ai2];
      if (!ag2.name) continue;
      var agX2 = 60 + ai2 * 470;
      if (ag2.photo) {
        try {
          var agImg2 = await loadImageAsync(ag2.photo);
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, agX2, agentY, 130, 165, 10);
          ctx.clip();
          var _scagImg2 = Math.max(130/agImg2.width, 165/agImg2.height);
          var _dwagImg2 = agImg2.width * _scagImg2, _dhagImg2 = agImg2.height * _scagImg2;
          ctx.drawImage(agImg2, agX2 + (130 - _dwagImg2)/2, agentY + (165 - _dhagImg2)/2, _dwagImg2, _dhagImg2);
          ctx.restore();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          roundRect(ctx, agX2, agentY, 130, 165, 10);
          ctx.stroke();
        } catch(e2) {}
      }
      var tX2 = ag2.photo ? agX2 + 146 : agX2;
      ctx.font = '700 23px "Montserrat", sans-serif';
      ctx.fillStyle = pal.text;
      ctx.textAlign = 'left';
      ctx.fillText(ag2.name, tX2, agentY + 22);
      ctx.font = '400 18px "Montserrat", sans-serif';
      ctx.fillStyle = accent;
      if (ag2.title)   ctx.fillText(ag2.title,   tX2, agentY + 44);
      ctx.fillStyle = pal.accent;
      if (ag2.phone)   ctx.fillText(ag2.phone,   tX2, agentY + 65);
      if (ag2.email) { ctx.font = '400 16px Montserrat'; ctx.fillStyle = pal.accent; ctx.fillText(ag2.email, tX2, agentY + 84); }
      if (ag2.license) { ctx.font = '400 15px Montserrat'; ctx.fillStyle = pal.logoKey === 'dark' ? '#5a4832' : '#B8CED8'; ctx.fillText(ag2.license, tX2, agentY + 102); }
    }
  }

  // Gateway circular logo — bottom right
  try {
    var logoSrc = (pal && pal.logoKey === 'dark') ? (LOGO_ROUND_SUBMARK || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png') : (LOGO_CIRCLE_LIGHT || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png');
    var logoImg = await loadImageAsync(logoSrc);
    var sz = 120;
    ctx.drawImage(logoImg, W - 60 - sz, H - sz - 30, sz, sz);
  } catch(e) {}

  // Website bottom center
  ctx.textAlign = 'center';
  ctx.font = '400 20px "Montserrat", sans-serif';
  ctx.fillStyle = pal.label;
  ctx.fillText('www.gatewayreadvisors.com  |  712-226-8000', W/2, H - 28);
}
// ── Format selector helpers ───────────────────────────────────────────────
function smCurrentFormat() {
  var sel = document.getElementById('sm-format');
  return sel ? sel.value : 'portrait';
}

function onFormatChange() {
  var fmt = smCurrentFormat();
  var label = document.getElementById('sm-preview-label');
  var dlSquare = document.getElementById('sm-dl-square');
  var dlMailer = document.getElementById('sm-dl-mailer');
  var dlPng   = document.querySelector('[onclick="downloadSocialGraphic()"]');
  var isMailer = fmt === 'mailer-6x4' || fmt === 'mailer-85x55';
  if (label) label.textContent = {
    portrait: 'Live Preview (1080×1350)',
    square:   'Live Preview (1080×1080)',
    'mailer-6x4':   'Live Preview — Mailer 6×4',
    'mailer-85x55': 'Live Preview — Mailer 8.5×5.5'
  }[fmt] || 'Live Preview';
  if (dlSquare) dlSquare.style.display = 'none';
  if (dlMailer) dlMailer.style.display = isMailer ? '' : 'none';
  updateSocialPreview();
}

// ── Collect commercial metric chips ──────────────────────────────────────
function smGetMetrics(max) {
  var defs = [
    { key:'price-unit', label:'Price/Unit' }, { key:'price-sf', label:'Price/SF' },
    { key:'units', label:'Units' },           { key:'cap', label:'Cap Rate' },
    { key:'noi', label:'NOI' },               { key:'year-built', label:'Year Built' },
    { key:'occupancy', label:'Occupancy' },   { key:'lot-size', label:'Lot Size' },
    { key:'bldg-sf', label:'Bldg SF' },       { key:'zoning', label:'Zoning' },
    { key:'financing', label:'Financing' },   { key:'sf', label:'SF/Acreage' },
    { key:'submarket', label:'Market' },      { key:'prop-class', label:'Class' }
  ];
  var out = [];
  defs.forEach(function(d) {
    var tog = document.getElementById('sm-show-' + d.key);
    var inp = document.getElementById('sm-' + d.key);
    if (tog && tog.checked && inp && inp.value) out.push({ label: d.label, value: inp.value });
  });
  return max ? out.slice(0, max) : out;
}

// ── Shared field reads ────────────────────────────────────────────────────
function smFields() {
  return {
    propName:   (document.getElementById('sm-prop-name')   || {}).value || '',
    address:    (document.getElementById('sm-address')     || {}).value || '',
    price:      (document.getElementById('sm-price')       || {}).value || '',
    commSF:     (document.getElementById('sm-comm-sf')     || {}).value || '',
    commRate:   (document.getElementById('sm-comm-rate')   || {}).value || '',
    commDetail: (document.getElementById('sm-comm-detail') || {}).value || ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM TEMPLATE 1 — EXCLUSIVELY OFFERED
// Full-bleed photo · dark gradient overlay · editorial typography
// ═══════════════════════════════════════════════════════════════════════════
async function drawCommExclusive(canvas, ctx, heading) {
  var W = canvas.width, H = canvas.height;
  var f = smFields();
  var metrics = smGetMetrics(5);
  var GOLD = '#C8A84B', BLUE = '#A2B6C0', CREAM = '#E4E3D4', LEFT = 56;

  // ── Full-bleed photo ──────────────────────────────────────────────────
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      ctx.save(); ctx.filter = smPhotoFilter();
      var sc = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width*sc)/2, (H - img.height*sc)/2, img.width*sc, img.height*sc);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#0E1C24'; ctx.fillRect(0, 0, W, H);
  }

  // ── Dark gradient overlay ─────────────────────────────────────────────
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    'rgba(8,16,22,0.12)');
  grad.addColorStop(0.40, 'rgba(8,16,22,0.25)');
  grad.addColorStop(0.68, 'rgba(8,16,22,0.88)');
  grad.addColorStop(1,    'rgba(8,16,22,0.98)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // ── TOP: gold edge + badge + logo ─────────────────────────────────────
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 6);

  var badgeText = heading === 'comm-exclusive'        ? 'EXCLUSIVELY OFFERED' :
                  heading === 'comm-just-sold-premium' ? 'JUST SOLD' :
                  heading.replace('comm-','').replace(/-/g,' ').toUpperCase();
  ctx.textAlign = 'left';
  ctx.font = '800 34px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
  ctx.fillText(badgeText, LEFT, 68);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(LEFT, 77); ctx.lineTo(LEFT + ctx.measureText(badgeText).width, 77); ctx.stroke();

  try {
    var lSrc = LOGO_WORDMARK_LIGHT || LOGO_CIRCLE_LIGHT;
    var lImg = await loadImageAsync(lSrc);
    var lH = 60, lW = lH * (lImg.width / lImg.height);
    ctx.drawImage(lImg, W - LEFT - lW, 16, lW, lH);
  } catch(e) {}

  // ── BOTTOM CONTENT — drawn bottom → top with explicit textAlign ───────
  var y = H - 52;

  // Contact / website line (centered)
  ctx.textAlign = 'center';
  ctx.font = '400 18px "Montserrat", sans-serif'; ctx.fillStyle = 'rgba(162,182,192,0.6)';
  ctx.fillText('gatewayreadvisors.com  ·  712-226-8000', W / 2, y);
  y -= 46;

  // ── Agents (left-aligned, deduplicated) ──────────────────────────────
  var validAgents = smAgents.filter(function(a, idx) {
    if (!a || !a.name || !a.name.trim()) return false;
    // Deduplicate by name
    return smAgents.findIndex(function(b) { return b && b.name === a.name; }) === idx;
  }).slice(0, 2);

  if (validAgents.length > 0) {
    var agSlotW = validAgents.length === 2 ? Math.floor((W - 112 - 24) / 2) : W - 112;
    var photoSz = 80;

    for (var ai = 0; ai < validAgents.length; ai++) {
      var ag = validAgents[ai];
      var axBase = LEFT + ai * (agSlotW + 24);
      var textX = axBase;

      if (ag.photo) {
        try {
          var apImg = await loadImageAsync(ag.photo);
          var cxC = axBase + photoSz / 2, cyC = y - photoSz / 2 - 4;
          ctx.save(); ctx.beginPath(); ctx.arc(cxC, cyC, photoSz/2, 0, Math.PI*2); ctx.clip();
          var apSc = Math.max(photoSz/apImg.width, photoSz/apImg.height);
          ctx.drawImage(apImg, cxC - apImg.width*apSc/2, cyC - apImg.height*apSc/2, apImg.width*apSc, apImg.height*apSc);
          ctx.restore();
          ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(cxC, cyC, photoSz/2, 0, Math.PI*2); ctx.stroke();
          textX = axBase + photoSz + 18;
        } catch(e) {}
      }

      // Larger agent text — always textAlign = 'left'
      ctx.textAlign = 'left';
      var lineBase = y - 8;
      ctx.font = '700 28px "Montserrat", sans-serif'; ctx.fillStyle = CREAM;
      ctx.fillText(ag.name, textX, lineBase - 48);
      ctx.font = '400 20px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
      if (ag.title) { ctx.fillText(ag.title, textX, lineBase - 22); }
      if (ag.phone) { ctx.font = '600 20px "Montserrat", sans-serif'; ctx.fillStyle = GOLD; ctx.fillText(ag.phone, textX, lineBase + 4); }
    }
    y -= (ag.photo ? photoSz + 24 : 80);
  }

  // Separator
  ctx.strokeStyle = 'rgba(162,182,192,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(W - LEFT, y); ctx.stroke();
  y -= 24;

  // ── Metrics chips — centered row, bigger & bolder ─────────────────────
  if (metrics.length > 0) {
    var mCount  = Math.min(metrics.length, 5);
    var mGap    = 10;
    var mH      = 92;
    var mW      = Math.floor((W - LEFT * 2 - mGap * (mCount - 1)) / mCount);
    var mStartX = LEFT;
    metrics.slice(0, mCount).forEach(function(m) {
      // Card fill + gold border
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath(); roundRect(ctx, mStartX, y - mH, mW, mH, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(200,168,75,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); roundRect(ctx, mStartX, y - mH, mW, mH, 10); ctx.stroke();
      // Value — big + gold
      ctx.textAlign = 'center';
      ctx.font = '700 30px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
      ctx.fillText(m.value.length > 10 ? m.value.slice(0,10) : m.value, mStartX + mW/2, y - mH + 42);
      // Label — readable
      ctx.font = '600 13px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
      ctx.fillText(m.label.toUpperCase(), mStartX + mW/2, y - mH + 68);
      mStartX += mW + mGap;
    });
    y -= mH + 22;
  }

  // Price — always reset textAlign to left before drawing
  ctx.textAlign = 'left';
  if (f.price) {
    ctx.font = '300 52px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
    ctx.fillText(f.price, LEFT, y); y -= 64;
  }

  // Address — only show if different from property name
  ctx.textAlign = 'left';
  if (f.address && f.address !== f.propName) {
    ctx.font = '500 22px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
    ctx.fillText(f.address.toUpperCase(), LEFT, y); y -= 44;
  }

  // Property name — serif italic, always textAlign = left
  var nameText = f.propName || f.address || 'Property Name';
  ctx.textAlign = 'left';
  ctx.font = 'italic 600 60px "EB Garamond", Georgia, serif'; ctx.fillStyle = CREAM;
  var nmW = W - LEFT * 2;
  if (ctx.measureText(nameText).width > nmW) {
    var words = nameText.split(' '), line = '';
    words.forEach(function(w) {
      var test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > nmW && line) { ctx.fillText(line, LEFT, y); line = w; y -= 70; }
      else { line = test; }
    });
    ctx.fillText(line, LEFT, y);
  } else {
    ctx.fillText(nameText, LEFT, y);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM TEMPLATE 2 — INVESTMENT ALERT
// Full-bleed photo · Dark gradient overlay · Bold 3-column metrics grid
// Works cleanly across portrait, square, and mailer formats
// ═══════════════════════════════════════════════════════════════════════════
async function drawCommInvestmentAlert(canvas, ctx) {
  var W = canvas.width, H = canvas.height;
  var f = smFields();
  var metrics = smGetMetrics(6);
  var GOLD = '#C8A84B', BLUE = '#A2B6C0', CREAM = '#E4E3D4', LEFT = 56;

  // ── Full-bleed photo ───────────────────────────────────────────────────
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      ctx.save(); ctx.filter = smPhotoFilter();
      var sc = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width*sc)/2, (H - img.height*sc)/2, img.width*sc, img.height*sc);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#0E1C24'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a3040'; ctx.textAlign = 'center'; ctx.font = '28px Montserrat';
    ctx.fillText('Property Photo', W/2, H/2);
  }

  // ── Dark gradient — clears top, heavy bottom ───────────────────────────
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    'rgba(6,13,18,0.10)');
  grad.addColorStop(0.28, 'rgba(6,13,18,0.22)');
  grad.addColorStop(0.52, 'rgba(6,13,18,0.78)');
  grad.addColorStop(1,    'rgba(6,13,18,0.97)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // ── TOP: gold accent bar + badge + logo ────────────────────────────────
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 6);

  ctx.textAlign = 'left';
  ctx.font = '800 34px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
  ctx.fillText('INVESTMENT ALERT', LEFT, 66);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(LEFT, 75); ctx.lineTo(LEFT + ctx.measureText('INVESTMENT ALERT').width, 75); ctx.stroke();

  try {
    var lSrc = LOGO_WORDMARK_LIGHT || LOGO_CIRCLE_LIGHT;
    var lImg = await loadImageAsync(lSrc);
    var lH = 60, lW = lH * (lImg.width / lImg.height);
    ctx.drawImage(lImg, W - LEFT - lW, 14, lW, lH);
  } catch(e) {}

  // ── BOTTOM CONTENT — built bottom → top ───────────────────────────────
  var y = H - 50;

  // Website / contact line
  ctx.textAlign = 'center';
  ctx.font = '400 18px "Montserrat", sans-serif'; ctx.fillStyle = 'rgba(162,182,192,0.6)';
  ctx.fillText('gatewayreadvisors.com  ·  712-226-8000', W/2, y);
  y -= 48;

  // ── Agents ────────────────────────────────────────────────────────────
  var validAgents = smAgents.filter(function(a, idx) {
    if (!a || !a.name || !a.name.trim()) return false;
    return smAgents.findIndex(function(b) { return b && b.name === a.name; }) === idx;
  }).slice(0, 2);

  if (validAgents.length > 0) {
    var agSlotW = validAgents.length === 2 ? Math.floor((W - 112 - 24) / 2) : W - 112;
    var photoSz = 80;
    for (var ai = 0; ai < validAgents.length; ai++) {
      var ag = validAgents[ai];
      var axBase = LEFT + ai * (agSlotW + 24);
      var textX = axBase;
      if (ag.photo) {
        try {
          var apImg = await loadImageAsync(ag.photo);
          var cxC = axBase + photoSz/2, cyC = y - photoSz/2 - 4;
          ctx.save(); ctx.beginPath(); ctx.arc(cxC, cyC, photoSz/2, 0, Math.PI*2); ctx.clip();
          var apSc = Math.max(photoSz/apImg.width, photoSz/apImg.height);
          ctx.drawImage(apImg, cxC - apImg.width*apSc/2, cyC - apImg.height*apSc/2, apImg.width*apSc, apImg.height*apSc);
          ctx.restore();
          ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(cxC, cyC, photoSz/2, 0, Math.PI*2); ctx.stroke();
          textX = axBase + photoSz + 18;
        } catch(e) {}
      }
      ctx.textAlign = 'left';
      var lBase = y - 8;
      ctx.font = '700 28px "Montserrat", sans-serif'; ctx.fillStyle = CREAM;
      ctx.fillText(ag.name, textX, lBase - 48);
      ctx.font = '400 20px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
      if (ag.title) ctx.fillText(ag.title, textX, lBase - 22);
      if (ag.phone) { ctx.font = '600 20px "Montserrat", sans-serif'; ctx.fillStyle = GOLD; ctx.fillText(ag.phone, textX, lBase + 4); }
    }
    y -= (validAgents[0].photo ? photoSz + 26 : 82);
  }

  // Separator above agents
  ctx.strokeStyle = 'rgba(162,182,192,0.30)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(W - LEFT, y); ctx.stroke();
  y -= 26;

  // ── Metrics — 3-column cards, up to 6 metrics (2 rows) ────────────────
  if (metrics.length > 0) {
    var mPerRow = 3;
    var mCount  = Math.min(metrics.length, 6);
    var numRows = Math.ceil(mCount / mPerRow);
    var mGap    = 10;
    var mH      = 90;
    var mW      = Math.floor((W - LEFT * 2 - mGap * (mPerRow - 1)) / mPerRow);
    var totalMetH = numRows * (mH + mGap) - mGap;

    for (var ri = 0; ri < numRows; ri++) {
      var rowSlice = metrics.slice(ri * mPerRow, (ri + 1) * mPerRow);
      var rowTopY  = y - totalMetH + ri * (mH + mGap);
      var mX = LEFT;
      rowSlice.forEach(function(m) {
        // Card
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); roundRect(ctx, mX, rowTopY, mW, mH, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(200,168,75,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); roundRect(ctx, mX, rowTopY, mW, mH, 10); ctx.stroke();
        // Value
        ctx.textAlign = 'center';
        ctx.font = '700 30px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
        ctx.fillText(m.value.length > 10 ? m.value.slice(0, 10) : m.value, mX + mW/2, rowTopY + 44);
        // Label
        ctx.font = '600 12px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
        ctx.fillText(m.label.toUpperCase(), mX + mW/2, rowTopY + 68);
        mX += mW + mGap;
      });
    }
    y -= totalMetH + 26;
  }

  // ── Price ─────────────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  if (f.price) {
    ctx.font = '300 52px "Montserrat", sans-serif'; ctx.fillStyle = GOLD;
    ctx.fillText(f.price, LEFT, y); y -= 66;
  }

  // ── Address (if different from name) ──────────────────────────────────
  if (f.address && f.address !== f.propName) {
    ctx.font = '500 22px "Montserrat", sans-serif'; ctx.fillStyle = BLUE;
    ctx.fillText(f.address.toUpperCase(), LEFT, y); y -= 46;
  }

  // ── Property name — large serif italic ────────────────────────────────
  var nameText = f.propName || f.address || 'Property Name';
  ctx.textAlign = 'left';
  ctx.font = 'italic 600 60px "EB Garamond", Georgia, serif'; ctx.fillStyle = CREAM;
  var nmW = W - LEFT * 2;
  if (ctx.measureText(nameText).width > nmW) {
    var words = nameText.split(' '), line = '';
    words.forEach(function(w) {
      var test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > nmW && line) { ctx.fillText(line, LEFT, y); line = w; y -= 70; }
      else line = test;
    });
    ctx.fillText(line, LEFT, y);
  } else {
    ctx.fillText(nameText, LEFT, y);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAILER LAYOUT — Renders at target print dimensions (6×4 or 8.5×5.5)
// Landscape · Simple · High-impact · Print-ready
// ═══════════════════════════════════════════════════════════════════════════
async function drawMailerLayout(canvas, ctx, mailerW, mailerH) {
  canvas.width  = mailerW;
  canvas.height = mailerH;
  var f = smFields();
  var metrics = smGetMetrics(4);
  var heading = document.getElementById('sm-heading').value;
  var GOLD = '#C8A84B'; var BLUE = '#A2B6C0'; var CREAM = '#E4E3D4';
  var splitX = Math.round(mailerW * 0.44);

  // Left dark panel
  ctx.fillStyle = '#0D1B22'; ctx.fillRect(0, 0, splitX, mailerH);
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, 5, mailerH);

  // Right — full bleed photo
  var photoSrc = smPhotos[0];
  if (photoSrc) {
    try {
      var img = await loadImageAsync(photoSrc);
      ctx.save(); ctx.rect(splitX, 0, mailerW - splitX, mailerH); ctx.clip();
      ctx.filter = smPhotoFilter();
      var sc = Math.max((mailerW - splitX) / img.width, mailerH / img.height);
      var dw = img.width * sc, dh = img.height * sc;
      ctx.drawImage(img, splitX + ((mailerW - splitX) - dw) / 2, (mailerH - dh) / 2, dw, dh);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = '#1a2830'; ctx.fillRect(splitX, 0, mailerW - splitX, mailerH);
  }

  // Fade edge
  var fd = ctx.createLinearGradient(splitX, 0, splitX + 60, 0);
  fd.addColorStop(0, 'rgba(13,27,34,1)'); fd.addColorStop(1, 'rgba(13,27,34,0)');
  ctx.fillStyle = fd; ctx.fillRect(splitX, 0, 60, mailerH);

  // ── Left panel content ────────────────────────────────────────────────
  var pad = Math.round(mailerW * 0.04);
  var cy = pad + 30;

  // Logo
  try {
    var lSrc = LOGO_WORDMARK_LIGHT || LOGO_CIRCLE_LIGHT;
    var lImg = await loadImageAsync(lSrc);
    var lH = Math.round(mailerH * 0.07), lW = lH * (lImg.width / lImg.height);
    ctx.drawImage(lImg, pad, cy - 10, lW, lH); cy += lH + 18;
  } catch(e) { cy += 40; }

  // Heading badge
  var badgeLabel = heading.replace('comm-','').replace(/-/g,' ').toUpperCase()
    .replace('EXCLUSIVE','EXCLUSIVELY OFFERED')
    .replace('INVESTMENT ALERT','INVESTMENT OPPORTUNITY');
  ctx.textAlign = 'left'; ctx.font = '700 ' + Math.round(mailerH * 0.052) + 'px "Montserrat",sans-serif';
  ctx.fillStyle = GOLD; ctx.fillText(badgeLabel, pad, cy); cy += Math.round(mailerH * 0.06);
  ctx.fillStyle = GOLD; ctx.fillRect(pad, cy - 10, splitX - pad * 2, 2); cy += 14;

  // Property name
  var nameText = f.propName || f.address || '';
  if (nameText) {
    ctx.font = 'italic ' + Math.round(mailerH * 0.068) + 'px "EB Garamond",Georgia,serif';
    ctx.fillStyle = CREAM;
    var nmW = splitX - pad * 2;
    var nmWords = nameText.split(' '), nmLine = '';
    nmWords.forEach(function(w) {
      var t = nmLine + (nmLine?' ':'')+w;
      if (ctx.measureText(t).width > nmW && nmLine) { ctx.fillText(nmLine,pad,cy); nmLine=w; cy+=Math.round(mailerH*0.075); }
      else nmLine = t;
    });
    ctx.fillText(nmLine, pad, cy); cy += Math.round(mailerH * 0.09);
  }

  // Price
  if (f.price) {
    ctx.font = '600 ' + Math.round(mailerH * 0.062) + 'px "Montserrat",sans-serif';
    ctx.fillStyle = GOLD; ctx.fillText(f.price, pad, cy); cy += Math.round(mailerH * 0.075);
  }

  // Address
  if (f.address) {
    ctx.font = '400 ' + Math.round(mailerH * 0.038) + 'px "Montserrat",sans-serif';
    ctx.fillStyle = BLUE;
    var addrS = f.address.length > 36 ? f.address.slice(0,36)+'…' : f.address;
    ctx.fillText(addrS, pad, cy); cy += Math.round(mailerH * 0.05);
  }

  // Metrics — compact 2-col
  if (metrics.length > 0) {
    cy += 10;
    ctx.strokeStyle='rgba(162,182,192,0.15)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad,cy-6); ctx.lineTo(splitX-pad,cy-6); ctx.stroke(); cy += 14;
    var mColW2 = (splitX - pad * 2 - 10) / 2;
    metrics.slice(0,4).forEach(function(m,mi) {
      var mx2 = pad + (mi%2)*(mColW2+10);
      var my2 = cy + Math.floor(mi/2) * Math.round(mailerH*0.1);
      ctx.font='700 '+Math.round(mailerH*0.048)+'px "Montserrat",sans-serif'; ctx.fillStyle=GOLD; ctx.textAlign='left';
      ctx.fillText(m.value.length>9?m.value.slice(0,9):m.value, mx2, my2+Math.round(mailerH*0.045));
      ctx.font='400 '+Math.round(mailerH*0.032)+'px "Montserrat",sans-serif'; ctx.fillStyle='rgba(162,182,192,0.7)';
      ctx.fillText(m.label.toUpperCase(), mx2, my2+Math.round(mailerH*0.075));
    });
    cy += Math.ceil(Math.min(metrics.length,4)/2)*Math.round(mailerH*0.1)+16;
  }

  // CTA — call to action
  var ctaY = mailerH - pad - 8;
  ctx.strokeStyle='rgba(162,182,192,0.12)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad,ctaY-50); ctx.lineTo(splitX-pad,ctaY-50); ctx.stroke();
  ctx.textAlign='left'; ctx.font='700 '+Math.round(mailerH*0.048)+'px "Montserrat",sans-serif';
  ctx.fillStyle=GOLD; ctx.fillText('Call Today', pad, ctaY-24);
  ctx.font='600 '+Math.round(mailerH*0.058)+'px "Montserrat",sans-serif'; ctx.fillStyle=CREAM;
  var agPhone = (smAgents.length>0&&smAgents[0].phone) ? smAgents[0].phone : '712-226-8000';
  ctx.fillText(agPhone, pad, ctaY+4);
  ctx.font='400 '+Math.round(mailerH*0.033)+'px "Montserrat",sans-serif'; ctx.fillStyle='rgba(162,182,192,0.55)';
  ctx.fillText('gatewayreadvisors.com', pad, ctaY+26);
}

function downloadMailer() {
  var fmt = smCurrentFormat();
  var dims = fmt === 'mailer-85x55' ? [2550, 1650] : [1800, 1200];
  var mc = document.createElement('canvas');
  var mctx = mc.getContext('2d');
  var heading = document.getElementById('sm-heading').value;
  var addr = (document.getElementById('sm-address')||{}).value || 'Property';
  drawMailerLayout(mc, mctx, dims[0], dims[1]).then(function() {
    var link = document.createElement('a');
    link.download = 'Gateway_Mailer_' + heading + '_' + addr.replace(/\s+/g,'_') + '.png';
    link.href = mc.toDataURL('image/png'); link.click();
    showGlobalStatus('✓ Print-ready mailer downloaded (' + dims[0] + '×' + dims[1] + 'px)');
  });
}

async function updateSocialPreview() {
  var canvas = document.getElementById('sm-canvas');
  var ctx = canvas.getContext('2d');
  var fmt = smCurrentFormat();
  var W, H;
  if (fmt === 'square')      { W = 1080; H = 1080; }
  else if (fmt === 'mailer-6x4')   { W = 900; H = 600; }   // preview size (half of 1800×1200)
  else if (fmt === 'mailer-85x55') { W = 850; H = 550; }   // preview size
  else                             { W = 1080; H = 1350; }
  canvas.width = W; canvas.height = H;
  canvas.style.maxWidth = (fmt.startsWith('mailer') ? '680px' : '540px');

  var heading = document.getElementById('sm-heading').value;

  // Mailer format — use mailer drawing function
  if (fmt === 'mailer-6x4')   { await drawMailerLayout(canvas, ctx, W, H); return; }
  if (fmt === 'mailer-85x55') { await drawMailerLayout(canvas, ctx, W, H); return; }

  // Premium commercial templates
  if (heading === 'comm-exclusive' || heading === 'comm-just-sold-premium') {
    await drawCommExclusive(canvas, ctx, heading); return;
  }
  if (heading === 'comm-investment-alert') { await drawCommInvestmentAlert(canvas, ctx); return; }

  // Residential templates
  if (heading === 'res-new-listing') { await drawResidentialNewListing(canvas, ctx); return; }
  if (heading === 'res-just-sold') { await drawResidentialJustSold(canvas, ctx); return; }
  if (heading === 'res-under-contract') { await drawResidentialUnderContract(canvas, ctx); return; }
  if (heading === 'res-open-house') { await drawResidentialOpenHouse(canvas, ctx); return; }
  if (heading === 'res-price-reduced') { await drawResidentialPriceReduced(canvas, ctx); return; }
  if (heading === 'res-coming-soon') { await drawResidentialComingSoon(canvas, ctx); return; }
  // Just Sold commercial template
  if (heading === 'Just Sold') { await drawJustSoldTemplate(canvas, ctx); return; }
  // Existing newer commercial templates
  if (['For Lease','Just Leased','Price Reduced','Investment Opportunity'].indexOf(heading) !== -1) {
    await drawCommercialTemplate(canvas, ctx, heading);
    return;
  }

  // --- Original commercial rendering below ---

  var pal = PALETTES[smPalette] || PALETTES.navy;

  // Background gradient
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bg1);
  grad.addColorStop(1, pal.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top subtle line
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, 0, W, 3);

  var y = 60;

  // Heading
  var heading = document.getElementById('sm-heading').value;
  ctx.font = 'bold 52px "EB Garamond", Georgia, serif';
  ctx.fillStyle = pal.text;
  ctx.fillText(heading, 60, y + 50);

  // Gateway wordmark (top right) — larger
  try {
    var logoSrc = pal.logoKey === 'dark' ? LOGO_WORDMARK_DARK : LOGO_WORDMARK_LIGHT;
    var logoImg = await loadImageAsync(logoSrc);
    var logoH = 48;
    var logoW = logoH * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, W - 60 - logoW, y + 12, logoW, logoH);
  } catch(e) {}

  y += 110;

  // Property name
  var address = document.getElementById('sm-address').value || 'Property Name';
  ctx.font = '600 32px "Montserrat", sans-serif';
  ctx.fillStyle = pal.accent;
  ctx.fillText(address, 60, y);

  y += 15;

  // Price
  var price = document.getElementById('sm-price').value;
  if (price) {
    ctx.font = '400 24px "Montserrat", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.fillText('Price: ' + price, 60, y + 30);
    y += 35;
  }

  // Accent line
  y += 15;
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(W - 60, y);
  ctx.stroke();

  y += 30;

  // Single HERO photo (full width)
  var heroW = W - 120;
  var heroH = heroW * 0.56;

  ctx.fillStyle = pal.photoBg;
  ctx.beginPath();
  roundRect(ctx, 60, y, heroW, heroH, 12);
  ctx.fill();

  if (smPhotos[0]) {
    try {
      var pImg = await loadImageAsync(smPhotos[0]);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, 60, y, heroW, heroH, 12);
      ctx.clip();
      var imgRatio = pImg.width / pImg.height;
      var slotRatio = heroW / heroH;
      var dw, dh, dx, dy;
      if (imgRatio > slotRatio) {
        dh = heroH;
        dw = dh * imgRatio;
        dx = 60 - (dw - heroW) / 2;
        dy = y;
      } else {
        dw = heroW;
        dh = dw / imgRatio;
        dx = 60;
        dy = y - (dh - heroH) / 2;
      }
      ctx.drawImage(pImg, dx, dy, dw, dh);
      ctx.restore();
    } catch(e) { ctx.restore(); }
  } else {
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.3;
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷', 60 + heroW/2, y + heroH/2 + 20);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // Location label on hero
  var label = document.getElementById('sm-photo1-label').value;
  if (label) {
    ctx.font = '600 16px "Montserrat", sans-serif';
    var labelW = ctx.measureText(label).width + 24;
    ctx.fillStyle = 'rgba(30,47,57,0.85)';
    ctx.beginPath();
    roundRect(ctx, 72, y + heroH - 48, labelW, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#E4E3D4';
    ctx.fillText(label, 84, y + heroH - 25);
  }

  y += heroH + 30;

  // Metrics bar — V4: 16+ toggleable metrics
  var SM_METRIC_DEFS = [
    { key: 'price-unit', label: 'Price/Unit' },
    { key: 'price-sf', label: 'Price/SF' },
    { key: 'units', label: 'Units' },
    { key: 'cap', label: 'Cap Rate' },
    { key: 'noi', label: 'NOI' },
    { key: 'year-built', label: 'Year Built' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'lot-size', label: 'Lot Size' },
    { key: 'bldg-sf', label: 'Building SF' },
    { key: 'zoning', label: 'Zoning' },
    { key: 'market-badge', label: 'Badge' },
    { key: 'dom', label: 'Days on Mkt' },
    { key: 'submarket', label: 'Market' },
    { key: 'prop-class', label: 'Class' },
    { key: 'financing', label: 'Financing' },
    { key: 'sf', label: 'SF / Acreage' }
  ];
  var metrics = [];
  SM_METRIC_DEFS.forEach(function(def) {
    var toggle = document.getElementById('sm-show-' + def.key);
    var input = document.getElementById('sm-' + def.key);
    if (toggle && toggle.checked && input && input.value) {
      metrics.push({ label: def.label, value: input.value });
    }
  });

  var isCondensed = document.getElementById('sm-condensed') && document.getElementById('sm-condensed').checked;
  if (metrics.length > 0) {
    var labelFont = isCondensed ? '500 11px "Montserrat", sans-serif' : '500 13px "Montserrat", sans-serif';
    var valueFont = isCondensed ? '700 16px "Montserrat", sans-serif' : '700 22px "Montserrat", sans-serif';
    var rowH = isCondensed ? 52 : 72;
    var maxPerRow = isCondensed ? 5 : 4;
    var rows = [];
    for (var ri = 0; ri < metrics.length; ri += maxPerRow) {
      rows.push(metrics.slice(ri, ri + maxPerRow));
    }
    rows.forEach(function(rowMetrics) {
      var metricBoxW = Math.min(isCondensed ? 120 : 140, (W - 120 - (rowMetrics.length - 1) * 16) / rowMetrics.length);
      var metricStartX = 60;
      ctx.fillStyle = 'rgba(30,47,57,0.6)';
      ctx.beginPath();
      roundRect(ctx, metricStartX - 10, y - 10, rowMetrics.length * (metricBoxW + 16) + 4, rowH, 10);
      ctx.fill();
      rowMetrics.forEach(function(m, mi) {
        var mx = metricStartX + mi * (metricBoxW + 16);
        ctx.font = labelFont;
        ctx.fillStyle = pal.label;
        ctx.fillText(m.label, mx + 8, y + (isCondensed ? 14 : 16));
        ctx.font = valueFont;
        ctx.fillStyle = pal.accent;
        ctx.fillText(m.value, mx + 8, y + (isCondensed ? 36 : 44));
      });
      y += rowH + 10;
    });
  }

  // Agent info section
  if (smAgents.length > 0 && smAgents[0].name) {
    y += 14;
    for (var ai = 0; ai < smAgents.length; ai++) {
      var ag = smAgents[ai];
      if (!ag.name) continue;
      var agX = 60 + ai * 420;
      if (agX + 380 > W) break; // Don't overflow

      // Agent headshot — 54px radius circle
      if (ag.photo) {
        try {
          var agImg = await loadImageAsync(ag.photo);
          ctx.save();
          ctx.beginPath();
          ctx.arc(agX + 54, y + 54, 54, 0, Math.PI * 2);
          ctx.clip();
          var _scOrig = Math.max(108 / agImg.width, 108 / agImg.height);
          ctx.drawImage(agImg, agX + 54 - agImg.width*_scOrig/2, y + 54 - agImg.height*_scOrig/2, agImg.width*_scOrig, agImg.height*_scOrig);
          ctx.restore();
          ctx.strokeStyle = '#C8A84B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(agX + 54, y + 54, 54, 0, Math.PI * 2);
          ctx.stroke();
        } catch(e) {}
      }

      var textX = ag.photo ? agX + 124 : agX;
      ctx.font = '700 28px "Montserrat", sans-serif';
      ctx.fillStyle = pal.text;
      ctx.fillText(ag.name, textX, y + 28);
      ctx.font = '400 20px "Montserrat", sans-serif';
      ctx.fillStyle = pal.accent;
      if (ag.title) ctx.fillText(ag.title, textX, y + 54);
      if (ag.phone) { ctx.font = '600 20px "Montserrat", sans-serif'; ctx.fillStyle = '#C8A84B'; ctx.fillText(ag.phone, textX, y + 78); }
      if (ag.email) {
        ctx.font = '400 18px "Montserrat", sans-serif';
        ctx.fillStyle = pal.accent;
        ctx.fillText(ag.email, textX, y + 100);
      }
      if (ag.license) {
        ctx.font = '400 16px "Montserrat", sans-serif';
        ctx.fillStyle = '#5a6a72';
        ctx.fillText(ag.license, textX, y + 120);
      }
    }
    y += 140;
  }

  // Broker of Record
  var brokerText = document.getElementById('sm-broker-record').value;
  if (brokerText) {
    ctx.font = '400 12px "Montserrat", sans-serif';
    ctx.fillStyle = '#5a6a72';
    ctx.textAlign = 'center';
    var lines = brokerText.split('\n');
    lines.forEach((line, li) => {
      ctx.fillText(line, W / 2, H - 40 + li * 18);
    });
    ctx.textAlign = 'left';
  }

  // Gateway circular logo — large, bottom right
  try {
    var circLogoSrc = LOGO_CIRCLE_LIGHT || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png'; // LOGO_CIRCLE_LIGHT = LOGO_ROUND_SUBMARK
    var circLogoImg = await loadImageAsync(circLogoSrc);
    var clSz = 130;
    ctx.drawImage(circLogoImg, W - 60 - clSz, H - clSz - 12, clSz, clSz);
  } catch(e) {}

  // Bottom accent line
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, H - 3, W, 3);
}

// Debounce wrapper — prevents redundant canvas redraws on every keystroke.
// Also resets the photo-filter cache at the start of each render cycle so
// smPhotoFilter() reads from DOM once per render, not once per canvas draw call.
(function() {
  var _raw = updateSocialPreview, _t = null;
  updateSocialPreview = function() {
    clearTimeout(_t);
    _t = setTimeout(function() {
      smInvalidateFilterCache(); // reset per-render filter cache
      _raw();
    }, 250);
  };
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadSocialGraphic() {
  var canvas = document.getElementById('sm-canvas');
  var link = document.createElement('a');
  var heading = document.getElementById('sm-heading').value.replace(/\s+/g, '_');
  var address = document.getElementById('sm-address').value.replace(/\s+/g, '_') || 'Property';
  link.download = 'Gateway_' + heading + '_' + address + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showGlobalStatus('✅ PNG downloaded!');
}

function downloadSocialSquare() {
  var srcCanvas = document.getElementById('sm-canvas');
  var sqCanvas = document.createElement('canvas');
  sqCanvas.width = 1080;
  sqCanvas.height = 1080;
  var sqCtx = sqCanvas.getContext('2d');
  // Draw center-cropped
  sqCtx.drawImage(srcCanvas, 0, 135, 1080, 1080, 0, 0, 1080, 1080);
  var link = document.createElement('a');
  var heading = document.getElementById('sm-heading').value.replace(/\s+/g, '_');
  link.download = 'Gateway_' + heading + '_Square.png';
  link.href = sqCanvas.toDataURL('image/png');
  link.click();
  showGlobalStatus('✅ Square PNG downloaded!');
}

// ===================================================================
// BUFFER API INTEGRATION
// Delegates to GatewayAPI (app/api.js) which handles proxy vs. direct.
// When proxyUrl is set in config.js, no token input is needed — the
// brokerage key lives in Vercel env vars and all agents share it.
// ===================================================================

function getBufferToken() {
  var inputEl = document.getElementById('buffer-token-input');
  var fromInput = inputEl ? inputEl.value.trim() : '';
  if (fromInput) return fromInput;
  if (window.CONFIG && window.CONFIG.bufferAccessToken &&
      window.CONFIG.bufferAccessToken !== 'YOUR_BUFFER_ACCESS_TOKEN_HERE') {
    return window.CONFIG.bufferAccessToken;
  }
  return localStorage.getItem('buffer_access_token') || '';
}

async function testBufferConnection() {
  var dot        = document.getElementById('buffer-dot');
  var statusText = document.getElementById('buffer-status-text');
  var connectBtn = document.getElementById('buffer-connect-btn');
  var refreshBtn = document.getElementById('buffer-refresh-btn');
  var tokenInput = document.getElementById('buffer-token-input');

  // If no proxy and no token, ask agent to paste one
  var usingProxy = !!(window.GatewayAPI && window.GatewayAPI.proxyUrl());
  if (!usingProxy && !getBufferToken()) {
    showGlobalStatus('⚠️ Paste your Buffer access token above and click Connect');
    return;
  }

  if (statusText) { statusText.textContent = 'Connecting...'; statusText.style.color = '#C8A84B'; }

  try {
    // Save locally typed token so GatewayAPI direct-mode can use it
    var typedToken = tokenInput ? tokenInput.value.trim() : '';
    if (typedToken) localStorage.setItem('buffer_access_token', typedToken);

    var result = await window.GatewayAPI.bufferProfiles();
    var profiles = result.profiles || [];

    if (tokenInput) tokenInput.style.display = 'none';
    if (dot) dot.className = 'buffer-dot on';
    var label = usingProxy ? 'Connected via Gateway Proxy' : ('Connected — ' + profiles.length + ' profile(s)');
    if (statusText) { statusText.textContent = label; statusText.style.color = '#27AE60'; }
    if (connectBtn) { connectBtn.textContent = '✓ Connected'; connectBtn.disabled = true; }
    if (refreshBtn) refreshBtn.style.display = 'inline-block';

    renderBufferProfiles(profiles);
    loadScheduledPosts();
  } catch(e) {
    if (dot) dot.className = 'buffer-dot off';
    var errMsg = '⚠️ Buffer: ' + (e.message || 'Could not connect');
    if (statusText) { statusText.textContent = errMsg; statusText.style.color = '#E74C3C'; }
    showBufferManualFallback();
  }
}

async function loadBufferProfiles() {
  try {
    var result = await window.GatewayAPI.bufferProfiles();
    renderBufferProfiles(result.profiles || []);
    loadScheduledPosts();
  } catch(e) {
    handleBufferError({message: e.message}, 'profiles');
  }
}

function renderBufferProfiles(profiles) {
  var wrap  = document.getElementById('buffer-profiles-wrap');
  var list  = document.getElementById('buffer-profiles-list');
  var smBtn = document.getElementById('sm-buffer-btn');
  if (!list) return;
  list.innerHTML = '';
  profiles.forEach(function(p) {
    var item = document.createElement('label');
    item.className = 'buffer-profile-item';
    var svcLabel = (p.service || '').charAt(0).toUpperCase() + (p.service || '').slice(1);
    item.innerHTML = '<input type="checkbox" name="buffer-profile" value="' + p.id + '" checked> ' +
      '<span style="font-weight:700">' + svcLabel + '</span> &mdash; ' + (p.handle || p.id);
    list.appendChild(item);
  });
  if (wrap) wrap.classList.add('show');
  if (smBtn) smBtn.style.display = 'inline-block';
  showGlobalStatus('✅ Loaded ' + profiles.length + ' Buffer profile(s)');
}

async function schedulePostToBuffer(sendNow) {
  if (!window.GatewayAPI || !window.GatewayAPI.bufferAvailable()) {
    showGlobalStatus('⚠️ Buffer not configured — set proxyUrl in config.js or paste your token and connect');
    return;
  }
  var caption = (document.getElementById('sm-caption') || {}).value || '';
  var heading = (document.getElementById('sm-heading') || {}).value || 'Property';
  if (!caption) caption = heading + ' — Listed by Gateway Real Estate Advisors | Sioux City, IA';

  var profileCheckboxes = document.querySelectorAll('input[name="buffer-profile"]:checked');
  if (!profileCheckboxes.length) { showGlobalStatus('⚠️ Select at least one Buffer profile'); return; }
  var profileIds = Array.from(profileCheckboxes).map(function(cb) { return cb.value; });

  var schedTime = sendNow ? null : (document.getElementById('buffer-schedule-time') || {}).value;
  var scheduledAt = (schedTime && !sendNow) ? new Date(schedTime).toISOString() : null;

  var schedBtn = document.getElementById('buffer-sched-btn');
  if (schedBtn) { schedBtn.disabled = true; schedBtn.textContent = sendNow ? 'Sending...' : 'Scheduling...'; }

  try {
    var result = await window.GatewayAPI.bufferPost(profileIds, caption, null, scheduledAt);
    var count = (result.results || []).length;
    if (count > 0) {
      addToScheduledPosts({
        id: Date.now(),
        caption: caption,
        profiles: profileIds.length,
        scheduledAt: sendNow ? 'Now' : (schedTime || 'Queued'),
        status: sendNow ? 'Sent' : 'Scheduled',
        ts: new Date().toLocaleString()
      });
      showGlobalStatus(sendNow ? '✅ Sent to ' + count + ' profile(s)!' : '✅ Scheduled on ' + count + ' profile(s)!');
    }
    if (result.errors && result.errors.length) {
      result.errors.forEach(function(e) { handleBufferError({message: e.error}, 'schedule'); });
    }
  } catch(e) {
    handleBufferError(e, 'schedule');
  } finally {
    if (schedBtn) { schedBtn.disabled = false; schedBtn.textContent = '📅 Schedule Post'; }
  }
}

function addToScheduledPosts(post) {
  var saved = JSON.parse(localStorage.getItem('gateway_scheduled_posts') || '[]');
  saved.unshift(post);
  if (saved.length > 50) saved = saved.slice(0, 50);
  localStorage.setItem('gateway_scheduled_posts', JSON.stringify(saved));
  var list = document.getElementById('scheduled-posts-list');
  var dashboard = document.getElementById('scheduled-posts-dashboard');
  if (!list) return;
  if (dashboard) dashboard.style.display = 'block';
  var card = document.createElement('div');
  card.className = 'buffer-post-card';
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<span class="buffer-post-status">' + post.status + '</span>' +
      '<span style="font-size:10px;color:#7a9aaa">' + post.ts + '</span>' +
    '</div>' +
    '<div style="font-size:12px;color:#C8D8E0;margin-bottom:4px">' + post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') + '</div>' +
    '<div style="font-size:10px;color:#7a9aaa">📅 ' + post.scheduledAt + ' &nbsp;|&nbsp; ' + post.profiles + ' profile(s)</div>';
  list.insertBefore(card, list.firstChild);
}

function loadScheduledPosts() {
  var saved = JSON.parse(localStorage.getItem('gateway_scheduled_posts') || '[]');
  if (!saved.length) return;
  var list = document.getElementById('scheduled-posts-list');
  var dashboard = document.getElementById('scheduled-posts-dashboard');
  if (!list) return;
  list.innerHTML = '';
  if (dashboard) dashboard.style.display = 'block';
  saved.forEach(function(post) {
    var card = document.createElement('div');
    card.className = 'buffer-post-card';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span class="buffer-post-status">' + post.status + '</span>' +
        '<span style="font-size:10px;color:#7a9aaa">' + post.ts + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#C8D8E0;margin-bottom:4px">' + post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : '') + '</div>' +
      '<div style="font-size:10px;color:#7a9aaa">📅 ' + post.scheduledAt + ' &nbsp;|&nbsp; ' + post.profiles + ' profile(s)</div>';
    list.appendChild(card);
  });
}

function handleBufferError(error, context) {
  var dot = document.getElementById('buffer-dot');
  var statusText = document.getElementById('buffer-status-text');
  var msg;
  if (error && (error.status === 401 || error.status === 1010)) msg = '⚠️ Buffer: Invalid API token — double-check your token';
  else if (error && error.status === 403) msg = '⚠️ Buffer: Access denied (403)';
  else if (error && error.status === 429) msg = '⚠️ Buffer: Rate limit hit — try again in a moment';
  else if (error && error.status === 404) msg = '⚠️ Buffer: Endpoint not found (404)';
  else if (error && error.message) msg = '⚠️ Buffer: ' + error.message;
  else if (context === 'schedule') msg = '⚠️ Buffer: Post failed to schedule';
  else msg = '⚠️ Buffer: Could not connect — check your token';
  if (dot) dot.className = 'buffer-dot off';
  if (statusText) { statusText.textContent = msg; statusText.style.color = '#E74C3C'; }
  showGlobalStatus(msg);
}

function showBufferManualFallback() {
  var caption = (document.getElementById('sm-caption') || {}).value || '';
  var heading = (document.getElementById('sm-heading') || {}).value || '';
  if (!caption) caption = (heading ? heading + ' — ' : '') + 'Listed by Gateway Real Estate Advisors | Sioux City, IA';
  var wrap = document.getElementById('buffer-profiles-wrap');
  if (!wrap) return;
  wrap.classList.add('show');
  wrap.innerHTML =
    '<div style="background:#1a1a0e;border:1px solid #C8A84B44;border-radius:8px;padding:12px 14px;margin-bottom:8px">' +
      '<div style="font-size:11px;color:#C8A84B;font-weight:700;letter-spacing:1px;margin-bottom:6px">MANUAL POSTING MODE</div>' +
      '<div style="font-size:11px;color:#7a9aaa;margin-bottom:8px">Buffer\'s API is blocked by your browser\'s security policy. Copy your post text and schedule it directly in Buffer.</div>' +
      '<textarea id="buffer-manual-caption" rows="4" style="width:100%;background:#0e1e28;border:1px solid #2a4050;border-radius:6px;color:#E4E3D4;font-size:12px;padding:8px;resize:vertical;box-sizing:border-box">' + caption.replace(/</g,'&lt;') + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
        '<button class="buffer-btn" onclick="(function(){var t=document.getElementById(\'buffer-manual-caption\');if(t){navigator.clipboard.writeText(t.value).then(function(){showGlobalStatus(\'✅ Caption copied!\')});}})()">📋 Copy Caption</button>' +
        '<button class="buffer-btn" onclick="window.open(\'https://publish.buffer.com\',\'_blank\')">Open Buffer →</button>' +
        '<button class="buffer-btn" onclick="var c=document.getElementById(\'sm-canvas\');if(c){var a=document.createElement(\'a\');a.download=\'post.png\';a.href=c.toDataURL(\'image/png\');a.click();}">⬇ Download Image</button>' +
      '</div>' +
    '</div>';
}
