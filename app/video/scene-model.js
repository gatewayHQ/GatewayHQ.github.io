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
 * @param {Object} data   { address, price, beds, baths, sqft, eyebrow,
 *                          agent, brokerage, cta, features:[], format }
 * @param {Array}  images resolved drawables (ImageBitmap/HTMLImageElement) in order
 * @param {Object} brand  { bg, primary, gray, font, logo (Image|null) }
 * @param {string} anim   animation id ('kenburns' default)
 */
export function buildModel(data, images, brand, anim = 'kenburns') {
  const fmt = FORMATS[data.format] || FORMATS.reels;
  const scenes = [];
  const feats = (data.features || []).filter(Boolean);

  images.forEach((img, i) => {
    if (i === 0) {
      // Hero: eyebrow + address + price stacked bottom-left.
      scenes.push({
        kind: 'photo', image: img, anim, durationSec: DUR.hero,
        texts: compact([
          data.eyebrow && { text: data.eyebrow, x: 0.06, y: 0.74, size: 0.018, weight: 600, letterSpacing: 4, transform: 'upper', color: 'rgba(245,245,243,0.7)', delay: 0.6 },
          data.address && { text: data.address, x: 0.06, y: 0.82, size: 0.052, weight: 300, delay: 0.9, maxWidth: 0.88 },
          data.price   && { text: data.price,   x: 0.06, y: 0.90, size: 0.040, weight: 200, delay: 1.4, color: '#F5F5F3' },
        ]),
      });
    } else {
      const cap = feats[i - 1];
      scenes.push({
        kind: 'photo', image: img, anim, durationSec: DUR.photo,
        texts: compact([
          cap && { text: cap.split(/[—–-]/)[0].trim(), x: 0.06, y: 0.9, size: 0.034, weight: 400, delay: 0.7 },
        ]),
      });
    }
  });

  // Stats card (only if we have at least one stat).
  const cols = compact([
    data.beds  && { value: data.beds,  label: 'Beds' },
    data.baths && { value: data.baths, label: 'Baths' },
    data.sqft  && { value: data.sqft,  label: 'Sq Ft' },
  ]);
  if (cols.length) scenes.push({ kind: 'card', durationSec: DUR.stats, columns: cols, texts: [] });

  // Agent close.
  scenes.push({
    kind: 'card', durationSec: DUR.agent, logo: brand.logo || null, logoY: 0.26, logoScale: 0.16,
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
