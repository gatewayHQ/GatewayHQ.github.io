// app/social/design-tokens.js
// The design system that makes graphics look intentional, not homemade:
// a fixed type family, curated themes (users pick a theme, never raw colors),
// an 8pt spacing rhythm, one radius, one shadow. Premium institutional look
// to match Gateway's OM aesthetic.

export const FONT = 'Montserrat, system-ui, -apple-system, sans-serif';

// Weights we vendored as woff2 (assets/fonts/montserrat-*.woff2).
export async function loadFonts(base = '') {
  if (typeof FontFace === 'undefined') return;
  const defs = [
    ['400', base + 'assets/fonts/montserrat-400.woff2'],
    ['600', base + 'assets/fonts/montserrat-600.woff2'],
    ['800', base + 'assets/fonts/montserrat-800.woff2'],
  ];
  await Promise.all(defs.map(async ([weight, url]) => {
    try {
      const ff = new FontFace('Montserrat', `url(${url})`, { weight });
      await ff.load(); document.fonts.add(ff);
    } catch (e) { /* fall back to system font */ }
  }));
}

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
  'slate': {
    label: 'Slate',
    bg1: '#1B2A33', bg2: '#243945',
    ink: '#F5F5F3', sub: 'rgba(245,245,243,0.62)', faint: 'rgba(245,245,243,0.30)',
    accent: '#9BB4C0', accentInk: '#0D1117',
    hairline: 'rgba(155,180,192,0.5)', panel: 'rgba(13,17,23,0.96)',
    onPhoto: '#F5F5F3',
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
  'postcard-6x4':{ w: 1875, h: 1275, label: 'Postcard 6×4 (print, 300dpi)', kind: 'print', dpi: 300, bleed: 37 },
};
