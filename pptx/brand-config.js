// ─────────────────────────────────────────────────────────────────────────────
// BRAND CONFIGURATION — single source of truth.
// Changing values here propagates to every slide in the deck.
// ─────────────────────────────────────────────────────────────────────────────

var BRAND_CONFIG = {
  // ── Core Palette (hex, no '#') ────────────────────────────────────────────
  primaryColor:  '1B3A5C',   // deep navy — primary backgrounds, headers
  accentColor:   'C9A84C',   // warm gold — accents, callouts, borders
  lightBg:       'F7F5F0',   // warm off-white — light slide backgrounds
  darkBg:        '1B3A5C',   // navy — cover, divider, dark slides
  bodyText:      '333333',   // dark charcoal — all body copy
  mutedText:     '888888',   // medium gray — labels, captions, footer
  white:         'FFFFFF',
  tableAlt:      'EDF1F5',   // very light blue-gray — alternating table rows
  tableHeader:   '1B3A5C',   // navy — table header rows
  statBg:        'EEF2F7',   // light blue-gray — stat box backgrounds
  accentLight:   'FBF5E6',   // light gold tint — highlighted stat boxes
  divider:       'DDDDDD',   // light gray — separator lines

  // ── Typography (referenced in layout-constants.js) ────────────────────────
  fontSerif:  'Georgia',
  fontSans:   'Calibri',

  // ── Runtime Identity (injected at call time) ──────────────────────────────
  // logoUrl:       '',       // path or data URI for light-bg slides
  // logoLightUrl:  '',       // white/light logo version for dark slides
  // propertyName:  '',
  // brokerageName: 'Gateway Real Estate Advisors',
  // brokerContact: '',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BRAND_CONFIG;
}
