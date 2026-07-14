// app/video/scene-model.js
// Turns plain listing data + resolved images into the declarative composition
// model the renderer consumes. This is the single source of truth that drives
// both the preview scrubber and the encoder — no HTML strings, no GSAP.

export const FORMATS = {
  reels:     { w: 1080, h: 1920, fps: 30, label: 'Reels / Stories (9:16)' },
  feed:      { w: 1080, h: 1350, fps: 30, label: 'Feed (4:5)' },
  square:    { w: 1080, h: 1080, fps: 30, label: 'Square (1:1)' },
  landscape: { w: 1920, h: 1080, fps: 30, label: 'Landscape (16:9)' },
};

const DUR = { hero: 4.0, photo: 3.2, stats: 3.0, agent: 4.0 };

/**
 * @param {Object} data   { address, price, eyebrow, propertyType,
 *                          beds, baths, sqft,                          // residential
 *                          units, buildingSqft, capRate, noi,          // commercial
 *                          occupancy, pricePerUnit, unitMix,           // commercial
 *                          agent, brokerage, cta, format }
 * @param {Array}  photos [{ image (drawable), caption (string) }] in order.
 *                        First photo is the hero; captions apply to photos 2+.
 * @param {Object} brand  { bg, primary, gray, font, logo (Image|null) }
 * @param {string} anim   animation id ('kenburns' | 'scan' | 'none')
 */
export function buildModel(data, photos, brand, anim = 'kenburns') {
  const fmt = FORMATS[data.format] || FORMATS.reels;
  const scenes = [];

  photos.forEach((ph, i) => {
    if (i === 0) {
      // Hero: badge + address + price as a measured bottom-anchored stack
      // (renderer.drawHeroStack) so a wrapping address never overlaps the badge.
      scenes.push({
        kind: 'photo', image: ph.image, anim, durationSec: DUR.hero,
        heroText: { badge: data.eyebrow || '', address: data.address || '', price: data.price || '' },
        texts: [],
      });
    } else {
      // Caption travels with this photo (entered on the thumbnail).
      const cap = (ph.caption || '').trim();
      scenes.push({
        kind: 'photo', image: ph.image, anim, durationSec: DUR.photo,
        texts: compact([
          cap && { text: cap, x: 0.06, y: 0.9, size: 0.034, weight: 400, delay: 0.7, maxWidth: 0.88 },
        ]),
      });
    }
  });

  // Stats card(s). Columns depend on property type. Commercial listings can
  // carry more stats than fit in one row, so we chunk into cards of up to 3
  // and give the first commercial card a Unit Mix subtitle when provided.
  const commercial = data.propertyType === 'commercial';
  const cols = commercial
    ? compact([
        data.units        && { value: data.units,        label: 'Units' },
        data.buildingSqft && { value: data.buildingSqft, label: 'Building SF' },
        data.capRate      && { value: data.capRate,      label: 'Cap Rate' },
        data.noi          && { value: data.noi,          label: 'NOI' },
        data.occupancy    && { value: data.occupancy,    label: 'Occupancy' },
        data.pricePerUnit && { value: data.pricePerUnit, label: 'Price / Unit' },
      ])
    : compact([
        data.beds  && { value: data.beds,  label: 'Beds' },
        data.baths && { value: data.baths, label: 'Baths' },
        data.sqft  && { value: data.sqft,  label: 'Sq Ft' },
      ]);

  const unitMix = commercial ? (data.unitMix || '').trim() : '';
  chunk(cols, 3).forEach((group, gi) => {
    const texts = (gi === 0 && unitMix)
      ? [{ text: unitMix, x: 0.5, y: 0.64, size: 0.024, weight: 300, align: 'center',
           color: 'rgba(245,245,243,0.75)', delay: 0.6, maxWidth: 0.86 }]
      : [];
    scenes.push({ kind: 'card', durationSec: DUR.stats, columns: group, texts });
  });

  // Agent close. A headshot (if uploaded) takes the top slot; else the logo.
  const headshot = brand.headshot || null;
  scenes.push({
    kind: 'card', durationSec: DUR.agent,
    logo: headshot ? null : (brand.logo || null), logoY: 0.26, logoScale: 0.16,
    headshot, headshotY: 0.27, headshotR: 0.16,
    texts: compact([
      { text: data.cta || 'Schedule a Showing', x: 0.5, y: 0.56, size: 0.044, weight: 200, align: 'center' },
      data.agent     && { text: data.agent,     x: 0.5, y: 0.66, size: 0.030, weight: 300, align: 'center', delay: 0.6 },
      { text: data.brokerage || 'Gateway Real Estate Advisors', x: 0.5, y: 0.72, size: 0.016, weight: 400, letterSpacing: 4, transform: 'upper', align: 'center', color: 'rgba(245,245,243,0.5)', delay: 1.0 },
    ]),
  });

  return {
    width: fmt.w, height: fmt.h, fps: fmt.fps,
    brand: { bg: '#0D1117', font: 'Inter, system-ui, -apple-system, sans-serif', ...brand },
    scenes,
  };
}

function compact(arr) { return arr.filter(Boolean); }
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
