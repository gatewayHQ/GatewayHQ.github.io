(function() {

  /* ── STATE ─────────────────────────────────────────────────────── */
  var vidPhotos      = [];
  var vidAgentPhoto  = null; // { dataUrl, name }
  var vidMusicFile   = null; // { dataUrl, name, ext }
  var vidDragIdx     = null;
  var vidCurrentTpl  = 'listing';
  var vidCurrentFmt  = '16:9';
  var vidType        = 'residential';

  // GitHub repo used for composition uploads, workflow dispatch, and render
  // polling/links. Referenced by every render path AND by vidSetStatus when
  // rendering the success/error result UI — so a missing declaration throws
  // "ReferenceError: VID_REPO is not defined" on EVERY render outcome, which
  // silently breaks the Video Generator for all agents even when the render
  // itself succeeds server-side. Keep in sync with GH_REPO in
  // supabase/functions/gateway-api/index.ts.
  var VID_REPO = 'gatewayhq/gatewayhq.github.io';

  var VID_TEMPLATES = [
    { id:'listing',        name:'Listing Promo',        icon:'🏠', desc:'30–60s · all photos',    formId:'vtf-listing'        },
    { id:'just-listed',    name:'Just Listed',          icon:'🔑', desc:'20–45s · all photos',    formId:'vtf-just-listed'    },
    { id:'just-sold',      name:'Just Sold',            icon:'🏆', desc:'15–25s · all photos',    formId:'vtf-just-sold'      },
    { id:'open-house',     name:'Open House',           icon:'📅', desc:'20–35s · all photos',    formId:'vtf-open-house'     },
    { id:'price-improved', name:'Price Improved',       icon:'📉', desc:'15–25s · all photos',    formId:'vtf-price-reduced'  },
    { id:'neighborhood',   name:'Neighborhood Tour',    icon:'🌳', desc:'25–40s · area showcase', formId:'vtf-neighborhood'   },
    { id:'agent-intro',    name:'Agent Introduction',   icon:'👤', desc:'20–30s · personal brand',formId:'vtf-agent-intro'    },
    { id:'market-update',  name:'Market Update',        icon:'📊', desc:'25–35s · local data',    formId:'vtf-market-update'  }
  ];

  var FMT = {
    '16:9': { w:1920, h:1080 },
    '9:16': { w:1080, h:1920 },
    '1:1':  { w:1080, h:1080 }
  };

  /* ── NEW STATE ────────────────────────────────────────────────── */
  var vidCurrentAnim    = 'kenburns';
  var vidLibraryTrack   = null; // { id, path } — set when user picks from built-in library

  var VID_MUSIC_LIBRARY = {
    none:      { path: null,                          label: 'No Music'        },
    luxury:    { path: 'music/01-luxury-calm.mp3',    label: 'Luxury Calm'     },
    upbeat:    { path: 'music/02-upbeat-energy.mp3',  label: 'Upbeat Energy'   },
    cinematic: { path: 'music/03-cinematic-drama.mp3',label: 'Cinematic Drama' },
    acoustic:  { path: 'music/04-warm-acoustic.mp3',  label: 'Warm Acoustic'   },
    modern:    { path: 'music/05-modern-beat.mp3',    label: 'Modern Beat'     }
  };
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
                   fade:'Fade Dissolve', zoomout:'Zoom Out', split:'Split Screen', spinzoom:'Spin + Zoom', panoramic:'Panoramic Wide Pan' };
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

  // Map UI quality labels to valid HyperFrames render values.
  // HyperFrames `render --quality` accepts ONLY: draft | standard | high.
  // Sending anything else (e.g. "balanced", "fast") fails the render.
  function vidHFQuality() {
    return ({ fast: 'draft', balanced: 'standard', high: 'high' })[vidCurrentQuality] || 'standard';
  }

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

  /* ── MUSIC LIBRARY ───────────────────────────────────────────── */
  window.vidMusicTab = function(tab, btn) {
    document.getElementById('vid-music-library-panel').style.display = tab === 'library' ? '' : 'none';
    document.getElementById('vid-music-upload-panel').style.display  = tab === 'upload'  ? '' : 'none';
    document.getElementById('vid-music-tab-lib').style.background = tab === 'library' ? 'rgba(162,182,192,0.12)' : 'none';
    document.getElementById('vid-music-tab-lib').style.color      = tab === 'library' ? '#C8D8E0' : 'var(--brand-gray)';
    document.getElementById('vid-music-tab-up').style.background  = tab === 'upload'  ? 'rgba(162,182,192,0.12)' : 'none';
    document.getElementById('vid-music-tab-up').style.color       = tab === 'upload'  ? '#C8D8E0' : 'var(--brand-gray)';
  };

  window.vidSelectLibraryTrack = function(id, el) {
    document.querySelectorAll('.vid-music-card').forEach(function(c){ c.classList.remove('sel'); });
    el.classList.add('sel');
    var track = VID_MUSIC_LIBRARY[id];
    if (!track) return;
    vidLibraryTrack = id === 'none' ? null : { id: id, path: track.path, label: track.label };
    var vol = document.getElementById('vid-vol-row');
    if (vol) vol.style.display = id !== 'none' ? '' : 'none';
  };

  /* ── AI AUTO-FILL ────────────────────────────────────────────── */
  window.vidAIFill = function() {
    var addr    = g('vid-address') || g('vnh-name') || g('vai-name') || g('vmu-area');
    var city    = g('vid-city')    || g('vnh-area')  || g('vmu-area');
    var tplName = (VID_TEMPLATES.find(function(t){return t.id===vidCurrentTpl;})||{}).name || vidCurrentTpl;
    var btn     = document.getElementById('vid-ai-fill-btn');
    if (btn) { btn.disabled = true; btn.textContent = '✦ Filling…'; }
    var prompt  = 'Generate engaging video copy for a real estate ' + tplName + ' video.'
      + (addr ? ' Property/subject: ' + addr : '')
      + (city ? ', ' + city + '.' : '.')
      + ' Return ONLY a JSON object with these keys:'
      + ' hookText (punchy opening line, max 8 words),'
      + ' feat1, feat2, feat3, feat4 (key property features, format: "Label — detail", e.g. "Renovated Kitchen — Quartz countertops"),'
      + ' callouts (3-4 feature callout lines for text overlay, newline separated, ALL CAPS),'
      + ' cta (call to action phrase, max 5 words).'
      + ' Keep it high-energy and real estate professional.';
    GatewayAPI.claude('You are a real estate marketing copywriter.', prompt, { max_tokens: 400 })
      .then(function(text) {
        var json;
        try {
          var m = text.match(/\{[\s\S]*\}/);
          json = m ? JSON.parse(m[0]) : null;
        } catch(e) { json = null; }
        if (!json) { showGlobalStatus('AI fill: could not parse response. Try again.'); return; }
        if (json.hookText) { var hk = document.getElementById('ovl-hook-text'); if (hk) hk.value = json.hookText; }
        if (json.feat1) { var f1 = document.getElementById('vid-feat1'); if (f1) f1.value = json.feat1; }
        if (json.feat2) { var f2 = document.getElementById('vid-feat2'); if (f2) f2.value = json.feat2; }
        if (json.feat3) { var f3 = document.getElementById('vid-feat3'); if (f3) f3.value = json.feat3; }
        if (json.feat4) { var f4 = document.getElementById('vid-feat4'); if (f4) f4.value = json.feat4; }
        if (json.callouts) { var co = document.getElementById('ovl-callout-text'); if (co) co.value = json.callouts; }
        if (json.cta) {
          var ctaSel = document.getElementById('ovl-cta-preset');
          var ctaCustom = document.getElementById('ovl-cta-custom');
          var ctaRow = document.getElementById('ovl-cta-custom-row');
          if (ctaSel) ctaSel.value = 'custom';
          if (ctaCustom) ctaCustom.value = json.cta;
          if (ctaRow) ctaRow.style.display = '';
        }
        vidRenderScenePreview();
        showGlobalStatus('✦ AI filled your video copy!');
      })
      .catch(function(err) { showGlobalStatus('AI fill failed: ' + (err.message || err)); })
      .finally(function() {
        if (btn) { btn.disabled = false; btn.textContent = '✦ AI Fill'; }
      });
  };

  /* ── RENDER TIME ESTIMATOR ───────────────────────────────────── */
  function vidUpdateEstimate() {
    var el = document.getElementById('vid-est-time');
    if (!el) return;
    var photoCount = vidPhotos.length;
    var baseSec = { listing:360, 'just-listed':300, 'just-sold':240, 'open-house':300, 'price-improved':240, neighborhood:360, 'agent-intro':240, 'market-update':300 }[vidCurrentTpl] || 300;
    var estSec = Math.round(baseSec + photoCount * 20);
    var estMin = Math.round(estSec / 60);
    el.textContent = 'Est. ~' + (estMin < 2 ? '1–2' : estMin + '–' + (estMin + 2)) + ' min';
  }

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
  // Compress a photo to ≤1920px, 85% JPEG for video embedding.
  // Keeps file size small enough to upload via the GitHub Contents API.
  function vidCompressPhoto(file) {
    return new Promise(function(resolve) {
      var isHeic = /^image\/hei[cf]$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (isHeic) {
        alert('HEIC photos are not supported for video. Please convert to JPEG first:\n• iPhone: Settings → Camera → Formats → "Most Compatible"\n• Mac: right-click → Quick Actions → Convert Image → JPEG');
        resolve(null); return;
      }
      var objectUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function() {
        var sw = img.naturalWidth, sh = img.naturalHeight;
        if (!sw || !sh) { URL.revokeObjectURL(objectUrl); resolve(null); return; }
        var scale = Math.min(1, 1920 / Math.max(sw, sh));
        var tw = Math.max(1, Math.round(sw * scale));
        var th = Math.max(1, Math.round(sh * scale));
        var canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, tw, th);
        URL.revokeObjectURL(objectUrl);
        var dataUrl;
        try { dataUrl = canvas.toDataURL('image/jpeg', 0.85); }
        catch(e) {
          var fr = new FileReader();
          fr.onload = function(ev) { resolve({ dataUrl: ev.target.result, name: file.name }); };
          fr.onerror = function() { resolve(null); };
          fr.readAsDataURL(file); return;
        }
        resolve({ dataUrl: dataUrl, name: file.name });
      };
      img.onerror = function() {
        URL.revokeObjectURL(objectUrl);
        var fr = new FileReader();
        fr.onload = function(ev) { resolve({ dataUrl: ev.target.result, name: file.name }); };
        fr.onerror = function() { resolve(null); };
        fr.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  }

  window.vidHandleFiles = function(files) {
    Array.from(files).forEach(function(file){
      vidCompressPhoto(file).then(function(photo) {
        if (!photo) return;
        vidPhotos.push(photo);
        vidRenderThumbs();
        vidRenderScenePreview();
        var hint=document.getElementById("vid-scene-hint");
        var cnt=document.getElementById("vid-scene-count");
        if (hint) hint.style.display="none";
        if (cnt) cnt.textContent=vidPhotos.length+" photo"+(vidPhotos.length!==1?"s":"");
        vidUpdateEstimate();
      });
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

    } else if (vidCurrentTpl === 'neighborhood') {
      var nhName = g('vnh-name') || 'Neighborhood Tour';
      var nhArea = g('vnh-area') || city || '—';
      html += pc('Intro Card', null, nhName, nhArea, '#0D1117');
      for (var i=0; i<vidPhotos.length; i++) {
        var hl = [g('vnh-h1'),g('vnh-h2'),g('vnh-h3'),g('vnh-h4')][i] || null;
        html += pc('Scene '+(i+2)+' · Area', vidPhotos[i], hl, null);
      }
      html += pc('Highlights Card', null, g('vnh-price')||'Avg Price', g('vnh-walk')||'Walk Score', '#0D1117');
      html += pc('Agent Close', null, agents, 'Gateway Real Estate Advisors', '#0D1117');

    } else if (vidCurrentTpl === 'agent-intro') {
      var aiName = g('vai-name') || agents;
      var aiTitle = g('vai-title') || 'Real Estate Advisor';
      html += pc('Name Card', null, aiName, aiTitle, '#0D1117');
      for (var i=0; i<vidPhotos.length; i++)
        html += pc('Scene '+(i+2)+' · Photo', vidPhotos[i], i===0?g('vai-tag')||null:null, null);
      html += pc('Credentials', null, g('vai-years')||'Experience', g('vai-creds')||'Specialties', '#0D1117');
      html += pc('Contact Card', null, aiName, g('vai-phone')||'Gateway Real Estate Advisors', '#0D1117');

    } else if (vidCurrentTpl === 'market-update') {
      var muArea = g('vmu-area') || '—';
      var muPeriod = g('vmu-period') || '—';
      html += pc('Intro Card', null, 'MARKET UPDATE', muArea + ' · ' + muPeriod, '#0D1117');
      html += pc('Price Stats', null, g('vmu-price')||'Median Price', g('vmu-pchg')||'YoY Change', '#0D1117');
      html += pc('Activity Stats', null, g('vmu-dom')||'Avg Days on Market', g('vmu-sold')||'Homes Sold', '#0D1117');
      var tempo = g('vmu-tempo') || 'seller';
      html += pc('Market Tempo', null, tempo==='seller'?"Seller's Market":tempo==='buyer'?"Buyer's Market":'Balanced Market', g('vmu-msg')||'', '#0D1117');
      html += pc('Agent Close', null, agents, 'Gateway Real Estate Advisors', '#0D1117');
    }

    c.innerHTML = html || '<p style="font-size:11px;color:var(--brand-gray);padding:12px">Upload photos to see scene preview</p>';
  }

  function pc(label, photo, l1, l2, bg) {
    var isDark = !photo && bg === '#0D1117';
    var s = bg ? 'background:'+bg+';' : 'background:#1a2a35;';
    if (isDark) s = 'background:linear-gradient(135deg,#0D1117,#152229);';
    var img = photo ? '<img src="'+photo.dataUrl+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.65">' : '';
    // For dark branded cards (stats/agent), render a styled mini layout instead of bottom text
    if (isDark) {
      var inner = '';
      if (l1) inner += '<div style="font-size:9px;font-weight:600;color:#C8D8E0;letter-spacing:1px;text-align:center;text-transform:uppercase;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l1)+'</div>';
      if (l1 && l2) inner += '<div style="width:24px;height:1px;background:rgba(162,182,192,0.35);margin:4px auto"></div>';
      if (l2) inner += '<div style="font-size:8px;color:rgba(162,182,192,0.55);text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l2)+'</div>';
      return '<div class="vid-scene-card">'
        + '<div class="vid-scene-label">'+esc(label)+'</div>'
        + '<div class="vid-scene-preview" style="position:relative;overflow:hidden;'+s+';display:flex;align-items:center;justify-content:center;">'
        + '<div style="padding:6px 8px;width:100%">'+inner+'</div>'
        + '</div></div>';
    }
    var t1 = l1 ? '<div style="font-size:9px;font-weight:700;color:#F5F5F3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l1)+'</div>' : '';
    var t2 = l2 ? '<div style="font-size:8px;color:rgba(245,245,243,0.5);margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l2)+'</div>' : '';
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
  window.vidUpdatePreview = function() { vidRenderScenePreview(); vidUpdateEstimate(); };

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
      +'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"><\/script>\n'
      +'<style>\n* { margin:0; padding:0; box-sizing:border-box; }\n'
      +'html,body { width:'+w+'px; height:'+h+'px; overflow:hidden; background:#0D1117; font-family:\'Inter\',\'Helvetica Neue\',sans-serif; color:#fff; }\n'
      +'#root { position:relative; width:'+w+'px; height:'+h+'px; overflow:hidden; }\n'
      +'.scene { position:absolute; inset:0; opacity:0; }\n'
      +'.pw { position:absolute; inset:0; overflow:hidden; }\n'
      +'.pb { position:absolute; inset:-2px; width:calc(100% + 4px); height:calc(100% + 4px); object-fit:cover; transform-origin:center center; }\n'
      +'.pano { inset:auto!important; top:0!important; left:0!important; width:165%!important; height:100%!important; object-fit:cover!important; transform-origin:left center!important; }\n'
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
  // Panoramic pan tween — wide horizontal sweep (image is 165% wide in CSS)
  // dir: even = pan left→right, odd = pan right→left
  function pan(i, t, dur, dir) {
    var lr = (dir % 2 === 0);
    return '\n  .fromTo("#pb'+i+'",'
      +'{x:"'+(lr?'-16%':'16%')+'"},'
      +'{x:"'+(lr?'16%':'-16%')+'",duration:'+dur+',ease:"none"},'
      +t.toFixed(2)+')';
  }
  function xfd(t) { return '\n  .to("#ov",{opacity:1,duration:0.35},'+t.toFixed(2)+')'; }
  function xfi(t) { return '\n  .to("#ov",{opacity:0,duration:0.35},'+t.toFixed(2)+')'; }

  // Stats card HTML
  function statsScene(stats) {
    return '<div class="scene sc-stats" id="sc-stats">'
      +'<div class="sc-accent-top"></div>'
      +'<div class="si">'
      +stats.slice(0,3).map(function(s,i){
        return (i>0?'<div class="sd"></div>':'')
          +'<div class="sb"><div class="sv" id="sv'+i+'">'+esc(s.val)+'</div>'
          +'<div class="sl2" id="sl'+i+'">'+esc(s.lbl)+'</div></div>';
      }).join('')+'</div>'
      +'<div class="sc-accent-bot"></div>'
      +'</div>\n';
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
    return '.sc-stats{background:linear-gradient(135deg,#0D1117 0%,#131E27 55%,#0D1117 100%);display:flex;align-items:center;justify-content:center}\n'
      +'.sc-stats::before{content:"";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:1px;background:linear-gradient(90deg,transparent,rgba(162,182,192,0.15),transparent)}\n'
      +'.si{display:flex;align-items:center;position:relative;z-index:1}\n'
      +'.sb{text-align:center;padding:0 '+spH+'}\n'
      +'.sd{width:1px;height:'+(isV?'80px':'60px')+';background:rgba(162,182,192,0.2)}\n'
      +'.sv{font-size:'+stV+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.sl2{font-size:17px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(162,182,192,0.55);margin-top:12px;opacity:0}\n'
      +'.sc-agent{background:linear-gradient(160deg,#0D1117 0%,#152229 50%,#0D1117 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px}\n'
      +'.alog{width:'+logW+';height:'+logW+';opacity:0;margin-bottom:24px;object-fit:contain}\n'
      +'.acta{font-size:'+ctaS+';font-weight:200;color:#F5F5F3;opacity:0;transform:translateY(18px)}\n'
      +'.aname{font-size:'+namS+';font-weight:300;color:#F5F5F3;margin-top:28px;opacity:0}\n'
      +'.abrok{font-size:15px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.45);margin-top:10px;opacity:0}\n'
      +'.atag{font-size:13px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(245,245,243,0.25);margin-top:14px;opacity:0}\n'
      +'.ap{width:'+apW+';height:'+apH+';border-radius:10px;object-fit:cover;border:3px solid rgba(162,182,192,0.25);opacity:0;margin-bottom:28px}\n'
      +'.sc-accent-top{position:absolute;top:'+(isV?'80px':'60px')+';left:50%;transform:translateX(-50%);width:40px;height:1px;background:rgba(162,182,192,0.3)}\n'
      +'.sc-accent-bot{position:absolute;bottom:'+(isV?'80px':'60px')+';left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(162,182,192,0.1),transparent)}\n';
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
    var isPan=(vidCurrentAnim==='panoramic');
    photos.forEach(function(p,i){
      var f=feats[i-1]||''; var fs=f?f.split(/[—–]/)[0].trim():'';
      scenesH+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb'+(i>0&&isPan?' pano':'')+'" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
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
      tl+=xfi(t); tl+=(i>0&&isPan)?pan(i,t,dur,i):kb(i,t,dur,i);
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
    var isPan=(vidCurrentAnim==='panoramic');
    photos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb'+(i>0&&isPan?' pano':'')+'" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
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
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+((i>0&&isPan)?pan(i,t,dur,i+2):kb(i,t,dur,i+2));
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

  /* ── NEIGHBORHOOD TOUR ──────────────────────────────────────────── */
  function buildNeighborhood(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='nh-'+data.slug;
    var introD=4.0,photoD=3.8,hlD=3.5,agentD=4.0;
    var totalD=+(introD+photos.length*photoD+hlD+agentD).toFixed(1);
    var headSz=isV?'88px':isS?'80px':'120px';
    var subSz=isV?'38px':isS?'32px':'48px';
    var side=isV?'60px':isS?'50px':'100px';
    var ltSz=isV?'28px':isS?'24px':'34px';
    var css='.nhcard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.nh-eye{font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(245,245,243,0.35);opacity:0}\n'
      +'.nh-head{font-size:'+headSz+';font-weight:700;color:#F5F5F3;letter-spacing:-1px;margin-top:16px;opacity:0;transform:translateY(24px)}\n'
      +'.nh-bar{width:60px;height:2px;background:rgba(245,245,243,0.2);margin:24px auto;opacity:0}\n'
      +'.nh-sub{font-size:'+subSz+';font-weight:200;color:rgba(245,245,243,0.6);opacity:0;transform:translateY(14px)}\n'
      +'.lt{position:absolute;bottom:'+(isV?'90px':'70px')+';left:'+side+';right:'+side+';pointer-events:none}\n'
      +'.lt-bar{height:3px;background:#A2B6C0;width:0;margin-bottom:10px}\n'
      +'.lt-text{font-size:'+ltSz+';font-weight:300;color:#F5F5F3;opacity:0;transform:translateY(8px)}\n'
      +'.hl-grid{display:grid;grid-template-columns:1fr 1fr;gap:'+(isV?'24px':'32px')+';width:100%;max-width:'+(isV?'600px':'900px')+'}\n'
      +'.hl-box{background:rgba(255,255,255,0.04);border:1px solid rgba(162,182,192,0.18);border-radius:16px;padding:'+(isV?'24px':'32px')+';text-align:center;opacity:0;transform:translateY(18px)}\n'
      +'.hl-val{font-size:'+(isV?'42px':'54px')+';font-weight:200;color:#F5F5F3;margin-bottom:8px}\n'
      +'.hl-lbl{font-size:14px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:rgba(245,245,243,0.4)}\n'
      +sharedCss(W,H,isV,isS);
    var highlights=[data.nhH1,data.nhH2,data.nhH3,data.nhH4].filter(Boolean);
    var hlData=[
      {val:data.nhPrice||'—',lbl:'Avg Home Price'},
      {val:data.nhWalk||'—',lbl:'Walk Score'},
      {val:String(highlights.length||'—'),lbl:'Local Highlights'},
      {val:((data.agents||'Gateway').split(' ')[0])||'GW',lbl:'Your Agent'}
    ];
    var html='<div class="scene" id="sc-intro"><div class="nhcard">'
      +'<div class="nh-eye" id="nh-eye">Gateway Real Estate Advisors</div>'
      +'<div class="nh-head" id="nh-head">'+esc(data.nhName||'Neighborhood Tour')+'</div>'
      +'<div class="nh-bar" id="nh-bar"></div>'
      +'<div class="nh-sub" id="nh-sub">'+esc(data.nhArea||data.addr)+'</div>'
      +'</div></div>\n';
    photos.forEach(function(p,i){
      var hl=highlights[i]||'';
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +(hl?'<div class="lt" id="lt'+i+'"><div class="lt-bar" id="ltbar'+i+'"></div><div class="lt-text" id="ltxt'+i+'">'+esc(hl)+'</div></div>':'')
        +'</div>\n';
    });
    html+='<div class="scene" id="sc-hl"><div class="nhcard"><div class="hl-grid" id="hl-grid">'
      +hlData.map(function(d,i){ return '<div class="hl-box" id="hlb'+i+'"><div class="hl-val">'+esc(d.val)+'</div><div class="hl-lbl">'+esc(d.lbl)+'</div></div>'; }).join('')
      +'</div></div></div>\n';
    html+=agentScene(logos.logoS,data.agents,data.agentPhoto);
    var tl='tl',t=0;
    tl+='\n  .set("#sc-intro",{opacity:1},0)'+xfi(0)
      +'\n  .to("#nh-eye",{opacity:1,duration:0.7},0.3)'
      +'\n  .to("#nh-head",{opacity:1,y:0,duration:1.1,ease:"power3.out"},0.7)'
      +'\n  .to("#nh-bar",{opacity:1,duration:0.5},1.5)'
      +'\n  .to("#nh-sub",{opacity:1,y:0,duration:0.9,ease:"power2.out"},2.0)'
      +xfd(introD-0.35)+'\n  .set("#sc-intro",{opacity:0},'+introD.toFixed(2)+')';
    t=introD;
    photos.forEach(function(p,i){
      var hl=highlights[i]||'';
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,photoD,i);
      if(hl){
        tl+='\n  .to("#ltbar'+i+'",{width:"80px",duration:0.5,ease:"power2.out"},'+(t+1.2).toFixed(2)+')'
          +'\n  .to("#ltxt'+i+'",{opacity:1,y:0,duration:0.7,ease:"power2.out"},'+(t+1.6).toFixed(2)+')';
      }
      tl+=xfd(t+photoD-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+photoD).toFixed(2)+')';
      t+=photoD;
    });
    tl+='\n  .set("#sc-hl",{opacity:1},'+t.toFixed(2)+')'+xfi(t);
    hlData.forEach(function(_,i){
      tl+='\n  .to("#hlb'+i+'",{opacity:1,y:0,duration:0.8,ease:"power3.out"},'+(t+0.3+i*0.2).toFixed(2)+')';
    });
    tl+=xfd(t+hlD-0.35)+'\n  .set("#sc-hl",{opacity:0},'+(t+hlD).toFixed(2)+')'; t+=hlD;
    tl+=agentTL(t, !!data.agentPhoto);
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── AGENT INTRODUCTION ─────────────────────────────────────────── */
  function buildAgentIntro(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='ai-'+data.slug;
    var nameD=4.5,photoD=3.5,credD=3.5,contactD=4.0;
    var totalD=+(nameD+photos.length*photoD+credD+contactD).toFixed(1);
    var nameSz=isV?'88px':isS?'80px':'120px';
    var titleSz=isV?'32px':isS?'28px':'42px';
    var side=isV?'60px':isS?'50px':'100px';
    var credSz=isV?'28px':isS?'24px':'34px';
    var css='.aicard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.ai-tag{font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(245,245,243,0.35);opacity:0}\n'
      +'.ai-name{font-size:'+nameSz+';font-weight:700;color:#F5F5F3;letter-spacing:-1px;margin-top:16px;opacity:0;transform:translateY(24px)}\n'
      +'.ai-bar{width:60px;height:2px;background:rgba(245,245,243,0.2);margin:24px auto;opacity:0}\n'
      +'.ai-title{font-size:'+titleSz+';font-weight:200;color:rgba(245,245,243,0.6);opacity:0}\n'
      +'.ai-yrs{font-size:'+(isV?'22px':'26px')+';font-weight:300;color:rgba(245,245,243,0.35);margin-top:16px;opacity:0}\n'
      +'.cred-card{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.cred-head{font-size:'+(isV?'18px':'22px')+';font-weight:500;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.4);opacity:0}\n'
      +'.cred-line{font-size:'+credSz+';font-weight:200;color:#F5F5F3;margin-top:20px;opacity:0;transform:translateY(10px)}\n'
      +'.contact-card{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.ct-logo{width:'+(isV?'140px':'160px')+';height:'+(isV?'140px':'160px')+';opacity:0;margin-bottom:24px;object-fit:contain}\n'
      +'.ct-name{font-size:'+(isV?'52px':'68px')+';font-weight:300;color:#F5F5F3;opacity:0;transform:translateY(16px)}\n'
      +'.ct-title{font-size:'+(isV?'24px':'29px')+';font-weight:300;color:rgba(245,245,243,0.55);margin-top:8px;opacity:0}\n'
      +'.ct-phone{font-size:'+(isV?'34px':'44px')+';font-weight:200;color:#F5F5F3;margin-top:24px;opacity:0}\n'
      +'.ct-brok{font-size:14px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.35);margin-top:14px;opacity:0}\n'
      +sharedCss(W,H,isV,isS);
    var credLines=(data.aiCreds||'').split('\n').filter(Boolean).slice(0,4);
    var html='<div class="scene" id="sc-name"><div class="aicard">'
      +'<div class="ai-tag" id="ai-tag">Gateway Real Estate Advisors</div>'
      +'<div class="ai-name" id="ai-name">'+esc(data.aiName||data.agents)+'</div>'
      +'<div class="ai-bar" id="ai-bar"></div>'
      +'<div class="ai-title" id="ai-title">'+esc(data.aiTitle||'Real Estate Advisor')+'</div>'
      +(data.aiYears?'<div class="ai-yrs" id="ai-yrs">'+esc(data.aiYears)+'</div>':'')
      +'</div></div>\n';
    photos.forEach(function(p,i){
      html+='<div class="scene" id="sc'+i+'">'
        +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
        +'<div class="pg"></div>'
        +'</div>\n';
    });
    html+='<div class="scene" id="sc-cred"><div class="cred-card">'
      +'<div class="cred-head" id="cred-head">Specialties &amp; Credentials</div>'
      +credLines.map(function(l,i){return '<div class="cred-line" id="crl'+i+'">'+esc(l)+'</div>';}).join('')
      +'</div></div>\n';
    html+='<div class="scene" id="sc-contact"><div class="contact-card">'
      +'<img class="ct-logo" id="ct-logo" src="'+logos.logoS+'" alt="Gateway">'
      +'<div class="ct-name" id="ct-name">'+esc(data.aiName||data.agents)+'</div>'
      +'<div class="ct-title" id="ct-title">'+esc(data.aiTitle||'Gateway Real Estate Advisors')+'</div>'
      +(data.aiPhone?'<div class="ct-phone" id="ct-phone">'+esc(data.aiPhone)+'</div>':'')
      +'<div class="ct-brok" id="ct-brok">Gateway Real Estate Advisors · Opening Doors to Your Future</div>'
      +'</div></div>\n';
    var tl='tl',t=0;
    tl+='\n  .set("#sc-name",{opacity:1},0)'+xfi(0)
      +'\n  .to("#ai-tag",{opacity:1,duration:0.7},0.3)'
      +'\n  .to("#ai-name",{opacity:1,y:0,duration:1.2,ease:"power3.out"},0.7)'
      +'\n  .to("#ai-bar",{opacity:1,duration:0.5},1.6)'
      +'\n  .to("#ai-title",{opacity:1,duration:0.8},2.0)'
      +(data.aiYears?'\n  .to("#ai-yrs",{opacity:1,duration:0.6},2.7)':'')
      +xfd(nameD-0.35)+'\n  .set("#sc-name",{opacity:0},'+nameD.toFixed(2)+')';
    t=nameD;
    photos.forEach(function(p,i){
      tl+='\n  .set("#sc'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,photoD,i+1);
      tl+=xfd(t+photoD-0.35)+'\n  .set("#sc'+i+'",{opacity:0},'+(t+photoD).toFixed(2)+')';
      t+=photoD;
    });
    tl+='\n  .set("#sc-cred",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +'\n  .to("#cred-head",{opacity:1,duration:0.6},'+(t+0.4).toFixed(2)+')';
    credLines.forEach(function(_,i){
      tl+='\n  .to("#crl'+i+'",{opacity:1,y:0,duration:0.8,ease:"power3.out"},'+(t+0.8+i*0.25).toFixed(2)+')';
    });
    tl+=xfd(t+credD-0.35)+'\n  .set("#sc-cred",{opacity:0},'+(t+credD).toFixed(2)+')'; t+=credD;
    tl+='\n  .set("#sc-contact",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +'\n  .to("#ct-logo",{opacity:1,duration:0.9},'+(t+0.4).toFixed(2)+')'
      +'\n  .to("#ct-name",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+1.1).toFixed(2)+')'
      +'\n  .to("#ct-title",{opacity:1,duration:0.7},'+(t+2.0).toFixed(2)+')'
      +(data.aiPhone?'\n  .to("#ct-phone",{opacity:1,duration:0.8},'+(t+2.6).toFixed(2)+')':'')
      +'\n  .to("#ct-brok",{opacity:1,duration:0.5},'+(t+3.2).toFixed(2)+');';
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── MARKET UPDATE ──────────────────────────────────────────────── */
  function buildMarketUpdate(data, photos, logos, fmt) {
    var dim=FMT[fmt]||FMT['16:9']; var W=dim.w,H=dim.h,isV=H>W,isS=W===H;
    var compId='mu-'+data.slug;
    var introD=4.0,statD=4.0,tempoD=3.5,agentD=4.0;
    var hasPhotos=photos.length>0;
    var totalD=+(introD+(hasPhotos?photos.length*3.5:0)+statD+statD+tempoD+agentD).toFixed(1);
    var headSz=isV?'80px':isS?'72px':'108px';
    var metricSz=isV?'72px':isS?'62px':'96px';
    var side=isV?'60px':isS?'50px':'100px';
    var tempo=data.muTempo||'seller';
    var tempoLabel=tempo==='seller'?"SELLER'S MARKET":tempo==='buyer'?"BUYER'S MARKET":'BALANCED MARKET';
    var tempoColor=tempo==='seller'?'#C9A84C':tempo==='buyer'?'#4CAEAF':'#A2B6C0';
    var css='.mucard{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.mu-tag{font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(245,245,243,0.35);opacity:0}\n'
      +'.mu-head{font-size:'+headSz+';font-weight:800;color:#F5F5F3;letter-spacing:4px;text-transform:uppercase;margin-top:16px;opacity:0;transform:translateY(24px)}\n'
      +'.mu-bar{width:60px;height:2px;background:rgba(245,245,243,0.2);margin:24px auto;opacity:0}\n'
      +'.mu-sub{font-size:'+(isV?'30px':'38px')+';font-weight:200;color:rgba(245,245,243,0.55);opacity:0}\n'
      +'.stat-card{display:grid;grid-template-columns:1fr 1fr;gap:'+(isV?'28px':'40px')+';align-items:center;justify-content:center;height:100%;background:#0D1117;padding:0 '+side+'}\n'
      +'.stat-box{text-align:center;opacity:0;transform:translateY(20px)}\n'
      +'.stat-val{font-size:'+metricSz+';font-weight:200;color:#F5F5F3;letter-spacing:-1px}\n'
      +'.stat-chg{font-size:'+(isV?'22px':'28px')+';color:#A2B6C0;font-weight:300;margin-top:6px}\n'
      +'.stat-lbl{font-size:14px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,243,0.4);margin-top:10px}\n'
      +'.tempo-card{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0D1117;text-align:center;padding:0 '+side+'}\n'
      +'.tempo-sub{font-size:11px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:rgba(245,245,243,0.3);opacity:0}\n'
      +'.tempo-label{font-size:'+(isV?'66px':isS?'56px':'84px')+';font-weight:800;letter-spacing:4px;text-transform:uppercase;color:'+esc(tempoColor)+';margin-top:20px;opacity:0;transform:scale(0.88)}\n'
      +'.tempo-msg{font-size:'+(isV?'26px':'32px')+';font-weight:200;color:rgba(245,245,243,0.55);margin-top:24px;opacity:0;transform:translateY(12px)}\n'
      +sharedCss(W,H,isV,isS);
    var html='<div class="scene" id="sc-intro"><div class="mucard">'
      +'<div class="mu-tag" id="mu-tag">Gateway Real Estate Advisors</div>'
      +'<div class="mu-head" id="mu-head">Market Update</div>'
      +'<div class="mu-bar" id="mu-bar"></div>'
      +'<div class="mu-sub" id="mu-sub">'+esc((data.muArea||data.addr)+' · '+(data.muPeriod||''))+'</div>'
      +'</div></div>\n';
    if(hasPhotos){
      photos.forEach(function(p,i){
        html+='<div class="scene" id="scph'+i+'">'
          +'<div class="pw"><img class="pb" id="pb'+i+'" src="'+p.dataUrl+'" alt=""></div>'
          +'<div class="pg"></div>'
          +'</div>\n';
      });
    }
    html+='<div class="scene stat-card" id="sc-stat1">'
      +'<div class="stat-box" id="sb0"><div class="stat-val">'+esc(data.muPrice||'—')+'</div>'+(data.muPchg?'<div class="stat-chg">'+esc(data.muPchg)+'</div>':'')+'<div class="stat-lbl">Median Price</div></div>'
      +'<div class="stat-box" id="sb1"><div class="stat-val">'+esc(data.muDom||'—')+'</div><div class="stat-lbl">Avg Days on Mkt</div></div>'
      +'</div>\n';
    html+='<div class="scene stat-card" id="sc-stat2">'
      +'<div class="stat-box" id="sb2"><div class="stat-val">'+esc(data.muSold||'—')+'</div><div class="stat-lbl">Homes Sold</div></div>'
      +'<div class="stat-box" id="sb3"><div class="stat-val">'+esc(data.muLts||'—')+'</div><div class="stat-lbl">List-to-Sale</div></div>'
      +'</div>\n';
    html+='<div class="scene tempo-card" id="sc-tempo">'
      +'<div class="tempo-sub" id="tempo-sub">Current Conditions</div>'
      +'<div class="tempo-label" id="tempo-label">'+esc(tempoLabel)+'</div>'
      +(data.muMsg?'<div class="tempo-msg" id="tempo-msg">'+esc(data.muMsg)+'</div>':'')
      +'</div>\n';
    html+=agentScene(logos.logoS,data.agents,data.agentPhoto);
    var tl='tl',t=0;
    tl+='\n  .set("#sc-intro",{opacity:1},0)'+xfi(0)
      +'\n  .to("#mu-tag",{opacity:1,duration:0.7},0.3)'
      +'\n  .to("#mu-head",{opacity:1,y:0,duration:1.1,ease:"power3.out"},0.7)'
      +'\n  .to("#mu-bar",{opacity:1,duration:0.5},1.5)'
      +'\n  .to("#mu-sub",{opacity:1,duration:0.9},2.0)'
      +xfd(introD-0.35)+'\n  .set("#sc-intro",{opacity:0},'+introD.toFixed(2)+')';
    t=introD;
    if(hasPhotos){
      photos.forEach(function(p,i){
        tl+='\n  .set("#scph'+i+'",{opacity:1},'+t.toFixed(2)+')'+xfi(t)+kb(i,t,3.5,i);
        tl+=xfd(t+3.5-0.35)+'\n  .set("#scph'+i+'",{opacity:0},'+(t+3.5).toFixed(2)+')';
        t+=3.5;
      });
    }
    tl+='\n  .set("#sc-stat1",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +'\n  .to("#sb0",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.5).toFixed(2)+')'
      +'\n  .to("#sb1",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.8).toFixed(2)+')'
      +xfd(t+statD-0.35)+'\n  .set("#sc-stat1",{opacity:0},'+(t+statD).toFixed(2)+')'; t+=statD;
    tl+='\n  .set("#sc-stat2",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +'\n  .to("#sb2",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.5).toFixed(2)+')'
      +'\n  .to("#sb3",{opacity:1,y:0,duration:1.0,ease:"power3.out"},'+(t+0.8).toFixed(2)+')'
      +xfd(t+statD-0.35)+'\n  .set("#sc-stat2",{opacity:0},'+(t+statD).toFixed(2)+')'; t+=statD;
    tl+='\n  .set("#sc-tempo",{opacity:1},'+t.toFixed(2)+')'+xfi(t)
      +'\n  .to("#tempo-sub",{opacity:1,duration:0.7},'+(t+0.5).toFixed(2)+')'
      +'\n  .to("#tempo-label",{opacity:1,scale:1,duration:1.1,ease:"back.out(1.3)"},'+(t+1.0).toFixed(2)+')'
      +(data.muMsg?'\n  .to("#tempo-msg",{opacity:1,y:0,duration:0.8,ease:"power2.out"},'+(t+2.2).toFixed(2)+')':'')
      +xfd(t+tempoD-0.35)+'\n  .set("#sc-tempo",{opacity:0},'+(t+tempoD).toFixed(2)+')'; t+=tempoD;
    tl+=agentTL(t, !!data.agentPhoto);
    return mkH(compId,totalD,W,H,css)+html+mkF(compId,tl);
  }

  /* ── COMPOSITION DISPATCH ──────────────────────────────────────── */
  function vidBuildComposition() {
    var noAddrTpls = ['agent-intro','market-update'];
    var noPhotoTpls = ['agent-intro','market-update'];
    var addr = noAddrTpls.indexOf(vidCurrentTpl) === -1 ? g('vid-address') : (g('vnh-name')||g('vai-name')||g('vmu-area')||'Video');
    if (!addr && noAddrTpls.indexOf(vidCurrentTpl) === -1) { alert('Please enter a street address.'); return null; }
    if (vidPhotos.length===0 && noPhotoTpls.indexOf(vidCurrentTpl) === -1) { alert('Please upload at least one property photo.'); return null; }
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
      nhName:g('vnh-name'),nhArea:g('vnh-area'),nhTagline:g('vnh-tagline'),nhPrice:g('vnh-price'),nhWalk:g('vnh-walk'),
      nhH1:g('vnh-h1'),nhH2:g('vnh-h2'),nhH3:g('vnh-h3'),nhH4:g('vnh-h4'),
      aiName:g('vai-name'),aiTitle:g('vai-title'),aiYears:g('vai-years'),aiTag:g('vai-tag'),aiPhone:g('vai-phone'),aiCreds:g('vai-creds'),
      muArea:g('vmu-area'),muPeriod:g('vmu-period'),muPrice:g('vmu-price'),muPchg:g('vmu-pchg'),
      muDom:g('vmu-dom'),muSold:g('vmu-sold'),muLts:g('vmu-lts'),muActive:g('vmu-active'),
      muTempo:(document.getElementById('vmu-tempo')||{}).value||'seller',muMsg:g('vmu-msg'),
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
    var builders={'listing':buildListing,'just-listed':buildJustListed,'just-sold':buildJustSold,'open-house':buildOpenHouse,'price-improved':buildPriceImproved,'neighborhood':buildNeighborhood,'agent-intro':buildAgentIntro,'market-update':buildMarketUpdate};
    var build=builders[vidCurrentTpl]||buildListing;
    var fmt=(PLATFORM_FMT[vidCurrentPlatform]||{}).aspect||vidCurrentFmt;
    return { html: build(data,vidPhotos,logos,fmt), slug: data.slug, _data: data, _logos: logos, _fmt: fmt };
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

  var vidPollTimer=null;

  // Progress phases shared by all render paths (platName fills in phase 2 at runtime)
  var RENDER_PROGRESS_PHASES = [
    { until: 30,   msg: 'Waiting for runner…'  },
    { until: 90,   msg: 'Rendering frames…'    },
    { until: 180,  msg: null                   }, // filled with 'Encoding {platName}…'
    { until: 360,  msg: 'Mixing audio…'        },
    { until: 2700, msg: 'Finalizing…'          }
  ];

  // Shared Realtime + fallback-poll watcher for a video_jobs row.
  // Both the Edge Function path and the Supabase path use this after
  // the job is queued, avoiding duplicated Realtime/polling/ticker code.
  function vidWatchJob(client, jobId, platName) {
    return new Promise(function(resolve, reject) {
      var startMs = Date.now();

      function getPhaseMsg() {
        var elap = (Date.now() - startMs) / 1000;
        for (var k = 0; k < RENDER_PROGRESS_PHASES.length; k++) {
          if (elap < RENDER_PROGRESS_PHASES[k].until) {
            return RENDER_PROGRESS_PHASES[k].msg || ('Encoding ' + platName + '…');
          }
        }
        return 'Finalizing…';
      }

      var ticker = setInterval(function() {
        var elap = Math.round((Date.now() - startMs) / 1000);
        vidSetStatus('rendering', getPhaseMsg() + ' ' + elap + 's');
      }, 4000);

      function finish(row) {
        clearInterval(ticker);
        clearInterval(fallbackTimer);
        if (vidRealtimeSub) { try { client.removeChannel(vidRealtimeSub); } catch(e){} vidRealtimeSub = null; }
        if (row.status === 'completed' && row.render_url) {
          resolve({ url: row.render_url, elapsed: row.elapsed_sec || Math.round((Date.now()-startMs)/1000) });
        } else {
          var logUrl = row.run_id ? '\n\nActions log: https://github.com/' + VID_REPO + '/actions/runs/' + row.run_id : '';
          reject(new Error((row.error_msg || 'Render failed') + logUrl));
        }
      }

      if (vidRealtimeSub) { try { client.removeChannel(vidRealtimeSub); } catch(e){} vidRealtimeSub = null; }

      vidRealtimeSub = client
        .channel('vid-job-' + jobId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_jobs', filter: 'id=eq.' + jobId },
          function(payload) {
            var row = payload.new || {};
            if (row.status !== 'completed' && row.status !== 'failed') return;
            finish(row);
          })
        .subscribe(function(status) {
          if (status === 'CHANNEL_ERROR') console.warn('[Video] Realtime error; fallback polling active');
        });

      // Fallback DB poll every 15s in case Realtime doesn't fire
      // (e.g. video_jobs not yet in the supabase_realtime publication)
      var pollAttempts = 0;
      var fallbackTimer = setInterval(async function() {
        if (++pollAttempts > 200) { // 200 × 15s = 50 min
          clearInterval(ticker);
          clearInterval(fallbackTimer);
          if (vidRealtimeSub) { try { client.removeChannel(vidRealtimeSub); } catch(e){} vidRealtimeSub = null; }
          reject(new Error('Render timed out after 50 min. Check GitHub Actions for details.'));
          return;
        }
        try {
          var pr = await client.from('video_jobs')
            .select('status,render_url,error_msg,elapsed_sec,run_id').eq('id', jobId).single();
          var row = pr.data || {};
          if (row.status === 'completed' || row.status === 'failed') finish(row);
        } catch(e) {}
      }, 15000);
    });
  }

  // ── Photo compression ─────────────────────────────────────────────
  // Resize photos to max 1280px before embedding so composition HTML
  // stays under the Edge Function's 6 MB body limit.
  function compressPhoto(dataUrl, maxDim) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w <= maxDim && h <= maxDim) { resolve(dataUrl); return; }
        var scale = Math.min(maxDim / w, maxDim / h);
        var canvas = document.createElement('canvas');
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = function() { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  async function compressPhotos(photos, maxDim) {
    return Promise.all(photos.map(async function(p) {
      var compressed = await compressPhoto(p.dataUrl, maxDim || 1280);
      return { dataUrl: compressed, name: p.name };
    }));
  }
  var vidRealtimeSub=null;

  // ── Edge Function render (preferred path when logged in) ──────────
  // Rebuilds composition HTML with compressed photos, sends to the
  // Supabase Edge Function (server-side GH_PAT — no client PAT needed).
  async function vidRenderViaEdge(comp, platName, compressedPhotos, branch) {
    var sync    = window.GatewaySync;
    var client  = sync._client;
    var auth    = sync._session.access_token;
    var quality = vidHFQuality();
    var ref     = branch || 'main';

    // Builders accept photos as a parameter — no need to touch vidPhotos global.
    var builders = {'listing':buildListing,'just-listed':buildJustListed,'just-sold':buildJustSold,
      'open-house':buildOpenHouse,'price-improved':buildPriceImproved,
      'neighborhood':buildNeighborhood,'agent-intro':buildAgentIntro,'market-update':buildMarketUpdate};
    var logos = window.GW && window.GW.logos ? window.GW.logos() : { logoS: '', logoW: '' };
    var fmt   = (PLATFORM_FMT[vidCurrentPlatform]||{}).aspect || vidCurrentFmt;
    var uploadHtml = (builders[vidCurrentTpl] || buildListing)(comp._data, compressedPhotos, logos, fmt);
    var b64 = btoa(unescape(encodeURIComponent(uploadHtml)));

    vidSetStatus('uploading', 'Compressing & uploading via secure server...');
    var baseUrl = (window.GatewayAPI && window.GatewayAPI.proxyUrl()) || '';
    if (!baseUrl) throw new Error('Supabase proxy URL not configured in ai-config.js');

    var res = await fetch(baseUrl + '/api/video-render', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compHtmlB64: b64,
        slug:        comp.slug,
        platform:    vidCurrentPlatform,
        musicPath:   (vidLibraryTrack && vidLibraryTrack.path) ? vidLibraryTrack.path : '',
        branch:      ref,
        quality:     quality,
      }),
    });

    var result = await res.json().catch(function(){return {};});
    if (!res.ok) throw new Error(result.error || 'Edge Function render failed (' + res.status + ')');

    var jobId = result.jobId;
    if (!jobId) throw new Error('__FALLBACK__');

    vidSetStatus('rendering', 'Queued — waiting for runner…');
    return vidWatchJob(client, jobId, platName);
  }

  // ── Supabase-tracked render (secondary path — requires client-side PAT) ──
  // Requires: ☁ Sync login (Supabase session) + GitHub PAT (repo scope).
  // Uploads composition + optional music to GitHub, creates a Supabase job
  // record, dispatches the workflow, then watches the job via vidWatchJob.
  async function vidRenderSupabase(comp, platName, token, branch) {
    var sync   = window.GatewaySync;
    var client = sync._client;
    var userId = sync._session.user.id;

    // 1. Upload composition to GitHub
    vidSetStatus('uploading', 'Adding ' + vidCurrentAnim + ' animation... Uploading to GitHub...');
    var b64      = btoa(unescape(encodeURIComponent(comp.html)));
    var compPath = 'compositions/pending/' + comp.slug + '.html';
    var uploadRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/contents/' + compPath, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ message: 'Add composition: ' + comp.slug, content: b64, branch: branch })
    });
    if (!uploadRes.ok) {
      var ue = await uploadRes.json();
      var uMsg = ue.message || uploadRes.status;
      if (uploadRes.status === 401) uMsg = 'Bad credentials — your GitHub token is invalid or expired.';
      else if (uploadRes.status === 403) uMsg = 'Permission denied — your GitHub token needs "repo" (Contents write) scope.';
      throw new Error('Upload failed: ' + uMsg);
    }

    var musicPath = '';
    if (vidMusicFile) {
      vidSetStatus('uploading', 'Uploading music file to GitHub...');
      var musicUpPath = 'compositions/pending/' + comp.slug + '-music.' + vidMusicFile.ext;
      var musicB64    = vidMusicFile.dataUrl.split(',')[1];
      var musicUpRes  = await fetch('https://api.github.com/repos/' + VID_REPO + '/contents/' + musicUpPath, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
        body: JSON.stringify({ message: 'Add music: ' + comp.slug, content: musicB64, branch: branch })
      });
      if (!musicUpRes.ok) { var me = await musicUpRes.json(); throw new Error('Music upload failed: ' + (me.message || musicUpRes.status)); }
      musicPath = musicUpPath;
    } else if (vidLibraryTrack && vidLibraryTrack.path) {
      musicPath = vidLibraryTrack.path;
    }

    // 2. Create Supabase job record
    vidSetStatus('rendering', 'Queuing render...');
    var insertRes = await client.from('video_jobs').insert({
      user_id:          userId,
      slug:             comp.slug,
      status:           'queued',
      platform:         vidCurrentPlatform,
      composition_path: compPath
    }).select('id').single();

    if (insertRes.error || !insertRes.data) {
      console.warn('[Video] Could not create job record:', insertRes.error?.message, '— falling back to legacy polling');
      throw new Error('__FALLBACK__');
    }
    var jobId   = insertRes.data.id;
    var quality = vidHFQuality();

    // 3. Dispatch GitHub Actions — passes job_id so Actions can callback to Supabase
    var dispatchRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/actions/workflows/render-listing-video.yml/dispatches', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ ref: branch, inputs: { job_id: jobId, output_slug: comp.slug, quality: quality, composition_path: compPath, music_path: musicPath } })
    });
    if (!dispatchRes.ok && dispatchRes.status !== 204) {
      var de = await dispatchRes.json().catch(function(){return {};});
      await client.from('video_jobs').update({ status: 'failed', error_msg: 'Dispatch failed: ' + (de.message || dispatchRes.status) }).eq('id', jobId);
      throw new Error('Dispatch failed: ' + (de.message || dispatchRes.status));
    }

    // 4. Watch job via shared Realtime + fallback-poll helper
    vidSetStatus('rendering', 'Queued — waiting for runner…');
    return vidWatchJob(client, jobId, platName);
  }

  // ── Legacy GitHub-PAT render (fallback when not logged into Supabase) ──
  // Kept intact from original implementation. Uses GH PAT to upload
  // composition files and polls GitHub Actions API for status.
  // Timeout extended to 45 min to match the new Actions timeout.
  // ──────────────────────────────────────────────────────────────────────
  async function vidRenderLegacy(comp, platName, token, branch) {
    vidSetStatus('uploading', 'Adding ' + vidCurrentAnim + ' animation... Uploading to GitHub...');
    var b64 = btoa(unescape(encodeURIComponent(comp.html)));
    var compPath = 'compositions/pending/' + comp.slug + '.html';
    var uploadRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/contents/' + compPath, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ message: 'Add composition: ' + comp.slug, content: b64, branch: branch })
    });
    if (!uploadRes.ok) {
      var ue = await uploadRes.json();
      var uMsg = ue.message || uploadRes.status;
      if (uploadRes.status === 401) uMsg = 'Bad credentials — your GitHub token is invalid or expired. Open Settings below, paste a new PAT with "repo" scope, and try again.';
      else if (uploadRes.status === 403) uMsg = 'Permission denied — your GitHub token needs "repo" (Contents write) scope.';
      throw new Error('Upload failed: ' + uMsg);
    }
    var musicPath = '';
    if (vidMusicFile) {
      vidSetStatus('uploading', 'Uploading music file to GitHub...');
      var musicUpPath = 'compositions/pending/' + comp.slug + '-music.' + vidMusicFile.ext;
      var musicB64 = vidMusicFile.dataUrl.split(',')[1];
      var musicUpRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/contents/' + musicUpPath, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
        body: JSON.stringify({ message: 'Add music: ' + comp.slug, content: musicB64, branch: branch })
      });
      if (!musicUpRes.ok) { var me = await musicUpRes.json(); throw new Error('Music upload failed: ' + (me.message || musicUpRes.status)); }
      musicPath = musicUpPath;
    } else if (vidLibraryTrack && vidLibraryTrack.path) {
      musicPath = vidLibraryTrack.path;
    }
    var triggerTime = new Date().toISOString();
    var dispatchRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/actions/workflows/render-listing-video.yml/dispatches', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ ref: branch, inputs: { output_slug: comp.slug, composition_path: compPath, music_path: musicPath } })
    });
    if (!dispatchRes.ok && dispatchRes.status !== 204) { var de = await dispatchRes.json(); throw new Error('Dispatch failed: ' + (de.message || dispatchRes.status)); }
    vidSetStatus('rendering', 'Rendering on GitHub Actions... (~5-8 min)');
    var startMs = Date.now();
    var triggerMs = new Date(triggerTime).getTime();
    return new Promise(function(resolve, reject) {
      var pollCount = 0;
      vidPollTimer = setInterval(async function() {
        pollCount++;
        var elapsed = Math.round((Date.now() - startMs) / 1000);
        // 225 polls × 12s = 45 min (matches the new Actions timeout)
        if (pollCount > 225) { clearInterval(vidPollTimer); reject(new Error('Timed out after 45 min. Check GitHub Actions for details.')); return; }
        try {
          var runsRes = await fetch('https://api.github.com/repos/' + VID_REPO + '/actions/runs?event=workflow_dispatch&per_page=20', {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
          });
          var rd = await runsRes.json();
          var run = (rd.workflow_runs || []).find(function(r) {
            return r.name === 'Render Listing Video' && new Date(r.created_at).getTime() >= triggerMs - 10000;
          });
          if (!run) { vidSetStatus('rendering', 'Waiting for runner... (' + elapsed + 's)'); return; }
          var pct = Math.min(95, Math.round((elapsed / 300) * 100));
          var pMsg = elapsed < 30 ? 'Installing renderer... ' + pct + '%'
            : elapsed < 90  ? 'Rendering frames... ' + pct + '%'
            : elapsed < 200 ? 'Encoding ' + platName + '... ' + pct + '%'
            : 'Finalizing export... ' + pct + '%';
          if (run.status !== 'completed') { vidSetStatus('rendering', pMsg + ' (' + elapsed + 's)'); return; }
          clearInterval(vidPollTimer);
          if (run.conclusion === 'success') {
            vidSetStatus('processing', 'Verifying download... (' + elapsed + 's)');
            var rawUrl = 'https://raw.githubusercontent.com/' + VID_REPO + '/' + branch + '/renders/' + comp.slug + '.mp4';
            var resolvedUrl = rawUrl;
            for (var vi = 0; vi < 15; vi++) {
              await new Promise(function(r){ setTimeout(r, 3000); });
              try {
                var ck = await fetch('https://api.github.com/repos/' + VID_REPO + '/contents/renders/' + comp.slug + '.mp4?ref=' + branch, {
                  headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
                });
                if (ck.ok) { var ckd = await ck.json(); resolvedUrl = ckd.download_url || rawUrl; break; }
              } catch(e2){}
            }
            resolve({ url: resolvedUrl, elapsed: elapsed, slug: comp.slug });
          } else { reject(new Error('Workflow ended: ' + run.conclusion)); }
        } catch(pe){}
      }, 12000);
    });
  }

  // Convert base64 data URL → Blob (needed for Supabase Storage upload)
  function dataURLtoBlob(dataUrl) {
    var arr = dataUrl.split(',');
    var mime = (arr[0].match(/:(.*?);/) || ['','application/octet-stream'])[1];
    var bstr = atob(arr[1]);
    var u8 = new Uint8Array(bstr.length);
    for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  // ── Update GitHub settings UI based on team PAT availability ────────
  // Called by sync.js after login/logout and by the init block below.
  window.vidRefreshTokenUI = function() {
    var hasteamPat = !!(window._gwTeamRenderPat);
    var badge = document.getElementById('vid-team-pat-badge');
    var personalWrap = document.getElementById('vid-personal-pat-wrap');
    if (badge)        badge.style.display        = hasteamPat ? '' : 'none';
    if (personalWrap) personalWrap.style.display = hasteamPat ? 'none' : '';
  };

  // ── Main render entry point ───────────────────────────────────────
  window.vidRender = async function() {
    var btn = document.getElementById('vid-gen-btn');
    var platName = { reels:'Reels/TikTok', feed:'Instagram Feed', landscape:'YouTube/FB', shorts:'YouTube Shorts', story:'Story Format' }[vidCurrentPlatform] || vidCurrentPlatform;
    var comp = vidBuildComposition();
    if (!comp) return;
    btn.disabled = true;

    var branch = (localStorage.getItem('gh_branch') || (document.getElementById('vid-gh-branch') || {}).value || '').trim() || 'main';
    var sync   = window.GatewaySync;
    var isLoggedIn = !!(sync && sync.isLoggedIn && sync.isLoggedIn() && sync._client && sync._session);

    try {
      var dlUrl;

      if (isLoggedIn && window.GatewayAPI && window.GatewayAPI.proxyUrl()) {
        // ── Best path: Edge Function handles upload + dispatch server-side.
        // No client-side GitHub PAT required. Compresses photos first.
        try {
          vidSetStatus('uploading', 'Preparing photos…');
          var compressed = await compressPhotos(vidPhotos, 1280);
          dlUrl = await vidRenderViaEdge(comp, platName, compressed, branch);
        } catch(e) {
          if (e.message === '__FALLBACK__') {
            // Edge Function unavailable (GH_PAT not set) — try client-side paths
            var token = (window._gwTeamRenderPat || localStorage.getItem('gh_pat') || (document.getElementById('vid-gh-token')||{}).value||'').trim();
            if (!token) throw new Error('Render requires either a server-side GH_PAT (set in Supabase Edge Function secrets) or a personal GitHub token in Settings below.');
            dlUrl = await vidRenderSupabase(comp, platName, token, branch);
          } else {
            throw e;
          }
        }
      } else if (isLoggedIn && sync._client) {
        // ── Secondary path: Supabase-tracked with client-side PAT
        var token = (window._gwTeamRenderPat || localStorage.getItem('gh_pat') || (document.getElementById('vid-gh-token')||{}).value||'').trim();
        if (!token) {
          var settingsEl = document.getElementById('vid-settings');
          if (settingsEl) settingsEl.open = true;
          throw new Error('GitHub token required — enter it in settings below, or contact your admin to set GH_PAT in the Edge Function secrets.');
        }
        try {
          dlUrl = await vidRenderSupabase(comp, platName, token, branch);
        } catch(e) {
          if (e.message === '__FALLBACK__') {
            dlUrl = await vidRenderLegacy(comp, platName, token, branch);
          } else { throw e; }
        }
      } else {
        // ── Legacy path: direct GitHub API polling (no Supabase session)
        var token = (window._gwTeamRenderPat || localStorage.getItem('gh_pat') || (document.getElementById('vid-gh-token')||{}).value||'').trim();
        if (!token) {
          var settingsEl = document.getElementById('vid-settings');
          if (settingsEl) settingsEl.open = true;
          throw new Error('Sign in via ☁ Sync for server-managed rendering, or add a GitHub PAT in settings below.');
        }
        dlUrl = await vidRenderLegacy(comp, platName, token, branch);
      }

      vidSetStatus('success', 'Video ready!', dlUrl);
    } catch(e) {
      vidSetStatus('error', e.message, { msg: e.message });
    } finally {
      btn.disabled = false;
    }
  };

  (function(){
    var tok=localStorage.getItem('gh_pat');
    var br=localStorage.getItem('gh_branch');
    if (tok) document.getElementById('vid-gh-token').value=tok;
    var bEl=document.getElementById('vid-gh-branch');
    if (bEl) bEl.value=br||'main';
    vidUpdateEstimate();
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