// ==== NAVIGATION ====
var currentPage = 'landing';
var homeValuationInitialized = false;
var videoInitialized = false;
var pageNames = {
  landing: 'Home',
  social: 'Social Media Builder',
  multifamily: 'Multifamily OM Builder',
  leasing: 'Leasing OM Builder',
  valuation: 'Valuation Tool',
  invoice: 'Invoice Generator',
  'home-valuation': 'Home Valuation Generator',
  'video': 'Video Generator',
  'graphics': 'Social & Mailer Graphics',
  'photo-enhancer': 'Professional Photo Enhancer'
};

// Cache page element references — avoids repeated getElementById on every nav
var _pageCache = {};
function _getPage(id) {
  if (!_pageCache[id]) _pageCache[id] = document.getElementById('page-' + id);
  return _pageCache[id];
}

var _allPages = null;
function navigateTo(page) {
  if (!_allPages) _allPages = document.querySelectorAll('.page');
  _allPages.forEach(function(p) { p.classList.remove('active'); });
  var target = _getPage(page);
  if (target) target.classList.add('active');
  currentPage = page;
  var homeBtn = document.getElementById('home-btn');
  if (homeBtn) homeBtn.style.display = page === 'landing' ? 'none' : 'block';
  var bc = document.getElementById('nav-breadcrumb');
  if (bc) bc.textContent = page === 'landing' ? '' : (pageNames[page] || page);
  window.scrollTo(0, 0);

  // Track visit for recently-used (skip landing itself)
  if (page !== 'landing' && window.GW && GW.trackPageVisit) {
    GW.trackPageVisit(page, pageNames[page] || page);
  }

  // Refresh recently-used strip when returning home
  if (page === 'landing') renderRecentlyUsed();

  // Initialize modules on first visit only
  if (page === 'social'   && !socialInitialized)  initSocialBuilder();
  if (page === 'valuation' && !valuationInitialized) initValuation();
  if (page === 'leasing'  && !leasingInitialized)  initLeasing();
  if (page === 'invoice'  && !invoiceInitialized)  { initInvoice(); invoiceInitialized = true; }
  if (page === 'video'    && !videoInitialized)    { videoInitialized = true; }
  if (page === 'photo-enhancer' && !photoEnhancerInitialized) initPhotoEnhancer();
  if (page === 'home-valuation') {
    if (!homeValuationInitialized) { initHomeValuation(); homeValuationInitialized = true; }
    renderSavedHVs();
  }
}

// Recently-used quick-access strip on the landing page
function renderRecentlyUsed() {
  var wrap = document.getElementById('landing-recent');
  var list = document.getElementById('landing-recent-list');
  if (!wrap || !list || !window.GW) return;
  var recent = GW.getRecentPages();
  if (!recent.length) { wrap.style.display = 'none'; return; }
  list.innerHTML = '';
  recent.forEach(function(r) {
    var btn = document.createElement('button');
    btn.onclick = function() { navigateTo(r.id); };
    btn.style.cssText = 'padding:8px 18px;border-radius:20px;border:1px solid rgba(162,182,192,0.35);' +
      'background:rgba(162,182,192,0.08);color:#C8D8E0;font-family:"Montserrat",sans-serif;' +
      'font-size:12px;font-weight:600;cursor:pointer;transition:background 0.15s,border-color 0.15s;';
    btn.onmouseenter = function() {
      btn.style.background = 'rgba(162,182,192,0.18)';
      btn.style.borderColor = 'rgba(162,182,192,0.6)';
    };
    btn.onmouseleave = function() {
      btn.style.background = 'rgba(162,182,192,0.08)';
      btn.style.borderColor = 'rgba(162,182,192,0.35)';
    };
    btn.textContent = r.name;
    list.appendChild(btn);
  });
  wrap.style.display = 'block';
}

// Keyboard shortcut: Escape → home
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && currentPage !== 'landing') {
    var active = document.activeElement;
    var tag = active && active.tagName;
    // Only navigate home if focus is not inside an input/textarea/select
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      navigateTo('landing');
    }
  }
});

// showGlobalStatus is defined in utils.js (GW.showStatus) so all modules
// can use it regardless of load order. The window.showGlobalStatus alias
// is set there too — nothing to define here.
