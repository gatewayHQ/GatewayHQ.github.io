// ─────────────────────────────────────────────────────────────────────────────
// GATEWAY OM GENERATOR — assembles all slide modules into a complete .pptx file.
//
// Browser usage (after loading all /pptx/*.js via <script> tags):
//   generateOfferingMemorandum(data, configOverrides)
//
// Node.js usage:
//   const gen = require('./generate-om');
//   gen(data, configOverrides).then(() => console.log('done'));
// ─────────────────────────────────────────────────────────────────────────────

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js — load dependencies
    var PptxGenJS    = require('pptxgenjs');
    var BRAND_CONFIG = require('./brand-config');
    var LAYOUT       = require('./layout-constants');
    var OMUtils      = require('./utils');
    var s01 = require('./slide-modules/01-cover');
    var s02 = require('./slide-modules/02-offering-summary');
    var s03 = require('./slide-modules/03-investment-highlights');
    var s04 = require('./slide-modules/04-property-description');
    var s05 = require('./slide-modules/05-unit-mix');
    var s06 = require('./slide-modules/06-financial-summary');
    var s07 = require('./slide-modules/07-location-overview');
    var s08 = require('./slide-modules/08-market-overview');
    var s09 = require('./slide-modules/09-section-divider');
    var s10 = require('./slide-modules/10-back-cover');
    module.exports = factory(PptxGenJS, BRAND_CONFIG, LAYOUT, OMUtils,
      s01, s02, s03, s04, s05, s06, s07, s08, s09, s10);
  } else {
    // Browser — all deps are globals already loaded via <script> tags
    root.generateOfferingMemorandum = factory(
      root.PptxGenJS, root.BRAND_CONFIG, root.LAYOUT, root.OMUtils,
      root.addCoverSlide,
      root.addOfferingSummarySlide,
      root.addInvestmentHighlightsSlide,
      root.addPropertyDescriptionSlide,
      root.addUnitMixSlide,
      root.addFinancialSummarySlide,
      root.addLocationOverviewSlide,
      root.addMarketOverviewSlide,
      root.addSectionDividerSlide,
      root.addBackCoverSlide
    );
  }
}(typeof window !== 'undefined' ? window : this, function (
  PptxGenJS, BRAND_CONFIG, LAYOUT, OMUtils,
  addCoverSlide, addOfferingSummarySlide, addInvestmentHighlightsSlide,
  addPropertyDescriptionSlide, addUnitMixSlide, addFinancialSummarySlide,
  addLocationOverviewSlide, addMarketOverviewSlide,
  addSectionDividerSlide, addBackCoverSlide
) {

  // ── Merge caller config with brand defaults ──────────────────────────────
  function buildConfig(data, overrides) {
    var cfg = Object.assign({}, BRAND_CONFIG, overrides || {});
    // Inject runtime identity from data
    cfg.propertyName  = cfg.propertyName  || (data.property  && data.property.name)  || '';
    cfg.brokerageName = cfg.brokerageName || (data.brokerage && data.brokerage.name) || 'Gateway Real Estate Advisors';
    cfg.logoUrl       = cfg.logoUrl       || (data.brokerage && data.brokerage.logoUrl)      || null;
    cfg.logoLightUrl  = cfg.logoLightUrl  || (data.brokerage && data.brokerage.logoLightUrl) || null;
    return cfg;
  }

  // ── Main generator ───────────────────────────────────────────────────────
  function generateOfferingMemorandum(data, configOverrides) {
    if (!data || !data.property) {
      console.error('generateOfferingMemorandum: data.property is required');
      return;
    }

    var config = buildConfig(data, configOverrides);
    var L = LAYOUT;

    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'OM_WIDE', width: 13.33, height: 7.5 });
    pptx.layout  = 'OM_WIDE';
    pptx.author  = config.brokerageName;
    pptx.company = config.brokerageName;
    pptx.subject = (config.propertyName || 'Property') + ' — Offering Memorandum';
    pptx.title   = (config.propertyName || 'Property') + ' — Offering Memorandum';

    // ── Slide sequence ───────────────────────────────────────────────────
    addCoverSlide(pptx, data, config, L, OMUtils);

    addOfferingSummarySlide(pptx, data, config, L, OMUtils);

    // Section divider before investment section
    addSectionDividerSlide(pptx, {
      sectionTitle:  'The Opportunity',
      sectionNumber: '01',
      subtitle:      'Investment Highlights & Property Details',
    }, config, L, OMUtils);

    addInvestmentHighlightsSlide(pptx, data, config, L, OMUtils);

    addPropertyDescriptionSlide(pptx, data, config, L, OMUtils);

    addUnitMixSlide(pptx, data, config, L, OMUtils);

    // Section divider before financials
    addSectionDividerSlide(pptx, {
      sectionTitle:  'Financial Analysis',
      sectionNumber: '02',
      subtitle:      'Income, Expenses & Pro Forma Projections',
    }, config, L, OMUtils);

    addFinancialSummarySlide(pptx, data, config, L, OMUtils);

    addLocationOverviewSlide(pptx, data, config, L, OMUtils);

    addMarketOverviewSlide(pptx, data, config, L, OMUtils);

    addBackCoverSlide(pptx, data, config, L, OMUtils);

    // ── Output ──────────────────────────────────────────────────────────
    var fileName = (config.propertyName || 'OM').replace(/[^a-z0-9 \-_]/gi, '_') + ' — Offering Memorandum.pptx';
    return pptx.writeFile({ fileName: fileName });
  }

  return generateOfferingMemorandum;
}));
