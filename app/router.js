// ==== NAVIGATION ====
var currentPage = 'landing';
var homeValuationInitialized = false;
var pageNames = {
  landing: 'Home',
  social: 'Social Media Builder',
  multifamily: 'Multifamily OM Builder',
  leasing: 'Leasing OM Builder',
  valuation: 'Valuation Tool',
  invoice: 'Invoice Generator',
  'home-valuation': 'Home Valuation Generator',
  'video': 'Video Generator'
};

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  currentPage = page;
  document.getElementById('home-btn').style.display = page === 'landing' ? 'none' : 'block';
  document.getElementById('nav-breadcrumb').textContent = page === 'landing' ? '' : pageNames[page];
  window.scrollTo(0, 0);

  // Initialize modules on first visit
  if (page === 'social' && !socialInitialized) initSocialBuilder();
  if (page === 'valuation' && !valuationInitialized) initValuation();
  if (page === 'leasing' && !leasingInitialized) initLeasing();
  if (page === 'invoice' && !invoiceInitialized) { initInvoice(); invoiceInitialized = true; }
  if (page === 'home-valuation' && !homeValuationInitialized) { initHomeValuation(); homeValuationInitialized = true; }
}

function showGlobalStatus(msg) {
  var s = document.getElementById('global-status');
  s.textContent = msg;
  s.style.display = 'block';
  setTimeout(() => s.style.display = 'none', 3000);
}
