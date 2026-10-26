function(instance, properties) {
  // ---- font from the Bubble editor (shared by update and preview) ---------
  var SDD_SYS = /^(arial|helvetica|times|georgia|verdana|tahoma|trebuchet|courier|system-ui|sans-serif|serif|monospace|segoe|-apple)/i;
  function sddLoadFont(name) {
    try {
      if (!name || name.indexOf(',') !== -1 || !/^[A-Za-z0-9 ]+$/.test(name) || SDD_SYS.test(name)) return;
      var id = 'sdd-font-' + name.toLowerCase().replace(/\s+/g, '-');
      if (document.getElementById(id)) return;
      var l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@300;400;500;600;700&display=swap';
      document.head.appendChild(l);
    } catch (e) {}
  }
  // family, size, colour, weight, style and alignment of the element style;
  // every property is read on its own, so one failing never drops the others
  function sddFontInfo(properties, host) {
    var b = null;
    try { b = properties.bubble; } catch (e) {}
    function get(n) {
      var v = null;
      try { if (b && typeof b[n] === 'function') v = b[n](); } catch (e) {}
      if (v == null || v === '') {
        try { var q = properties[n]; v = (typeof q === 'function') ? q() : q; } catch (e) {}
      }
      return v;
    }
    var ff = get('font_face'), fs = parseFloat(get('font_size')), family = null, weight = null, base = '';
    if (ff != null && String(ff).trim() !== '') {
      var seg = String(ff).split('::').filter(function (s) { return s.trim() !== ''; })[0] || '';
      var m = seg.match(/^(.*?):(\d{3})/);
      if (m) { seg = m[1]; weight = m[2]; } else seg = seg.split(':')[0];
      base = seg.trim().replace(/["']/g, '');
      if (base) family = (base.indexOf(',') !== -1) ? base : '"' + base + '", system-ui, sans-serif';
    }
    if (!family && host) {
      try { if (/^"?times/i.test(window.getComputedStyle(host).fontFamily)) family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; } catch (e) {}
    }
    var al = get('alignment'), col = get('font_color');
    if (base && properties.load_google_font !== false) sddLoadFont(base.indexOf(',') === -1 ? base : '');
    return {
      family: family, size: isFinite(fs) ? fs + 'px' : null,
      color: (col == null || String(col).trim() === '' || String(col).toLowerCase() === 'none') ? null : String(col),
      weight: get('bold') === true ? '700' : weight, style: get('italic') === true ? 'italic' : null,
      decoration: get('underline') === true ? 'underline' : null,
      align: (al === 'left' || al === 'center' || al === 'right') ? al : null
    };
  }
  var host = instance.canvas[0] ? instance.canvas[0].parentElement : null;
  var ph = (properties && properties.placeholder) ? properties.placeholder : 'Selecione uma opção…';
  var phColor = 'rgba(148,163,184,1)';
  try { var pc = properties.placeholder_color; if (pc && String(pc).toLowerCase() !== 'none') phColor = pc; } catch (e) {}
  var info = sddFontInfo(properties, host);
  var wrap = $('<div></div>').css({
    display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
    padding: '0 12px', 'box-sizing': 'border-box', overflow: 'hidden',
    'font-family': info.family || 'inherit', 'font-size': info.size || 'inherit',
    'font-weight': info.weight || 'inherit', 'font-style': info.style || 'inherit', color: phColor
  });
  var label = $('<span></span>').css({
    overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap', 'text-align': 'left'
  }).text(ph);
  var arrow = $('<span aria-hidden="true"></span>').css({
    display: 'inline-flex', 'margin-left': '8px', color: '#64748b', flex: '0 0 auto'
  }).html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>');
  wrap.append(label, arrow);
  // The editor's canvas does not always stretch to the element, so the content
  // is pinned to the element's box (inside its padding), vertically centred and
  // left aligned, whatever height the canvas has.
  var box = host;
  if (box && box.clientHeight < 2 && box.parentElement) box = box.parentElement;
  instance.canvas.empty().css({ width: '100%', display: 'flex', 'align-items': 'center' }).append(wrap);
  if (box) {
    try {
      var cs = window.getComputedStyle(box);
      if (cs.position === 'static') box.style.position = 'relative';
      wrap.css({ position: 'absolute', top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft });
    } catch (e) { wrap.css({ width: '100%', height: '100%' }); }
  } else {
    wrap.css({ width: '100%', height: '100%' });
  }
}
