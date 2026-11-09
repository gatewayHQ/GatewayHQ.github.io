// app/social/design-tokens.js
// The design system that makes graphics look intentional, not homemade:
// a fixed type family, curated themes (users pick a theme, never raw colors),
// an 8pt spacing rhythm, one radius, one shadow. Premium institutional look
// to match Gateway's OM aesthetic.

export const FONT = 'Montserrat, system-ui, -apple-system, sans-serif';

// Weights we vendored as woff2 (assets/fonts/montserrat-*.woff2): 400/600/700/800.
// Same Google Fonts static latin files the site CSS loads, so canvas exports match.
export async function loadFonts(base = '') {
  if (typeof FontFace === 'undefined') return;
  const defs = [
    ['400', base + 'assets/fonts/montserrat-400.woff2'],
    ['600', base + 'assets/fonts/montserrat-600.woff2'],
    ['700', base + 'assets/fonts/montserrat-700.woff2'],
    ['800', base + 'assets/fonts/montserrat-800.woff2'],
  ];
  await Promise.all(defs.map(async ([weight, url]) => {
    try {
      const ff = new FontFace('Montserrat', `url(${url})`, { weight });
      await ff.load(); document.fonts.add(ff);
    } catch (e) { /* fall back to system font */ }
  }));
}

// Official Gateway colors — keep in sync with brand/brand.json (single source
// for the brand package). Themes reference these instead of raw hex.
export const BRAND = {
  background: '#1E2F39',      // navy
  backgroundDark: '#152229',  // dark navy
  accent: '#C8A84B',          // gold
  textPrimary: '#FFFFFF',
  textSecondary: '#E4E3D4',   // cream
  textMuted: '#A2B6C0',       // steel blue
};

// Curated themes. Each is a complete, tested palette — agents pick one.
export const THEMES = {
  'luxe-dark': {
    label: 'Luxe Dark',
    bg1: '#0D1117', bg2: '#15212B',
    ink: '#F5F5F3', sub: 'rgba(245,245,243,0.62)', faint: 'rgba(245,245,243,0.30)',
    accent: '#C8A84B', accentInk: '#0D1117',
    hairline: 'rgba(200,168,75,0.45)', panel: 'rgba(13,17,23,0.96)',
    onPhoto: '#F5F5F3',
  },
  // Slate = the official Gateway palette (brand/brand.json), exact hex values.
  'slate': {
    label: 'Slate',
    bg1: BRAND.backgroundDark, bg2: BRAND.background,
    ink: BRAND.textPrimary, sub: BRAND.textSecondary, faint: BRAND.textMuted,
    accent: BRAND.textMuted, accentInk: BRAND.backgroundDark,
    hairline: 'rgba(162,182,192,0.5)',            // brand blue #A2B6C0 at 50%
    panel: 'rgba(21,34,41,0.96)',                 // brand dark navy #152229
    onPhoto: BRAND.textPrimary,
  },
  'ivory': {
    label: 'Ivory',
    bg1: '#F5F4EF', bg2: '#E8E6DC',
    ink: '#16202A', sub: 'rgba(22,32,42,0.6)', faint: 'rgba(22,32,42,0.3)',
    accent: '#16202A', accentInk: '#F5F4EF',
    hairline: 'rgba(22,32,42,0.25)', panel: 'rgba(245,244,239,0.97)',
    onPhoto: '#FFFFFF',
  },
};

export const THEME_ORDER = ['luxe-dark', 'slate', 'ivory'];

// Output sizes. w/h in px; print sizes are 300 DPI with bleed baked in.
export const SIZES = {
  'ig-portrait': { w: 1080, h: 1350, label: 'Instagram (4:5)', kind: 'social' },
  'square':      { w: 1080, h: 1080, label: 'Square — FB/IG/LinkedIn', kind: 'social' },
  'story':       { w: 1080, h: 1920, label: 'Story / Reel (9:16)', kind: 'social' },
  'linkedin':    { w: 1200, h: 1200, label: 'LinkedIn', kind: 'social' },
  'landscape':   { w: 1200, h: 628,  label: 'Facebook / LinkedIn feed (1200×628)', kind: 'social' },
  'postcard-6x4':{ w: 1875, h: 1275, label: 'Postcard 6×4 (print, 300dpi)', kind: 'print', dpi: 300, bleed: 37 },
};
