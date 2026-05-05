(function() {

  /* ── STATE ─────────────────────────────────────────────────────── */
  var vidPhotos      = [];
  var vidAgentPhoto  = null; // { dataUrl, name }
  var vidMusicFile   = null; // { dataUrl, name, ext }
  var vidDragIdx     = null;
  var vidCurrentTpl  = 'listing';
  var vidCurrentFmt  = '16:9';
  var vidType        = 'residential';

  var VID_TEMPLATES = [
    { id:'listing',        name:'Listing Promo',  icon:'🏠', desc:'30–60s · all photos', formId:'vtf-listing'       },
    { id:'just-listed',    name:'Just Listed',    icon:'🔑', desc:'20–45s · all photos', formId:'vtf-just-listed'   },
    { id:'just-sold',      name:'Just Sold',      icon:'🏆', desc:'15–25s · all photos', formId:'vtf-just-sold'     },
    { id:'open-house',     name:'Open House',     icon:'📅', desc:'20–35s · all photos', formId:'vtf-open-house'    },
    { id:'price-improved', name:'Price Improved', icon:'📉', desc:'15–25s · all photos', formId:'vtf-price-reduced' }
  ];

  var FMT = {
    '16:9': { w:1920, h:1080 },
    '9:16': { w:1080, h:1920 },
    '1:1':  { w:1080, h:1080 }
  };

  /* ── NEW STATE ────────────────────────────────────────────────── */
  var vidCurrentAnim    = 'kenburns';
  var vidCurrentPlatform= 'landscape';
  var vidCurrentQuality = 'balanced';
  var vidCurrentFont    = 'bold';
  var PLATFORM_FMT = {
    'reels':     { aspect:'9:16',  w:1080, h:1920, fps:30, maxSec:60  },
    'feed':      { aspect:'1:1',   w:1080, h:1080, fps:30, maxSec:60  },
    'landscape': { aspect:'16:9',  w:1920, h:1080, fps:30, maxSec:90  },
    'shorts':    { aspect:'9:16',  w:1080, h:1920, fps:30, maxSec:60  },
    'story':     { aspect:'9:16',  w:1080, h:1920, fps:30, maxSec:15  }
  };

  /* ── ANIMATION SELECTION ─────────────────────────────────────── */
  window.vidSelectAnim = function(anim, el) {
    vidCurrentAnim = anim;
    document.querySelectorAll('.anim-card').forEach(function(c){ c.classList.remove('sel'); });
    el.classList.add('sel');
    var labels = { kenburns:'Ken Burns', parallax:'Parallax', slide:'Slide + Reveal',
                   fade:'Fade Dissolve', zoomout:'Zoom Out', split:'Split Screen', spinzoom:'Spin + Zoom' };
    var lbl = document.getElementById('anim-preview-label');
    if (lbl) lbl.textContent = labels[anim] || anim;
    vidPreviewAnim();
  };

  window.vidPreviewAnim = function() {
    var wrap = document.getElementById('anim-preview-wrap');
    var img  = document.getElementById('anim-preview-img');
    if (!wrap || !img) return;
    var photo = vidPhotos[0];
    if (!photo) { showGlobalStatus('Upload a photo first to preview animation'); return; }
    img.src = photo.dataUrl;
    var animClass = { kenburns:'anim-kenburns', parallax:'anim-parallax', slide:'anim-slide',
                      fade:'anim-fade', zoomout:'anim-zoomout', split:'anim-kenburns', spinzoom:'anim-spinzoom' }[vidCurrentAnim] || 'anim-kenburns';
    // Strip any inline style so the CSS class animation can take effect
    img.style.animation = 'none';
    wrap.className = 'anim-preview-wrap show';
    void img.offsetWidth; // force reflow — restarts animation
    img.style.animation = '';
    wrap.className = 'anim-preview-wrap show ' + animClass;
  };

  /* ── PLATFORM / QUALITY SELECTION ───────────────────────────── */
  window.vidSelectPlatform = function(plat, el) {
    vidCurrentPlatform = plat;
    document.querySelectorAll('.platform-card').forEach(function(c){ c.classList.remove('sel'); });
    el.classList.add('sel');
    var pf = PLATFORM_FMT[plat];
    if (pf) { vidCurrentFmt = pf.aspect; }
    vidRenderScenePreview();
  };

  window.vidSelectQuality = function(q, el) {
    vidCurrentQuality = q;
    document.querySelectorAll('.qual-btn').forEach(function(b){ b.classList.remove('sel'); });
    el.classList.add('sel');
  };

  /* ── TEXT OVERLAY TABS ───────────────────────────────────────── */
  window.vidOverlayTab = function(tab, btn) {
    document.querySelectorAll('.overlay-tab').forEach(function(b){ b.classList.remove('act'); });
    document.querySelectorAll('.overlay-panel').forEach(function(p){ p.classList.remove('show'); });
    btn.classList.add('act');
    var panel = document.getElementById('ovl-' + tab);
    if (panel) panel.classList.add('show');
  };

  window.vidToggleOverlay = function(btn) {
    btn.classList.toggle('on');
  };

  window.vidCTAPreset = function(sel) {
    var row = document.getElementById('ovl-cta-custom-row');
    if (row) row.style.display = sel.value === 'custom' ? '' : 'none';
  };

  window.vidSelectFont = function(font, el) {
    vidCurrentFont = font;
    document.querySelectorAll('.font-pick-btn').forEach(function(b){ b.classList.remove('sel'); });
    el.classList.add('sel');
  };

  /* ── TEMPLATE / FORMAT SELECTION ───────────────────────────────── */
  window.vidSelectTpl = function(id, btn) {
    vidCurrentTpl = id;
    document.querySelectorAll('.vid-tpl-card').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    VID_TEMPLATES.forEach(function(t){
      var el = document.getElementById(t.formId);
      if (el) el.style.display = (t.id === id) ? '' : 'none';
    });
    var tpl = VID_TEMPLATES.find(function(t){ return t.id === id; });
    if (tpl) {
      document.getElementById('vid-tpl-title').textContent    = tpl.name;
      document.getElementById('vid-tpl-subtitle').textContent = 'Branded ' + tpl.desc;
    }
    vidRenderScenePreview();
  };

  window.vidSelectFmt = function(fmt, btn) {
    vidCurrentFmt = fmt;
    document.querySelectorAll('.vid-fmt-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    vidRenderScenePreview();
  };

  window.vidSetType = function(type, btn) {
    vidType = type;
    document.querySelectorAll('.vid-type-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('vid-res-fields').style.display  = type==='residential' ? '' : 'none';
    document.getElementById('vid-mf-fields').style.display   = type==='multifamily' ? '' : 'none';
    document.getElementById('vid-comm-fields').style.display = type==='commercial'  ? '' : 'none';
    vidRenderScenePreview();
  };

  /* ── PHOTO UPLOAD (no limit) ────────────────────────────────────── */
  window.vidHandleFiles = function(files) {
    Array.from(files).forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(e){
        vidPhotos.push({ dataUrl: e.target.result, name: file.name });
        vidRenderThumbs();
        vidRenderScenePreview();
        var hint=document.getElementById("vid-scene-hint");
        var cnt=document.getElementById("vid-scene-count");
        if (hint) hint.style.display="none";
        if (cnt) cnt.textContent=vidPhotos.length+" photo"+(vidPhotos.length!==1?"s":"");
      };
      reader.readAsDataURL(file);
    });
  };

  function vidRenderThumbs() {
    var c = document.getElementById('vid-thumbs');
    if (!c) return;
    c.innerHTML = '';
    vidPhotos.forEach(function(p, i){
      var d = document.createElement('div');
      d.className = 'vid-thumb';
      d.draggable = true;
      d.dataset.idx = i;
      d.innerHTML = '<img src="'+p.dataUrl+'" alt="">'
        + '<span class="vid-scene-num">'+(i+1)+'</span>'
        + '<button class="thumb-remove" onclick="vidRemovePhoto('+i+')">✕</button>';
      d.addEventListener('dragstart', function(){ vidDragIdx=i; d.classList.add('dragging'); });
      d.addEventListener('dragend',   function(){ vidDragIdx=null; document.querySelectorAll('.vid-thumb').forEach(function(t){ t.classList.remove('dragging','drag-over'); }); });
      d.addEventListener('dragover',  function(e){ e.preventDefault(); d.classList.add('drag-over'); });
      d.addEventListener('dragleave', function(){ d.classList.remove('drag-over'); });
      d.addEventListener('drop',      function(e){
        e.preventDefault(); d.classList.remove('drag-over');
        if (vidDragIdx === null || vidDragIdx === i) return;
        var moved = vidPhotos.splice(vidDragIdx, 1)[0];
        vidPhotos.splice(i, 0, moved);
        vidRenderThumbs(); vidRenderScenePreview();
      });
      c.appendChild(d);
    });
    if (vidPhotos.length > 1) {
      var hint = document.createElement('p');
      hint.style.cssText = 'font-size:10px;color:var(--brand-gray);margin-top:4px;width:100%';
      hint.textContent = 'Drag to reorder · number = scene order';
      c.appendChild(hint);
    }
  }

  window.vidRemovePhoto = function(i){
    vidPhotos.splice(i, 1);
    vidRenderThumbs();
    vidRenderScenePreview();
  };

  (function(){
    var dz = document.getElementById('vid-drop-zone');
    if (!dz) return;
    dz.addEventListener('dragover',  function(e){ e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('drag-over'); });
    dz.addEventListener('drop',      function(e){ e.preventDefault(); dz.classList.remove('drag-over'); vidHandleFiles(e.dataTransfer.files); });
  })();

  /* ── AGENT PHOTO ───────────────────────────────────────────────── */
  window.vidHandleAgentPhoto = function(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      vidAgentPhoto = { dataUrl: e.target.result, name: file.name };
      document.getElementById('vid-agent-photo-img').src = e.target.result;
      document.getElementById('vid-agent-photo-wrap').style.display = '';
      document.getElementById('vid-agent-photo-clear').style.display = '';
      vidRenderScenePreview();
    };
    reader.readAsDataURL(file);
  };
  window.vidClearAgentPhoto = function() {
    vidAgentPhoto = null;
    document.getElementById('vid-agent-photo-wrap').style.display = 'none';
    document.getElementById('vid-agent-photo-clear').style.display = 'none';
    document.getElementById('vid-agent-photo-input').value = '';
    vidRenderScenePreview();
  };

  /* ── MUSIC FILE ────────────────────────────────────────────────── */
  window.vidHandleMusicFile = function(file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    var reader = new FileReader();
    reader.onload = function(e) {
      vidMusicFile = { dataUrl: e.target.result, name: file.name, ext: ext };
      var drop = document.getElementById('vid-audio-drop');
      var icon = document.getElementById('vid-audio-icon');
      var lbl  = document.getElementById('vid-audio-label');
      var vol  = document.getElementById('vid-vol-row');
      if (drop) drop.classList.add('has-file');
      if (icon) icon.textContent = '✅';
      if (lbl)  lbl.textContent  = file.name;
      if (vol)  vol.style.display = '';
    };
    reader.readAsDataURL(file);
  };
  window.vidClearMusic = function() {
    vidMusicFile = null;
    var drop = document.getElementById('vid-audio-drop');
    var icon = document.getElementById('vid-audio-icon');
    var lbl  = document.getElementById('vid-audio-label');
    var vol  = document.getElementById('vid-vol-row');
    var inp  = document.getElementById('vid-music-input');
    if (drop) drop.classList.remove('has-file');
    if (icon) icon.textContent = '🎵';
    if (lbl)  lbl.textContent  = 'Drop an MP3 / M4A here, or click to browse';
    if (vol)  vol.style.display = 'none';
    if (inp)  inp.value = '';
  };

  /* ── SCENE PREVIEW ──────────────────────────────────────────────── */
  function vidRenderScenePreview() {
    var c = document.getElementById('vid-scenes-preview');
    if (!c) return;
    var addr   = g('vid-address') || '—';
    var city   = g('vid-city');
    var full   = city ? addr+', '+city : addr;
    var agents = g('vid-agents') || 'Gateway Real Estate Advisors';
    var html   = '';

    if (vidCurrentTpl === 'listing') {
      var price = g('vid-price') || '—';
      html += pc('Scene 1 · Hero',  vidPhotos[0], full, price);
      for (var i=1; i<vidPhotos.length; i++)
        html += pc('Scene '+(i+1)+' · Room', vidPhotos[i], gFeat(i-1)||'Room', null);
      html += pc('Stats Card',  null, 'Beds · Baths · Sq Ft', null, '#0D1117');
      html += pc('Agent Close', null, agents, 'Schedule a Showing',  '#0D1117');

    } else if (vidCurrentTpl === 'just-listed') {
      var price = g('vjl-price') || g('vid-price') || '—';
      html += pc('Title Card', null, 'JUST LISTED', full, '#0D1117');
      for (var i=0; i<vidPhotos.length; i++)
        html += pc('Scene '+(i+2)+' · '+(i===0?'Hero':'Room'), vidPhotos[i], i===0?price:gFeat(i-1)||null, null);
      html += pc('Stats Card',  null, 'Beds · Baths · Sq Ft', null, '#0D1117');
      html += pc('Agent Close', null, agents, 'Schedule a Showing',  '#0D1117');

    } else if (vidCurrentTpl === 'just-sold') {
      var sold = g('vjs-sold') || '—';
      var dom  = g('vjs-dom');
      html += pc('JUST SOLD Card', null, 'JUST SOLD', full, '#0D1117');
      for (var i=0; i<Math.min(vidPhotos.length,3); i++)
        html += pc('Scene '+(i+2)+' · Exterior', vidPhotos[i], null, null);
      html += pc('Sold Stats', null, sold, dom ? dom+' days on market' : null, '#0D1117');
      html += pc('Seller Close', null, 'Thinking of Selling?', agents, '#0D1117');

    } else if (vidCurrentTpl === 'open-house') {
      var date  = g('voh-date')  || '—';
      var start = g('voh-start') || '—';
      var end   = g('voh-end');
      html += pc('Date Card', null, 'OPEN HOUSE', date, '#0D1117');
      for (var i=0; i<vidPhotos.length; i++)
        html += pc('Scene '+(i+2)+' · '+(i===0?'Exterior':'Interior'), vidPhotos[i], null, null);
      html += pc('Reminder Close', null, full, start+(end?' – '+end:''), '#0D1117');

    } else if (vidCurrentTpl === 'price-improved') {
      var oldP = g('vpr-old') || '—';
      var newP = g('vpr-new') || '—';
      html += pc('Announcement', null, 'PRICE IMPROVED', oldP+' → '+newP, '#0D1117');
      for (var i=0; i<vidPhotos.length; i++)
        html += pc('Scene '+(i+2)+' · '+(i===0?'Hero':'Room'), vidPhotos[i], null, null);
      html += pc('Agent Close', null, agents, newP, '#0D1117');
    }

    c.innerHTML = html || '<p style="font-size:11px;color:var(--brand-gray);padding:12px">Upload photos to see scene preview</p>';
  }

  function pc(label, photo, l1, l2, bg) {
    var s = bg ? 'background:'+bg+';' : 'background:#1a2a35;';
    var img = photo ? '<img src="'+photo.dataUrl+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.65">' : '';
    var t1  = l1 ? '<div style="font-size:9px;font-weight:700;color:#F5F5F3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l1)+'</div>' : '';
    var t2  = l2 ? '<div style="font-size:8px;color:rgba(245,245,243,0.5);margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l2)+'</div>' : '';
    return '<div class="vid-scene-card">'
      + '<div class="vid-scene-label">'+esc(label)+'</div>'
      + '<div class="vid-scene-preview" style="position:relative;overflow:hidden;'+s+'">'
      + img
      + '<div style="position:absolute;bottom:8px;left:8px;right:8px">'+t1+t2+'</div>'
      + '</div></div>';
  }

  function gFeat(i) {
    var ids=['vid-feat1','vid-feat2','vid-feat3','vid-feat4'];
    var v = i<ids.length ? g(ids[i]) : '';
    return v ? v.split(/[—–]/)[0].trim() : '';
  }

  /* ── HELPERS ───────────────────────────────────────────────────── */
  function g(id)  { var el=document.getElementById(id); return el ? el.value.trim() : ''; }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  window.vidUpdatePreview = vidRenderScenePreview;

  function vidGetStats() {
    if (vidType==='residential') return [
      {val:g('vid-beds')||'—',lbl:'Bedrooms'},{val:g('vid-baths')||'—',lbl:'Bathrooms'},{val:g('vid-sqft')||'—',lbl:'Sq Footage'}];
    if (vidType==='multifamily') return [
      {val:g('vid-units'),lbl:'Units'},{val:g('vid-cap'),lbl:'Cap Rate'},{val:g('vid-noi'),lbl:'NOI'},
      {val:g('vid-occ'),lbl:'Occupancy'},{val:g('vid-ppu'),lbl:'Price/Unit'},{val:g('vid-mf-sqft'),lbl:'Sq Footage'}
    ].filter(function(s){return s.val;});
    return [
      {val:g('vid-bldg-sf')||'—',lbl:'Building SF'},{val:g('vid-comm-cap')||'—',lbl:'Cap Rate'},{val:g('vid-lease-rate')||'—',lbl:'Lease Rate'},
      {val:g('vid-zoning'),lbl:'Zoning'},{val:g('vid-prop-type'),lbl:'Property Type'}
    ].filter(function(s){return s.val;});
  }

  function vidMakeLogos() {
    var lBadge = LOGO_ROUND_SUBMARK || 'https://res.cloudinary.com/dnmrgpubz/image/upload/v1748440952/GWlogo_circle_o4vvuv.png';
    return { logoH:lBadge, logoS:lBadge };
  }

  /* ── COMPOSITION BUILDERS ──────────────────────────────────────── */

  // Common head wrapper
  function mkH(id, dur, w, h, css) {
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
      +'<meta name="viewport" content="width='+w+', height='+h+'">\n'
      +'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">\n'
      +'<script src="./node_modules/gsap/dist/gsap.min.js"><\/script>\n'
      +'<style>\n* { margin:0; padding:0; box-sizing:border-box; }\n'
      +'html,body { width:'+w+'px; height:'+h+'px; overflow:hidden; background:#0D1117; font-family:\'Inter\',\'Helvetica Neue\',sans-serif; color:#fff; }\n'
      +'#root { position:relative; width:'+w+'px; height:'+h+'px; overflow:hidden; }\n'
      +'.scene { position:absolute; inset:0; opacity:0; }\n'
      +'.pw { position:absolute; inset:0; overflow:hidden; }\n'
      +'.pb { position:absolute; inset:-2px; width:calc(100% + 4px); height:calc(100% + 4px); object-fit:cover; transform-origin:center center; }\n'
      +'.pg { position:absolute; inset:0; background:linear-gradient(to bottom,rgba(13,17,23,0) 25%,rgba(13,17,23,0.6) 65%,rgba(13,17,23,0.96) 100%); }\n'
      +'#ov { position:absolute; inset:0; background:#0D1117; opacity:1; z-index:999; pointer-events:none; }\n'
      +css+'\n<\/style>\n</head>\n<body>\n'
      +'<div id="root" data-composition-id="'+id+'" data-start="0" data-duration="'+dur+'" data-width="'+w+'" data-height="'+h+'">\n';
  }
  function mkF(id, tlCode) {
    return '<div id="ov"></div>\n</div>\n<script>\n'
      +'window.__timelines=window.__timelines||{};\nvar tl=gsap.timeline({paused:true});\n'
      +tlCode+'\nwindow.__timelines["'+id+'"]=tl;\n<\/script>\n</body>\n</html>';
  }

  // Ken Burns tween string
  function kb(i, t, dur, dir) {
    var from,to,d=dir%4;
    if(d===0){ from='{scale:1.14}'; to='{scale:1.04,duration:'+dur+',ease:"none"}'; }
    else if(d===1){ from='{scale:1.1,x:"2.5%"}'; to='{scale:1.1,x:"-2.5%",duration:'+dur+',ease:"none"}'; }
    else if(d===2){ from='{scale:1.04}'; to='{scale:1.14,duration:'+dur+',ease:"none"}'; }
    else { from='{scale:1.1,y:"2.5%"}'; to='{scale:1.1,y:"-2.5%",duration:'+dur+',ease:"none"}'; }
    return '\n  .fromTo("#pb'+i+'",'+from+','+to+','+t.toFixed(2)+')';
  }
  function xfd(t) { return '\n  .to("#ov",{opacity:1,duration:0.35},'+t.toFixed(2)+')'; }
  function xfi(t) { return '\n  .to("#ov",{opacity:0,duration:0.35},'+t.toFixed(2)+')'; }

  // Stats card HTML
  function statsScene(stats) {
    return '<div class="scene sc-stats" id="sc-stats"><div class="si">'
      +stats.slice(0,3).map(function(s,i){
        return (i>0?'<div class="sd"></div>':'')
          +'<div class="sb"><div class="sv" id="sv'+i+'">'+esc(s.val)+'</div>'
          +'<div class="sl2" id="sl'+i+'">'+esc(s.lbl)+'</div></div>';
      }).join('')+'</div></div>\n';
  }
  // Stats timeline commands
  function statsTL(t, stats, statsD) {
    var s='';
    s+='\n  .set("#sc-stats",{opacity:1},'+t.toFixed(2)+')';
    s+=xfi(t);
    stats.slice(0,3).forEach(function(_,i){
      s+='\n  .to("#sv'+i+'",{opacity:1,y:0,duration:0.8,ease:"power3.out"},'+(t+0.3+i*0.18).toFixed(2)+')';
      s+='\n  .to("#sl'+i+'",{opacity:1,duration:0.5},'+(t+0.7+i*0.18).toFixed(2)+')';
    });
    s+=xfd(t+statsD-0.35);
    s+='\n  .set("#sc-stats",{opacity:0},'+(t+statsD).toFixed(2)+')';
    return s;
  }
  // Agent close HTML
  function agentScene(logoS, agents, agentPhoto) {
    return '<div class="scene sc-agent" id="sc-agent">'
      +(agentPhoto ? '<img class="ap" id="ap" src="'+agentPhoto+'" alt="Agent">' : '')
      +'<img class="alog" id="alog" src="'+logoS+'" alt="Gateway">'
      +'<div class="acta" id="acta">Schedule a Showing</div>'
      +'<div class="aname" id="aname">'+esc(agents)+'</div>'
      +'<div class="abrok" id="abrok">Gateway Real Estate Advisors</div>'
      +'<div class="atag" id="atag">Opening Doors to Your Future</div>'
      +'</div>\n';
  }
  // Agent timeline commands
  function agentTL(t, hasPhoto) {
    var off = hasPhoto ? 0.8 : 0;
    return '\n  .set("#sc-agent",{opacity:1},'+t.toFixed(2)+')'
      +xfi(t)
      +(hasPhoto ? '\n  .to("#ap",{opacity:1,duration:0.8},'+(t+0.4).toFixed(2)+')' : '')
      +'\n  .to("#alog",{opacity:1,duration:0.9},'+(t+0.5+off).toFixed(2)+')'
      +'\n  .to("#acta",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+1.3+off).toFixed(2)+')'
      +'\n  .to("#aname",{opacity:1,duration:0.7},'+(t+2.2+off).toFixed(2)+')'
      +'\n  .to("#abrok",{opacity:1,duration:0.6},'+(t+2.8+off).toFixed(2)+')'
      +'\n  .to("#atag",{opacity:1,duration:0.5},'+(t+3.3+off).toFixed(2)+');';
  }

  // Shared CSS for stats + agent scenes
  function sharedCss(W,H,isV,isS) {
    var spH=isV?'60px':isS?'60px':'80px';
    var stV=isV?'94px':isS?'84px':'116px';
    var ctaS=isV?'55px':isS?'50px':'74px';
    var logW=isV?'170px':isS?'190px':'210px';
    var namS=isV?'38px':'48px';
    var apW=isV?'150px':isS?'170px':'190px';
    var apH=isV?'190px':isS?'215px':'240px';
    return '.sc-stats{background:#0D1117;display:flex;align-items:center;justify-content:center}\n'
      +'.si{display:flex;align-items:center}\n'
      +'.sb{text-align:center;padding:0 '+spH+'}\n'
      +'.sd{width:1px;height:'+(isV?'80px':'60px')+';background:rgba(255,255,255,0.12)}\n'
      +'.sv{font-size:'+stV+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.sl2{font-size:17px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.45);margin-top:12px;opacity:0}\n'
      +'.sc-agent{background:#0D1117;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px}\n'
      +'.alog{width:'+logW+';height:'+logW+';opacity:0;margin-bottom:24px;object-fit:contain}\n'
      +'.acta{font-size:'+ctaS+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.aname{font-size:'+namS+';font-weight:300;color:#F5F5F3;margin-top:28px;opacity:0}\n'
      +'.abrok{font-size:15px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.45);margin-top:10px;opacity:0}\n'
      +'.atag{font-size:13px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(245,245,243,0.25);margin-top:14px;opacity:0}\n'
      +'.ap{width:'+apW+';height:'+apH+';border-radius:10px;object-fit:cover;border:3px solid rgba(245,245,243,0.25);opacity:0;margin-bottom:28px}\n';
  }

  /* ── LISTING PROMO ─────────────────────────────────────────────── */
  function buildListing(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='listing-'+data.slug;
    var feats=[data.feat1,data.feat2,data.feat3,data.feat4].filter(Boolean);
    var heroD=5.0,roomD=3.8,statsD=3.2,agentD=4.5;
    var totalD=+(heroD+(photos.length-1)*roomD+statsD+agentD).toFixed(1);
    var addrSz=isV?'66px':isS?'62px':'90px';
    var pricSz=isV?'45px':isS?'40px':'60px';
    var callSz=isV?'34px':isS?'30px':'44px';
    var side=isV?'60px':isS?'50px':'90px';
    var aBott=isV?'300px':isS?'220px':'190px';
    var pBott=isV?'215px':isS?'150px':'112px';
    var cBott=isV?'235px':isS?'150px':'145px';
    var css='.addr{position:absolute;bottom:'+aBott+';left:'+side+';right:'+side+';font-size:'+addrSz+';font-weight:300;color:#F5F5F3;letter-spacing:-0.5px;opacity:0;transform:translateY(18px)}\n'
      +'.eyeb{position:absolute;bottom:calc('+aBott+' + '+addrSz+' + 20px);left:'+side+';font-size:13px;font-weight:500;letter-spacing:5px;text-transform:uppercase;color:rgba(245,245,243,0.5);opacity:0}\n'
      +'.pric{position:absolute;bottom:'+pBott+';left:'+side+';font-size:'+pricSz+';font-weight:200;color:#F5F5F3;opacity:0}\n'
      +'.call{position:absolute;bottom:'+cBott+';left:'+side+';right:'+side+';font-size:'+callSz+';font-weight:300;color:#F5F5F3;letter-spacing:0.3px;opacity:0;transform:translateY(10px)}\n'
      +sharedCss(W,H,isV,isS);
    var scenesH='';
    photos.forEach(function(p,i){
      var f=feats[i-1]||''; var fs=f?f.split(/[—–]/)[0].trim():'';
      scenesH+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +(i===0?'<div class="eyeb" id="eyeb0">Gateway Real Estate Advisors</div>'
            +'<div class="addr" id="addr0">'+esc(data.addr)+'</div>'
            +'<div class="pric" id="pric0">'+esc(data.price)+'</div>':'')
        +(i>0&&fs?'<div class="call" id="cal'+i+'">'+esc(fs)+'</div>':'')
        +'</div>\n';
    });
    var tl='tl',t=0;
    photos.forEach(function(p,i){
      var dur=i===0?heroD:roomD;
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')';
      tl+=xfi(t); tl+=kb(i,t,dur,i);
      if(i===0){
        tl+='\n  .to("#eyeb0",{opacity:1,duration:0.7},'+(t+0.8).toFixed(2)+')';
        tl+='\n  .to("#addr0",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+1.2).toFixed(2)+')';
        tl+='\n  .to("#pric0",{opacity:1,duration:0.8},'+(t+2.2).toFixed(2)+')';
      } else if(feats[i-1]) {
        tl+='\n  .to("#cal'+i+'",{opacity:1,y:0,duration:0.7,ease:"power2.out"},'+(t+1.0).toFixed(2)+')';
      }
      tl+=xfd(t+dur-0.35);
      tl+='\n  .set("#sc'+i+'",{opacity:0},'+(t+dur).toFixed(2)+')';
      t+=dur;
    });
    tl+=statsTL(t,data.stats,statsD); t+=statsD;
    tl+=agentTL(t, !!data.agentPhoto);
    return mkH(compId,totalD,W,H,css)+scenesH+statsScene(data.stats)+agentScene(logos.logoS,data.agents,data.agentPhoto)+mkF(compId,tl);
  }

  /* ── JUST LISTED ───────────────────────────────────────────────── */
  function buildJustListed(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='jl-'+data.slug;
    var jlStats=[{val:data.jlBeds,lbl:'Bedrooms'},{val:data.jlBaths,lbl:'Bathrooms'},{val:data.jlSqft,lbl:'Sq Footage'}].filter(function(s){return s.val;});
    if(!jlStats.length) jlStats=data.stats.slice(0,3);
    var titleD=3.5,heroD=4.5,roomD=3.5,statsD=3.0,agentD=4.0;
    var totalD=+(titleD+heroD+(photos.length-1)*roomD+statsD+agentD).toFixed(1);
    var headSz=isV?'116px':isS?'102px':'162px';
    var side=isV?'60px':isS?'50px':'100px';
    var pricSz=isV?'52px':isS?'44px':'68px';
    var statLn=[data.jlBeds&&data.jlBeds+' Beds',data.jlBaths&&data.jlBaths+' Baths',data.jlSqft&&data.jlSqft].filter(Boolean).join('  ·  ');
    var css='.jcard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;background:#0D1117}\n'
      +'.jt-h{font-size:'+headSz+';font-weight:700;color:#F5F5F3;letter-spacing:4px;text-transform:uppercase;opacity:0;transform:translateY(28px)}\n'
      +'.jt-bar{width:60px;height:2px;background:rgba(245,245,243,0.3);margin:28px auto;opacity:0}\n'
      +'.jt-a{font-size:'+(isV?'34px':'42px')+';font-weight:300;color:rgba(245,245,243,0.6);opacity:0;transform:translateY(14px)}\n'
      +'.hpric{position:absolute;bottom:'+(isV?'235px':isS?'162px':'132px')+';left:'+side+';font-size:'+pricSz+';font-weight:200;color:#F5F5F3;opacity:0}\n'
      +'.hstat{position:absolute;bottom:'+(isV?'178px':isS?'110px':'82px')+';left:'+side+';font-size:'+(isV?'24px':'29px')+';font-weight:300;color:rgba(245,245,243,0.6);opacity:0}\n'
      +sharedCss(W,H,isV,isS);
    var html='<div class="scene" id="sc-t"><div class="jcard">'
      +'<div class="jt-h" id="jt-h">Just Listed</div>'
      +'<div class="jt-bar" id="jt-bar"></div>'
      +'<div class="jt-a" id="jt-a">'+esc(data.addr)+'</div>'
      +'</div></div>\n';
    photos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +(i===0?'<div class="hpric" id="hpric">'+esc(data.jlPrice||data.price)+'</div>'
            +(statLn?'<div class="hstat" id="hstat">'+esc(statLn)+'</div>':''):'')
        +'</div>\n';
    });
    html+=statsScene(jlStats)+agentScene(logos.logoS,data.agents,data.agentPhoto);
    var tl='tl',t=0;
    tl+='\n  .set("#sc-t",{opacity:1},0)'+xfi(0)
      +'\n  .to("#jt-h",{opacity:1,y:0,duration:1.1,ease:"power3.out"},0.4)'
      +'\n  .to("#jt-bar",{opacity:1,duration:0.5},1.2)'
      +'\n  .to("#jt-a",{opacity:1,y:0,duration:0.9,ease:"power2.out"},1.7)'
      +xfd(titleD-0.35)+'\n  .set("#sc-t",{opacity:0},'+titleD.toFixed(2)+')';
    t=titleD;
    photos.forEach(function(p,i){
      var dur=i===0?heroD:roomD;
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,dur,i+2);
      if(i===0){
        tl+='\n  .to("#hpric",{opacity:1,duration:0.9},'+(t+1.0).toFixed(2)+')';
        if(statLn) tl+='\n  .to("#hstat",{opacity:1,duration:0.7},'+(t+1.8).toFixed(2)+')';
      }
      tl+=xfd(t+dur-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+dur).toFixed(2)+')';
      t+=dur;
    });
    tl+=statsTL(t,jlStats,statsD); t+=statsD;
    tl+=agentTL(t, !!data.agentPhoto);
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── JUST SOLD ─────────────────────────────────────────────────── */
  function buildJustSold(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='js-'+data.slug;
    var soldD=3.5,photoD=3.8,statsD=3.0,closeD=4.0;
    var usePhotos=photos.slice(0,Math.max(photos.length,1));
    var totalD=+(soldD+usePhotos.length*photoD+statsD+closeD).toFixed(1);
    var stampSz=isV?'140px':isS?'128px':'186px';
    var side=isV?'60px':isS?'50px':'90px';
    var soldSz=isV?'66px':isS?'56px':'94px';
    var css='.scard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117}\n'
      +'.stamp{font-size:'+stampSz+';font-weight:800;color:#F5F5F3;letter-spacing:8px;text-transform:uppercase;opacity:0;transform:scale(0.85)}\n'
      +'.sbar{width:80px;height:2px;background:rgba(245,245,243,0.3);margin:28px auto;opacity:0}\n'
      +'.saddr{font-size:'+(isV?'34px':'42px')+';font-weight:300;color:rgba(245,245,243,0.65);opacity:0;transform:translateY(14px)}\n'
      +'.sold-ov{position:absolute;bottom:'+(isV?'255px':isS?'182px':'162px')+';left:'+side+';right:'+side+';text-align:center}\n'
      +'.sold-p{font-size:'+soldSz+';font-weight:200;color:#F5F5F3;opacity:0}\n'
      +'.sold-dom{font-size:'+(isV?'24px':'29px')+';font-weight:300;color:rgba(245,245,243,0.55);margin-top:10px;opacity:0}\n'
      +'.sc-close{background:#0D1117;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px}\n'
      +'.cl-q{font-size:'+(isV?'52px':isS?'48px':'72px')+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.cl-sub{font-size:'+(isV?'24px':'29px')+';font-weight:300;color:rgba(245,245,243,0.55);margin-top:20px;opacity:0}\n'
      +'.cl-name{font-size:'+(isV?'34px':'42px')+';font-weight:300;color:#F5F5F3;margin-top:32px;opacity:0}\n'
      +'.cl-brok{font-size:15px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.45);margin-top:10px;opacity:0}\n'
      +sharedCss(W,H,isV,isS);
    var html='<div class="scene" id="sc-sold"><div class="scard">'
      +'<div class="stamp" id="st-stamp">Sold</div>'
      +'<div class="sbar" id="st-bar"></div>'
      +'<div class="saddr" id="st-addr">'+esc(data.addr)+'</div>'
      +'</div></div>\n';
    usePhotos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +(i===0?'<div class="sold-ov">'
            +'<div class="sold-p" id="sold-p">'+esc(data.jsSold)+'</div>'
            +(data.jsDom?'<div class="sold-dom" id="sold-dom">'+esc(data.jsDom)+' days on market</div>':'')
            +'</div>':'')
        +'</div>\n';
    });
    var soldStats=[
      {val:data.jsSold||'—',lbl:'Sold Price'},
      {val:data.jsList||'—',lbl:'List Price'},
      {val:data.jsDom||'—',lbl:'Days on Market'}
    ];
    html+='<div class="scene sc-stats" id="sc-stats"><div class="si">'
      +soldStats.map(function(s,i){
        return (i>0?'<div class="sd"></div>':'')
          +'<div class="sb"><div class="sv" id="sv'+i+'">'+esc(s.val)+'</div>'
          +'<div class="sl2" id="sl'+i+'">'+esc(s.lbl)+'</div></div>';
      }).join('')+'</div></div>\n';
    html+='<div class="scene sc-close" id="sc-close">'
      +(data.agentPhoto ? '<img class="ap" id="ap" src="'+data.agentPhoto+'" alt="Agent">' : '')
      +'<div class="cl-q" id="cl-q">Thinking of Selling?</div>'
      +'<div class="cl-sub" id="cl-sub">Gateway Real Estate Advisors gets results.</div>'
      +'<div class="cl-name" id="cl-name">'+esc(data.agents)+'</div>'
      +'<div class="cl-brok" id="cl-brok">Gateway Real Estate Advisors</div>'
      +'</div>\n';
    var tl='tl',t=0;
    tl+='\n  .set("#sc-sold",{opacity:1},0)'+xfi(0)
      +'\n  .to("#st-stamp",{opacity:1,scale:1,duration:1.0,ease:"back.out(1.5)"},0.4)'
      +'\n  .to("#st-bar",{opacity:1,duration:0.5},1.2)'
      +'\n  .to("#st-addr",{opacity:1,y:0,duration:0.9,ease:"power2.out"},1.7)'
      +xfd(soldD-0.35)+'\n  .set("#sc-sold",{opacity:0},'+soldD.toFixed(2)+')';
    t=soldD;
    usePhotos.forEach(function(p,i){
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,photoD,i+1);
      if(i===0){
        tl+='\n  .to("#sold-p",{opacity:1,duration:0.9},'+(t+1.0).toFixed(2)+')';
        if(data.jsDom) tl+='\n  .to("#sold-dom",{opacity:1,duration:0.7},'+(t+1.8).toFixed(2)+')';
      }
      tl+=xfd(t+photoD-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+photoD).toFixed(2)+')';
      t+=photoD;
    });
    tl+=statsTL(t,soldStats,statsD); t+=statsD;
    var jsOff=data.agentPhoto?0.7:0;
    tl+='\n  .set("#sc-close",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +(data.agentPhoto?'\n  .to("#ap",{opacity:1,duration:0.8},'+(t+0.3).toFixed(2)+')':'')
      +'\n  .to("#cl-q",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.5+jsOff).toFixed(2)+')'
      +'\n  .to("#cl-sub",{opacity:1,duration:0.7},'+(t+1.5+jsOff).toFixed(2)+')'
      +'\n  .to("#cl-name",{opacity:1,duration:0.6},'+(t+2.2+jsOff).toFixed(2)+')'
      +'\n  .to("#cl-brok",{opacity:1,duration:0.5},'+(t+2.8+jsOff).toFixed(2)+');';
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── OPEN HOUSE ────────────────────────────────────────────────── */
  function buildOpenHouse(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='oh-'+data.slug;
    var dateD=4.0,photoD=3.5,closeD=4.0;
    var totalD=+(dateD+photos.length*photoD+closeD).toFixed(1);
    var headSz=isV?'102px':isS?'94px':'140px';
    var dateSz=isV?'66px':isS?'56px':'84px';
    var timeSz=isV?'42px':isS?'36px':'54px';
    var side=isV?'60px':isS?'50px':'100px';
    var css='.ohcard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.oh-eye{font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(245,245,243,0.4);opacity:0}\n'
      +'.oh-head{font-size:'+headSz+';font-weight:700;color:#F5F5F3;letter-spacing:4px;text-transform:uppercase;margin-top:20px;opacity:0;transform:translateY(22px)}\n'
      +'.oh-bar{width:60px;height:2px;background:rgba(245,245,243,0.25);margin:28px auto;opacity:0}\n'
      +'.oh-date{font-size:'+dateSz+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(14px)}\n'
      +'.oh-time{font-size:'+timeSz+';font-weight:300;color:rgba(245,245,243,0.6);margin-top:16px;opacity:0}\n'
      +'.close-sc{background:#0D1117;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 '+side+'}\n'
      +'.cl-addr{font-size:'+(isV?'48px':isS?'42px':'62px')+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.cl-when{font-size:'+(isV?'34px':isS?'28px':'42px')+';font-weight:300;color:rgba(245,245,243,0.55);margin-top:16px;opacity:0}\n'
      +'.cl-name{font-size:'+(isV?'28px':'36px')+';font-weight:300;color:#F5F5F3;margin-top:36px;opacity:0}\n'
      +'.cl-brok{font-size:15px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.4);margin-top:10px;opacity:0}\n'
      +sharedCss(W,H,isV,isS);
    var timeStr=data.ohStart+(data.ohEnd?' – '+data.ohEnd:'');
    var html='<div class="scene" id="sc-date"><div class="ohcard">'
      +'<div class="oh-eye" id="oh-eye">You\'re Invited</div>'
      +'<div class="oh-head" id="oh-head">Open House</div>'
      +'<div class="oh-bar" id="oh-bar"></div>'
      +'<div class="oh-date" id="oh-date">'+esc(data.ohDate)+'</div>'
      +'<div class="oh-time" id="oh-time">'+esc(timeStr)+'</div>'
      +'</div></div>\n';
    photos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +'</div>\n';
    });
    html+='<div class="scene close-sc" id="sc-close">'
      +(data.agentPhoto ? '<img class="ap" id="ap" src="'+data.agentPhoto+'" alt="Agent">' : '')
      +'<div class="cl-addr" id="cl-addr">'+esc(data.addr)+'</div>'
      +'<div class="cl-when" id="cl-when">'+esc(data.ohDate+' · '+timeStr)+'</div>'
      +'<div class="cl-name" id="cl-name">'+esc(data.agents)+'</div>'
      +'<div class="cl-brok" id="cl-brok">Gateway Real Estate Advisors</div>'
      +'</div>\n';
    var tl='tl',t=0;
    tl+='\n  .set("#sc-date",{opacity:1},0)'+xfi(0)
      +'\n  .to("#oh-eye",{opacity:1,duration:0.7},0.3)'
      +'\n  .to("#oh-head",{opacity:1,y:0,duration:1.0,ease:"power3.out"},0.7)'
      +'\n  .to("#oh-bar",{opacity:1,duration:0.5},1.4)'
      +'\n  .to("#oh-date",{opacity:1,y:0,duration:0.9,ease:"power2.out"},1.8)'
      +'\n  .to("#oh-time",{opacity:1,duration:0.7},2.5)'
      +xfd(dateD-0.35)+'\n  .set("#sc-date",{opacity:0},'+dateD.toFixed(2)+')';
    t=dateD;
    photos.forEach(function(p,i){
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,photoD,i);
      tl+=xfd(t+photoD-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+photoD).toFixed(2)+')';
      t+=photoD;
    });
    var ohOff=data.agentPhoto?0.7:0;
    tl+='\n  .set("#sc-close",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +(data.agentPhoto?'\n  .to("#ap",{opacity:1,duration:0.8},'+(t+0.3).toFixed(2)+')':'')
      +'\n  .to("#cl-addr",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.5+ohOff).toFixed(2)+')'
      +'\n  .to("#cl-when",{opacity:1,duration:0.7},'+(t+1.5+ohOff).toFixed(2)+')'
      +'\n  .to("#cl-name",{opacity:1,duration:0.6},'+(t+2.3+ohOff).toFixed(2)+')'
      +'\n  .to("#cl-brok",{opacity:1,duration:0.5},'+(t+2.9+ohOff).toFixed(2)+');';
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── PRICE IMPROVED ───────────────────────────────────────────── */
  function buildPriceImproved(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='pr-'+data.slug;
    var annD=4.0,photoD=3.5,agentD=4.0;
    var totalD=+(annD+photos.length*photoD+agentD).toFixed(1);
    var headSz=isV?'102px':isS?'94px':'140px';
    var oldSz=isV?'48px':isS?'42px':'62px';
    var newSz=isV?'84px':isS?'74px':'112px';
    var side=isV?'60px':isS?'50px':'100px';
    var css='.prcard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.pr-head{font-size:'+headSz+';font-weight:700;color:#F5F5F3;letter-spacing:4px;text-transform:uppercase;opacity:0;transform:translateY(24px)}\n'
      +'.pr-bar{width:60px;height:2px;background:rgba(245,245,243,0.25);margin:28px auto;opacity:0}\n'
      +'.pr-old{font-size:'+oldSz+';font-weight:300;color:rgba(245,245,243,0.45);text-decoration:line-through;opacity:0}\n'
      +'.pr-new{font-size:'+newSz+';font-weight:200;color:#F5F5F3;margin-top:12px;opacity:0;transform:translateY(16px)}\n'
      +'.pr-save{font-size:'+(isV?'22px':'26px')+';font-weight:300;color:rgba(245,245,243,0.5);margin-top:14px;opacity:0}\n'
      +sharedCss(W,H,isV,isS);
    var html='<div class="scene" id="sc-ann"><div class="prcard">'
      +'<div class="pr-head" id="pr-head">Price Improved</div>'
      +'<div class="pr-bar" id="pr-bar"></div>'
      +'<div class="pr-old" id="pr-old">'+esc(data.prOld)+'</div>'
      +'<div class="pr-new" id="pr-new">'+esc(data.prNew)+'</div>'
      +(data.prSave?'<div class="pr-save" id="pr-save">'+esc(data.prSave)+'</div>':'')
      +'</div></div>\n';
    photos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +'</div>\n';
    });
    html+=agentScene(logos.logoS,data.agents,data.agentPhoto);
    var tl='tl',t=0;
    tl+='\n  .set("#sc-ann",{opacity:1},0)'+xfi(0)
      +'\n  .to("#pr-head",{opacity:1,y:0,duration:1.0,ease:"power3.out"},0.4)'
      +'\n  .to("#pr-bar",{opacity:1,duration:0.5},1.2)'
      +'\n  .to("#pr-old",{opacity:1,duration:0.7},1.7)'
      +'\n  .to("#pr-new",{opacity:1,y:0,duration:0.9,ease:"power3.out"},2.2)'
      +(data.prSave?'\n  .to("#pr-save",{opacity:1,duration:0.6},2.9)':'')
      +xfd(annD-0.35)+'\n  .set("#sc-ann",{opacity:0},'+annD.toFixed(2)+')';
    t=annD;
    photos.forEach(function(p,i){
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,photoD,i+2);
      tl+=xfd(t+photoD-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+photoD).toFixed(2)+')';
      t+=photoD;
    });
    tl+=agentTL(t, !!data.agentPhoto);
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── COMPOSITION DISPATCH ──────────────────────────────────────── */
  function vidBuildComposition() {
    var addr=g('vid-address');
    if (!addr) { alert('Please enter a street address.'); return null; }
    if (vidPhotos.length===0) { alert('Please upload at least one property photo.'); return null; }
    var city=g('vid-city');
    var ctaMap = { dm:'DM for Details', link:'Link in Bio', call:'Call Today', tour:'Schedule a Tour', custom:g('ovl-cta-custom') };
    var ctaSel = (document.getElementById('ovl-cta-preset')||{}).value || 'dm';
    var data={
      addr: city ? addr+', '+city : addr,
      agents: g('vid-agents')||'Gateway Real Estate Advisors',
      agentPhoto: vidAgentPhoto ? vidAgentPhoto.dataUrl : null,
      price: g('vid-price'),
      stats: vidGetStats(),
      feat1:g('vid-feat1'),feat2:g('vid-feat2'),feat3:g('vid-feat3'),feat4:g('vid-feat4'),
      jlPrice:g('vjl-price'),jlBeds:g('vjl-beds'),jlBaths:g('vjl-baths'),jlSqft:g('vjl-sqft'),jlYear:g('vjl-year'),jlTagline:g('vjl-tagline'),
      ohDate:g('voh-date'),ohStart:g('voh-start'),ohEnd:g('voh-end'),ohPhone:g('voh-phone'),ohPrice:g('voh-price'),
      prOld:g('vpr-old'),prNew:g('vpr-new'),prSave:g('vpr-save'),
      jsSold:g('vjs-sold'),jsList:g('vjs-list'),jsDom:g('vjs-dom'),
      slug: addr.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+Date.now(),
      animStyle:   vidCurrentAnim,
      platform:    vidCurrentPlatform,
      quality:     vidCurrentQuality,
      watermark:   (document.getElementById('vid-watermark')||{}).checked !== false,
      musicVol:    parseInt((document.getElementById('music-vol')||{}).value||40,10),
      overlayHook: g('ovl-hook-text'),
      overlayHookPos: (document.getElementById('ovl-hook-pos')||{}).value,
      overlayStats:   (document.getElementById('ovl-stats-toggle')||{}).classList && document.getElementById('ovl-stats-toggle').classList.contains('on'),
      overlayCallouts: g('ovl-callout-text'),
      overlayCTA:  ctaMap[ctaSel] || ctaMap.dm,
      overlayCTAAgent: (document.getElementById('ovl-cta-agent')||{}).classList && document.getElementById('ovl-cta-agent').classList.contains('on'),
      overlayFont: vidCurrentFont
    };
    var logos=vidMakeLogos();
    var builders={'listing':buildListing,'just-listed':buildJustListed,'just-sold':buildJustSold,'open-house':buildOpenHouse,'price-improved':buildPriceImproved};
    var build=builders[vidCurrentTpl]||buildListing;
    return { html: build(data,vidPhotos,logos,vidCurrentFmt), slug: data.slug };
  }

  /* ── STATUS + RENDER PIPELINE (unchanged) ───────────────────────── */
  function vidSetStatus(state, msg, extra) {
    var bar=document.getElementById('vid-status-bar');
    var txt=document.getElementById('vid-status-text');
    var progWrap=document.getElementById('vid-progress-wrap');
    var progFill=document.getElementById('vid-progress-fill');
    var outSec=document.getElementById('vid-output-section');
    var outIn=document.getElementById('vid-output-inner');
    var stepMap={uploading:'vstep-upload',rendering:'vstep-render',processing:'vstep-process',success:'vstep-done'};
    var progMap={uploading:25,rendering:55,processing:80,success:100};
    var isActive=state==='uploading'||state==='rendering'||state==='processing';
    if (bar) bar.className='vid-status-bar'+(isActive?' running':state==='success'?' success':state==='error'?' error':'');
    if (txt) txt.textContent=msg;
    if (progWrap) {
      progWrap.style.display=(isActive||state==='success')?'block':'none';
      if (progFill) progFill.style.width=(progMap[state]||0)+'%';
      ['vstep-upload','vstep-render','vstep-process','vstep-done'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.classList.remove('active');
      });
      var step=stepMap[state]; if (step) { var el=document.getElementById(step); if(el) el.classList.add('active'); }
    }
    if (state==='success'&&extra) {
      if (outSec) outSec.style.display='block';
      var addrSlug=(g('vid-address')||'property').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
      var dateStr=new Date().toISOString().slice(0,10);
      var platLabel={reels:'Reels-TikTok',feed:'Instagram-Feed',landscape:'YouTube-FB',shorts:'YouTube-Shorts',story:'Story'}[vidCurrentPlatform]||vidCurrentPlatform;
      var dlName=addrSlug+'_'+platLabel+'_'+dateStr+'.mp4';
      var autoDl=(document.getElementById('vid-autodl')||{}).checked!==false;
      if (autoDl&&extra.url){var a=document.createElement('a');a.href=extra.url;a.download=dlName;document.body.appendChild(a);a.click();document.body.removeChild(a);}
      if (outIn) outIn.innerHTML=''
        +'<h4 style="margin-bottom:2px">Video Ready</h4>'
        +'<p class="vid-out-sub">Rendered in ~'+extra.elapsed+'s &nbsp;&middot;&nbsp; '+platLabel+'</p>'
        +'<a class="vid-mp4-link" href="'+extra.url+'" download="'+dlName+'">⬇️ Download MP4</a>'
        +'<div class="vid-output-actions">'
        +'<a href="'+extra.url+'" target="_blank" style="font-size:12px;color:var(--brand-gray)">Open in new tab</a>'
        +' &nbsp;&middot;&nbsp; '
        +'<a href="https://github.com/'+VID_REPO+'/actions" target="_blank" style="font-size:12px;color:var(--brand-gray)">View Actions log</a>'
        +'</div>';
    } else if (state==='error'&&extra) {
      if (progWrap) progWrap.style.display='none';
      if (outSec) outSec.style.display='block';
      if (outIn) outIn.innerHTML=''
        +'<p style="font-size:13px;color:#E74C3C;font-weight:600;margin-bottom:6px">⚠️ Render failed</p>'
        +'<p style="font-size:12px;color:var(--brand-gray);line-height:1.6">'+esc(extra.msg)+'</p>'
        +'<p style="margin-top:10px"><a href="https://github.com/'+VID_REPO+'/actions" target="_blank" style="font-size:12px;color:var(--brand-gray)">View Actions log →</a></p>';
    } else { if (outSec) outSec.style.display='none'; }
  }

  var VID_REPO='gatewayhq/gatewayhq.github.io';
  var vidPollTimer=null;

  window.vidRender = async function() {
    var btn=document.getElementById('vid-gen-btn');
    var token=(localStorage.getItem('gh_pat')||document.getElementById('vid-gh-token').value||'').trim();
    var branch=(localStorage.getItem('gh_branch')||document.getElementById('vid-gh-branch').value||'').trim()||'main';
    if (!token) {
      document.getElementById('vid-settings').open=true;
      document.getElementById('vid-gh-token').focus();
      vidSetStatus('error','GitHub token required — enter it in settings below',{msg:'Add your PAT in the GitHub Render Settings section.'});
      return;
    }
    var comp=vidBuildComposition();
    if (!comp) return;
    btn.disabled=true;
    var platName = { reels:'Reels/TikTok', feed:'Instagram Feed', landscape:'YouTube/FB', shorts:'YouTube Shorts', story:'Story Format' }[vidCurrentPlatform] || vidCurrentPlatform;
    vidSetStatus('uploading','Adding ' + vidCurrentAnim + ' animation... Uploading to GitHub...');
    try {
      var b64=btoa(unescape(encodeURIComponent(comp.html)));
      var compPath='compositions/pending/'+comp.slug+'.html';
      var uploadRes=await fetch('https://api.github.com/repos/'+VID_REPO+'/contents/'+compPath,{
        method:'PUT',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/vnd.github+json'},
        body:JSON.stringify({message:'Add composition: '+comp.slug,content:b64,branch:branch})
      });
      if (!uploadRes.ok) { var ue=await uploadRes.json(); throw new Error('Upload failed: '+(ue.message||uploadRes.status)); }
      var musicPath='';
      if (vidMusicFile) {
        vidSetStatus('uploading','Uploading music file to GitHub...');
        var musicUpPath='compositions/pending/'+comp.slug+'-music.'+vidMusicFile.ext;
        var musicB64=vidMusicFile.dataUrl.split(',')[1];
        var musicUpRes=await fetch('https://api.github.com/repos/'+VID_REPO+'/contents/'+musicUpPath,{
          method:'PUT',
          headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/vnd.github+json'},
          body:JSON.stringify({message:'Add music: '+comp.slug,content:musicB64,branch:branch})
        });
        if (!musicUpRes.ok) { var me=await musicUpRes.json(); throw new Error('Music upload failed: '+(me.message||musicUpRes.status)); }
        musicPath=musicUpPath;
      }
      var triggerTime=new Date().toISOString();
      var dispatchRes=await fetch('https://api.github.com/repos/'+VID_REPO+'/actions/workflows/render-listing-video.yml/dispatches',{
        method:'POST',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/vnd.github+json'},
        body:JSON.stringify({ref:branch,inputs:{output_slug:comp.slug,composition_path:compPath,music_path:musicPath}})
      });
      if (!dispatchRes.ok&&dispatchRes.status!==204) { var de=await dispatchRes.json(); throw new Error('Dispatch failed: '+(de.message||dispatchRes.status)); }
      vidSetStatus('rendering','Rendering on GitHub Actions... (~3-5 min)');
      var startMs=Date.now();
      var triggerMs=new Date(triggerTime).getTime();
      var dlUrl=await new Promise(function(resolve,reject){
        var pollCount=0,elapsed=0;
        vidPollTimer=setInterval(async function(){
          pollCount++; elapsed=Math.round((Date.now()-startMs)/1000);
          if (pollCount>100){clearInterval(vidPollTimer);reject(new Error('Timed out after 20 min. Check GitHub Actions for details.'));return;}
          try {
            var runsRes=await fetch('https://api.github.com/repos/'+VID_REPO+'/actions/runs?event=workflow_dispatch&per_page=20',{
              headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}
            });
            var rd=await runsRes.json();
            var run=(rd.workflow_runs||[]).find(function(r){
              return r.name==='Render Listing Video'&&new Date(r.created_at).getTime()>=triggerMs-10000;
            });
            if (!run){vidSetStatus('rendering','Waiting for runner... ('+elapsed+'s)');return;}
            var pct=Math.min(95,Math.round((elapsed/180)*100));
            var pMsg=elapsed<20?'Adding animations... '+pct+'%':elapsed<60?'Syncing music... '+pct+'%':elapsed<120?'Rendering text overlays... '+pct+'%':'Finalizing '+platName+' export... '+pct+'%';
            if (run.status!=='completed'){vidSetStatus('rendering',pMsg+' ('+elapsed+'s)');return;}
            clearInterval(vidPollTimer);
            if (run.conclusion==='success'){
              vidSetStatus('processing','Verifying download... ('+elapsed+'s)');
              var rawUrl='https://raw.githubusercontent.com/'+VID_REPO+'/'+branch+'/renders/'+comp.slug+'.mp4';
              var resolvedUrl=rawUrl;
              for (var vi=0;vi<15;vi++){
                await new Promise(function(r){setTimeout(r,3000);});
                try {
                  var ck=await fetch('https://api.github.com/repos/'+VID_REPO+'/contents/renders/'+comp.slug+'.mp4?ref='+branch,{
                    headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'}
                  });
                  if (ck.ok){var ckd=await ck.json();resolvedUrl=ckd.download_url||rawUrl;break;}
                } catch(e2){}
              }
              resolve({url:resolvedUrl,elapsed:elapsed,slug:comp.slug});
            } else { reject(new Error('Workflow ended: '+run.conclusion)); }
          } catch(pe){}
        },12000);
      });
      vidSetStatus('success','Video ready!',dlUrl);
    } catch(e){ vidSetStatus('error',e.message,{msg:e.message}); }
    finally { btn.disabled=false; }
  };

  (function(){
    var tok=localStorage.getItem('gh_pat');
    var br=localStorage.getItem('gh_branch');
    if (tok) document.getElementById('vid-gh-token').value=tok;
    var bEl=document.getElementById('vid-gh-branch');
    if (bEl) bEl.value=br||'main';
    var audioDrop=document.getElementById('vid-audio-drop');
    if (audioDrop) {
      audioDrop.addEventListener('dragover',function(e){e.preventDefault();audioDrop.style.borderColor='#C8A84B';});
      audioDrop.addEventListener('dragleave',function(){audioDrop.style.borderColor='';});
      audioDrop.addEventListener('drop',function(e){
        e.preventDefault();audioDrop.style.borderColor='';
        var f=e.dataTransfer.files[0];
        if (f&&/audio/.test(f.type)) vidHandleMusicFile(f);
      });
    }
  })();

})();

document.addEventListener('DOMContentLoaded', function() {
  // Boot AI status badge
  renderAIStatusBadge();

  loadScheduledPosts();
  var savedToken = (window.CONFIG && window.CONFIG.bufferAccessToken) || localStorage.getItem('buffer_access_token') || '';
  var tokenInput = document.getElementById('buffer-token-input');
  if (tokenInput && savedToken) {
    tokenInput.value = savedToken;
  }
});