// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 10 — BACK COVER
// Dark navy with darker left panel, broker cards, and disclaimer.
// ─────────────────────────────────────────────────────────────────────────────

function addBackCoverSlide(pptx, data, config, _L, _U) {
  var L = _L || LAYOUT;
  var U = _U || OMUtils;

  var slide = pptx.addSlide();

  var brokerage = data.brokerage || {};
  var brokers   = brokerage.brokers || [];
  var bio       = brokerage.bio || null;

  // ── 1. Full navy background ───────────────────────────────────────────────
  slide.background = { color: config.primaryColor };

  // ── 2. Gold top + bottom accent bars ──────────────────────────────────────
  slide.addShape('rect', {
    x: 0, y: 0, w: L.W, h: L.snap(0.08),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });
  slide.addShape('rect', {
    x: 0, y: L.snap(L.H - 0.08), w: L.W, h: L.snap(0.08),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // ── 3. Left panel: darker navy ────────────────────────────────────────────
  var LEFT_W = L.snap(5.50);
  slide.addShape('rect', {
    x: 0, y: 0, w: LEFT_W, h: L.H,
    fill: { color: '162D47' },
    line: { type: 'none' },
  });

  // ── 4. Left panel content ─────────────────────────────────────────────────

  // Logo (light version)
  var LOGO_X = L.snap(0.40);
  var LOGO_Y = L.snap(0.60);
  var LOGO_W = L.snap(3.50);
  var LOGO_H = L.snap(0.80);
  if (config.logoLightUrl) {
    var logoImgOpts = {
      x: LOGO_X, y: LOGO_Y, w: LOGO_W, h: LOGO_H,
      sizing: { type: 'contain', w: LOGO_W, h: LOGO_H },
    };
    if (config.logoLightUrl.startsWith('data:')) { logoImgOpts.data = config.logoLightUrl; }
    else { logoImgOpts.path = config.logoLightUrl; }
    slide.addImage(logoImgOpts);
  } else {
    // Fallback: brokerage name as text
    slide.addText((brokerage.name || 'GATEWAY REAL ESTATE ADVISORS').toUpperCase(), {
      x: LOGO_X, y: LOGO_Y, w: LOGO_W, h: LOGO_H,
      fontFace: 'Georgia', fontSize: 16, bold: true,
      color: config.accentColor,
      valign: 'middle',
    });
  }

  // "EXCLUSIVELY OFFERED BY" eyebrow (above brokerage name text zone)
  slide.addText('EXCLUSIVELY OFFERED BY', {
    x: LOGO_X, y: L.snap(1.70), w: L.snap(4.60), h: L.snap(0.26),
    fontFace: 'Calibri', fontSize: 9, bold: false,
    color: config.accentColor,
    valign: 'middle', charSpacing: 2,
  });

  // Gold rule
  slide.addShape('rect', {
    x: LOGO_X, y: L.snap(1.60), w: L.snap(4.60), h: L.snap(0.04),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // Brokerage name
  slide.addText(brokerage.name || 'Gateway Real Estate Advisors', {
    x: LOGO_X, y: L.snap(1.75), w: L.snap(4.60), h: L.snap(0.50),
    fontFace: 'Calibri', fontSize: 18, bold: true,
    color: config.white,
    valign: 'middle',
  });

  // ── 4b. Gateway Bio — fills the previously-empty square between the
  //         brokerage name (y≈2.25) and the disclaimer (y≈6.00).
  var BIO_X      = LOGO_X;
  var BIO_W      = L.snap(4.60);
  var BIO_Y      = L.snap(2.45);
  var BIO_END_Y  = L.snap(5.85);

  // Ambient border-only card so the bio reads as a distinct block on the
  // darker navy panel (matches the "square" in the user's back-cover mock-up).
  slide.addShape('rect', {
    x: BIO_X, y: BIO_Y, w: BIO_W, h: L.snap(BIO_END_Y - BIO_Y),
    fill: { color: '162D47' },
    line: { color: '2C4A6C', pt: 0.75 },
  });

  // Eyebrow — "GATEWAY BIO"
  slide.addText((bio && bio.tagline) || 'GATEWAY BIO', {
    x: L.snap(BIO_X + 0.16), y: L.snap(BIO_Y + 0.16),
    w: L.snap(BIO_W - 0.32), h: L.snap(0.24),
    fontFace: 'Calibri', fontSize: 9, bold: true,
    color: config.accentColor,
    valign: 'middle', charSpacing: 2,
  });

  // Heading — "Who We Are"
  slide.addText((bio && bio.heading) || 'Who We Are', {
    x: L.snap(BIO_X + 0.16), y: L.snap(BIO_Y + 0.42),
    w: L.snap(BIO_W - 0.32), h: L.snap(0.34),
    fontFace: 'Georgia', fontSize: 15, bold: true,
    color: config.white,
    valign: 'middle',
  });

  // Thin gold divider under the heading
  slide.addShape('rect', {
    x: L.snap(BIO_X + 0.16), y: L.snap(BIO_Y + 0.80),
    w: L.snap(0.60), h: 0.03,
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // Body paragraphs — sized to fill the remaining card height above stats.
  var STATS_H = (bio && bio.stats && bio.stats.length) ? L.snap(0.70) : 0;
  var BIO_TEXT_Y = L.snap(BIO_Y + 0.95);
  var BIO_TEXT_H = L.snap(BIO_END_Y - BIO_TEXT_Y - STATS_H - 0.15);

  var bioPara1 = (bio && bio.para1) || 'Gateway Real Estate Advisors is a boutique commercial real estate brokerage specializing in investment sales across the Midwest.';
  var bioPara2 = (bio && bio.para2) || 'Our team combines deep local market knowledge with institutional-grade analysis to deliver superior results for our clients.';

  // Hard cap the combined length so the two paragraphs can never spill into
  // the stat strip below, even at 10pt with a 1.30 line-height on a
  // ~4-inch wide card.  ~360 chars ≈ 8 lines of body copy inside the card.
  var BIO_CHAR_LIMIT = 360;
  function _clampBio(a, b, limit) {
    var aLen = (a || '').length;
    var bLen = (b || '').length;
    var total = aLen + bLen;
    if (total <= limit) return [a, b];
    // Trim the longer paragraph first, keep the other intact when possible.
    if (aLen >= bLen) {
      var newALen = Math.max(0, limit - bLen);
      return [ (a || '').slice(0, Math.max(0, newALen - 1)).replace(/\s+\S*$/, '') + '…', b ];
    } else {
      var newBLen = Math.max(0, limit - aLen);
      return [ a, (b || '').slice(0, Math.max(0, newBLen - 1)).replace(/\s+\S*$/, '') + '…' ];
    }
  }
  var _clamped = _clampBio(bioPara1, bioPara2, BIO_CHAR_LIMIT);
  bioPara1 = _clamped[0];
  bioPara2 = _clamped[1];

  slide.addText([
    { text: bioPara1, options: { color: 'D8E1EC', bold: false, breakLine: true } },
    { text: ' ',      options: { color: 'D8E1EC', breakLine: true, fontSize: 5 } },
    { text: bioPara2, options: { color: 'B0C0D0', bold: false } },
  ], {
    x: L.snap(BIO_X + 0.16), y: BIO_TEXT_Y,
    w: L.snap(BIO_W - 0.32), h: BIO_TEXT_H,
    fontFace: 'Calibri', fontSize: 10,
    valign: 'top',
    lineSpacingMultiple: 1.30,
    wrap: true,
    shrinkText: true,
  });

  // Compact 3-stat strip at the bottom of the bio card (only when populated).
  if (bio && bio.stats && bio.stats.length) {
    var STATS_Y = L.snap(BIO_END_Y - STATS_H - 0.06);
    var statW   = L.snap((BIO_W - 0.32) / Math.max(bio.stats.length, 1));
    bio.stats.slice(0, 3).forEach(function (s, i) {
      var sx = L.snap(BIO_X + 0.16 + i * statW);
      slide.addText(s.value || '—', {
        x: sx, y: STATS_Y,
        w: statW, h: L.snap(0.36),
        fontFace: 'Georgia', fontSize: 14, bold: true,
        color: config.accentColor,
        align: 'center', valign: 'bottom',
      });
      slide.addText((s.label || '').toUpperCase(), {
        x: sx, y: L.snap(STATS_Y + 0.38),
        w: statW, h: L.snap(0.24),
        fontFace: 'Calibri', fontSize: 8, bold: false,
        color: '8AA3BC',
        align: 'center', valign: 'top', charSpacing: 1,
      });
    });
  }

  // Disclaimer text
  var disclaimer = brokerage.disclaimer ||
    'This Confidential Offering Memorandum ("Memorandum") is intended solely for the use of ' +
    'prospective purchasers. The information contained herein has been obtained from sources ' +
    'deemed reliable, but no representations or warranties, express or implied, are made as to ' +
    'accuracy or completeness. All projections are provided for general reference only and do not ' +
    'constitute any representation or warranty.';

  slide.addText(disclaimer, {
    x: LOGO_X, y: L.snap(6.00), w: L.snap(4.60), h: L.snap(1.15),
    fontFace: 'Calibri', fontSize: 9, bold: false,
    color: '7A93AA',
    valign: 'top',
    lineSpacingMultiple: 1.40,
    wrap: true,
  });

  // ── 5. Right content area ─────────────────────────────────────────────────
  var RC_X = L.snap(5.75);
  var RC_W = L.snap(7.38);  // 13.33 - 5.75 = 7.58, use 7.38 for inner margin

  // "CONTACT" section header
  slide.addText('CONTACT', {
    x: RC_X, y: L.snap(0.70), w: RC_W, h: L.snap(0.36),
    fontFace: 'Calibri', fontSize: 18, bold: true,
    color: config.accentColor,
    valign: 'middle', charSpacing: 2,
  });

  // Gold rule under CONTACT
  slide.addShape('rect', {
    x: RC_X, y: L.snap(1.10), w: RC_W, h: L.snap(0.04),
    fill: { color: config.accentColor },
    line: { color: config.accentColor },
  });

  // ── 6. Broker cards ───────────────────────────────────────────────────────
  var PHOTO_Y   = L.snap(1.30);
  var PHOTO_H   = L.snap(1.80);
  var CARD_W    = L.snap(3.44);

  if (brokers.length === 0) {
    // No brokers: centered placeholder
    slide.addText((brokerage.name || 'GATEWAY REAL ESTATE ADVISORS').toUpperCase(), {
      x: RC_X, y: L.snap(2.50), w: RC_W, h: L.snap(0.80),
      fontFace: 'Georgia', fontSize: 22, bold: true,
      color: config.white,
      align: 'center', valign: 'middle',
      charSpacing: 1.0,
    });
    slide.addText('YOUR TRUSTED REAL ESTATE PARTNER', {
      x: RC_X, y: L.snap(3.50), w: RC_W, h: L.snap(0.40),
      fontFace: 'Calibri', fontSize: 14, bold: false,
      color: config.accentColor,
      align: 'center', valign: 'middle',
      charSpacing: 1.5,
    });
  } else {
    // Up to 2 brokers side by side
    var brokerCount = Math.min(brokers.length, 2);
    var CARD_GAP    = L.snap(0.25);

    // Compute card start x based on count (center in right area)
    var totalCardsW = brokerCount * CARD_W + (brokerCount - 1) * CARD_GAP;
    var cardsStartX = brokerCount === 1
      ? L.snap(RC_X + (RC_W - CARD_W) / 2)
      : RC_X;

    for (var bi = 0; bi < brokerCount; bi++) {
      var broker = brokers[bi];
      var card_x = L.snap(cardsStartX + bi * (CARD_W + CARD_GAP));

      // Broker photo — routed through addPhoto for validation + consistent sizing
      U.addPhoto(slide, broker.photoUrl || null,
        card_x, PHOTO_Y, CARD_W, PHOTO_H, 'cover');

      // Thin gold bar below photo
      slide.addShape('rect', {
        x: card_x, y: L.snap(PHOTO_Y + PHOTO_H), w: CARD_W, h: L.snap(0.04),
        fill: { color: config.accentColor },
        line: { color: config.accentColor },
      });

      // Name
      var nameY = L.snap(PHOTO_Y + PHOTO_H + 0.12);
      slide.addText(broker.name || '', {
        x: card_x, y: nameY, w: CARD_W, h: L.snap(0.40),
        fontFace: 'Calibri', fontSize: 18, bold: true,
        color: config.white,
        valign: 'middle',
        shrinkText: true,
      });

      // Title
      slide.addText(broker.title || '', {
        x: card_x, y: L.snap(nameY + 0.40), w: CARD_W, h: L.snap(0.30),
        fontFace: 'Calibri', fontSize: 11, bold: false,
        color: config.accentColor,
        valign: 'middle',
      });

      // Phone (with phone glyph prefix)
      if (broker.phone) {
        slide.addText('✆  ' + broker.phone, {
          x: card_x, y: L.snap(nameY + 0.75), w: CARD_W, h: L.snap(0.36),
          fontFace: 'Georgia', fontSize: 13, bold: false,
          color: config.white,
          valign: 'middle',
        });
      }

      // Email
      if (broker.email) {
        slide.addText(broker.email, {
          x: card_x, y: L.snap(nameY + 1.12), w: CARD_W, h: L.snap(0.30),
          fontFace: 'Calibri', fontSize: 11, bold: false,
          color: '7AADCC',
          valign: 'middle',
        });
      }
    }
  }

  return slide;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = addBackCoverSlide;
}
