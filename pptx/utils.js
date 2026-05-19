// ─────────────────────────────────────────────────────────────────────────────
// SHARED SLIDE UTILITIES — helpers used across all slide modules.
// Every function accepts (slide, config, L) so modules stay stateless.
// ─────────────────────────────────────────────────────────────────────────────

var OMUtils = (function () {

  // ── Title bar with left gold accent + hairline rule ───────────────────────
  function addSlideTitle(slide, text, config, L) {
    L = L || LAYOUT;
    // Left gold accent bar
    slide.addShape('rect', {
      x: L.M, y: L.TITLE_Y, w: L.ACCENT_BAR_W, h: L.TITLE_H,
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });
    // Title text (inset past the accent bar)
    slide.addText(text.toUpperCase(), {
      x: L.snap(L.M + L.ACCENT_BAR_W + 0.14),
      y: L.TITLE_Y,
      w: L.snap(L.CW - L.ACCENT_BAR_W - 0.14),
      h: L.TITLE_H,
      fontFace: L.TYPE.slideTitle.fontFace,
      fontSize: L.TYPE.slideTitle.fontSize,
      bold: L.TYPE.slideTitle.bold,
      color: config.primaryColor,
      valign: 'middle',
      charSpacing: 1.5,
    });
    // Full-width hairline below title
    slide.addShape('rect', {
      x: L.M, y: L.RULE_Y, w: L.CW, h: L.RULE_H,
      fill: { color: config.divider },
      line: { color: config.divider },
    });
  }

  // ── Footer: separator + logo + property name + page label ─────────────────
  function addFooter(slide, config, L, pageLabel) {
    L = L || LAYOUT;
    // Separator hairline
    slide.addShape('rect', {
      x: L.M, y: L.SEPARATOR_Y, w: L.CW, h: L.RULE_H,
      fill: { color: config.divider },
      line: { color: config.divider },
    });
    // Logo
    if (config.logoUrl) {
      var lc = L.LOGO;
      slide.addImage({
        data: config.logoUrl.startsWith('data:') ? config.logoUrl : undefined,
        path: config.logoUrl.startsWith('data:') ? undefined : config.logoUrl,
        x: lc.x + lc.pad, y: lc.y,
        w: lc.w - lc.pad * 2, h: lc.h,
        sizing: { type: 'contain', w: lc.w - lc.pad * 2, h: lc.h },
      });
    }
    // Property name (centre of footer)
    slide.addText(config.propertyName || '', {
      x: L.snap(L.LOGO.x + L.LOGO.w + 0.20),
      y: L.FOOTER_Y,
      w: L.snap(L.CW * 0.55),
      h: L.FOOTER_H,
      fontFace: L.TYPE.footer.fontFace,
      fontSize: L.TYPE.footer.fontSize,
      color: config.mutedText,
      valign: 'middle',
    });
    // Page label (right side)
    if (pageLabel) {
      slide.addText(pageLabel, {
        x: L.snap(L.M + L.CW * 0.75),
        y: L.FOOTER_Y,
        w: L.snap(L.CW * 0.25),
        h: L.FOOTER_H,
        fontFace: 'Georgia',
        fontSize: 9,
        color: config.accentColor,
        align: 'right',
        valign: 'middle',
      });
    }
  }

  // ── Footer variant for dark slides (white logo + light text) ─────────────
  function addDarkFooter(slide, config, L, pageLabel) {
    L = L || LAYOUT;
    slide.addShape('rect', {
      x: L.M, y: L.SEPARATOR_Y, w: L.CW, h: L.RULE_H,
      fill: { color: '2C5080' },  // subtle lighter navy
      line: { color: '2C5080' },
    });
    if (config.logoLightUrl) {
      var lc = L.LOGO;
      slide.addImage({
        data: config.logoLightUrl.startsWith('data:') ? config.logoLightUrl : undefined,
        path: config.logoLightUrl.startsWith('data:') ? undefined : config.logoLightUrl,
        x: lc.x + lc.pad, y: lc.y,
        w: lc.w - lc.pad * 2, h: lc.h,
        sizing: { type: 'contain', w: lc.w - lc.pad * 2, h: lc.h },
      });
    }
    slide.addText(config.propertyName || '', {
      x: L.snap(L.LOGO.x + L.LOGO.w + 0.20),
      y: L.FOOTER_Y,
      w: L.snap(L.CW * 0.55),
      h: L.FOOTER_H,
      fontFace: L.TYPE.footer.fontFace,
      fontSize: L.TYPE.footer.fontSize,
      color: 'AABBCC',
      valign: 'middle',
    });
    if (pageLabel) {
      slide.addText(pageLabel, {
        x: L.snap(L.M + L.CW * 0.75),
        y: L.FOOTER_Y,
        w: L.snap(L.CW * 0.25),
        h: L.FOOTER_H,
        fontFace: 'Georgia',
        fontSize: 9,
        color: config.accentColor,
        align: 'right',
        valign: 'middle',
      });
    }
  }

  // ── Stat callout box: gold top bar, large number, label ──────────────────
  function addStatBox(slide, x, y, w, h, value, label, config, L, opts) {
    L = L || LAYOUT;
    opts = opts || {};
    var bg = opts.bg || config.statBg;
    var numColor = opts.numColor || config.primaryColor;
    var numSize  = opts.numSize  || 24;
    var border   = opts.border   || config.divider;
    // Background
    slide.addShape('rect', {
      x: x, y: y, w: w, h: h,
      fill: { color: bg },
      line: { color: border, pt: 0.5 },
    });
    // Gold top accent bar
    slide.addShape('rect', {
      x: x, y: y, w: w, h: 0.04,
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });
    // Value (large serif)
    slide.addText(value, {
      x: x + 0.12, y: y + 0.08, w: w - 0.24, h: L.snap(h * 0.58),
      fontFace: 'Georgia', fontSize: numSize, bold: true,
      color: numColor, align: 'center', valign: 'middle',
      shrinkText: true,
    });
    // Label (small sans)
    slide.addText(label.toUpperCase(), {
      x: x + 0.12, y: L.snap(y + h * 0.65), w: w - 0.24, h: L.snap(h * 0.28),
      fontFace: L.TYPE.dataLabel.fontFace, fontSize: L.TYPE.dataLabel.fontSize,
      color: config.mutedText, align: 'center', valign: 'top',
      charSpacing: 0.5,
    });
  }

  // ── Section sub-header (gold text, used inside content zones) ─────────────
  function addSectionHeader(slide, x, y, w, text, config, L) {
    L = L || LAYOUT;
    slide.addText(text.toUpperCase(), {
      x: x, y: y, w: w, h: L.snap(0.32),
      fontFace: L.TYPE.sectionHdr.fontFace,
      fontSize: L.TYPE.sectionHdr.fontSize,
      bold: L.TYPE.sectionHdr.bold,
      color: config.accentColor,
      valign: 'middle',
      charSpacing: 0.5,
    });
    // Thin gold rule below
    slide.addShape('rect', {
      x: x, y: L.snap(y + 0.34), w: w, h: 0.02,
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });
  }

  // ── Safe image (falls back to styled placeholder if url is falsy) ─────────
  function addPhoto(slide, url, x, y, w, h, sizing) {
    if (!url) {
      slide.addShape('rect', {
        x: x, y: y, w: w, h: h,
        fill: { color: 'D8DDE5' },
        line: { color: 'BBBBBB', pt: 0.5 },
      });
      slide.addText('PHOTO', {
        x: x, y: y, w: w, h: h,
        fontFace: 'Calibri', fontSize: 11,
        color: 'AAAAAA', align: 'center', valign: 'middle', italic: true,
      });
      return;
    }
    var imgOpts = { x: x, y: y, w: w, h: h, sizing: { type: sizing || 'cover', w: w, h: h } };
    if (url.startsWith('data:')) { imgOpts.data = url; }
    else { imgOpts.path = url; }
    slide.addImage(imgOpts);
  }

  // ── Map placeholder ───────────────────────────────────────────────────────
  function addMapPlaceholder(slide, url, x, y, w, h, config) {
    if (url) { addPhoto(slide, url, x, y, w, h, 'cover'); return; }
    slide.addShape('rect', {
      x: x, y: y, w: w, h: h,
      fill: { color: 'D0DAE8' },
      line: { color: config.primaryColor, pt: 0.5 },
    });
    slide.addText('MAP', {
      x: x, y: y, w: w, h: h,
      fontFace: 'Calibri', fontSize: 14, bold: true,
      color: config.primaryColor, align: 'center', valign: 'middle',
    });
  }

  // ── Thin gold horizontal rule ─────────────────────────────────────────────
  function addGoldRule(slide, x, y, w, config) {
    slide.addShape('rect', {
      x: x, y: y, w: w, h: 0.04,
      fill: { color: config.accentColor },
      line: { color: config.accentColor },
    });
  }

  // ── Number formatters ─────────────────────────────────────────────────────
  function fmtCurrency(n, compact) {
    if (n === null || n === undefined || n === 0) return '—';
    if (compact !== false) {
      if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    }
    return '$' + Math.round(n).toLocaleString();
  }

  function fmtCurrencyFull(n) {
    if (!n) return '—';
    return '$' + Math.round(n).toLocaleString();
  }

  function fmtPct(n, dec) {
    if (n === null || n === undefined) return '—';
    // Accept either 0.0565 or 5.65 format
    var pctVal = n > 1 ? n : n * 100;
    return pctVal.toFixed(dec !== undefined ? dec : 2) + '%';
  }

  function fmtNum(n, suffix) {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString() + (suffix || '');
  }

  function fmtRent(n) {
    if (!n) return '—';
    return '$' + Math.round(n).toLocaleString() + '/mo';
  }

  function fmtX(n, dec) {
    if (!n) return '—';
    return n.toFixed(dec !== undefined ? dec : 1) + 'x';
  }

  return {
    addSlideTitle,
    addFooter,
    addDarkFooter,
    addStatBox,
    addSectionHeader,
    addPhoto,
    addMapPlaceholder,
    addGoldRule,
    fmtCurrency,
    fmtCurrencyFull,
    fmtPct,
    fmtNum,
    fmtRent,
    fmtX,
  };
}());

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OMUtils;
}
