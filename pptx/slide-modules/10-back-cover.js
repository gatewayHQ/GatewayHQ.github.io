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

      // Broker photo
      if (broker.photoUrl) {
        var photoOpts = {
          x: card_x, y: PHOTO_Y, w: CARD_W, h: PHOTO_H,
          sizing: { type: 'cover', w: CARD_W, h: PHOTO_H },
        };
        if (broker.photoUrl.startsWith('data:')) { photoOpts.data = broker.photoUrl; }
        else { photoOpts.path = broker.photoUrl; }
        slide.addImage(photoOpts);
      } else {
        // Navy placeholder rect
        slide.addShape('rect', {
          x: card_x, y: PHOTO_Y, w: CARD_W, h: PHOTO_H,
          fill: { color: '162D47' },
          line: { color: '243F63', pt: 0.5 },
        });
        slide.addText('PHOTO', {
          x: card_x, y: PHOTO_Y, w: CARD_W, h: PHOTO_H,
          fontFace: 'Calibri', fontSize: 11,
          color: '2C5080', align: 'center', valign: 'middle',
        });
      }

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
