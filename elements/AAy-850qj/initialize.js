function(instance, context) {
  instance.data = instance.data || {};
  var d = instance.data;
  if (d.ready) return;

  d.ns = 'sdd_' + Math.random().toString(36).slice(2, 10);

  // runtime state (properties are re-applied on every update)
  d.items = [];
  d.byId = {};
  d.selectedIds = [];
  d.multiple = false;
  d.grouping = false;
  d.disabled = false;
  d.touched = false;          // becomes true after the first user interaction
  d.query = '';
  d.isOpen = false;
  d.anim = 'fade';
  d.animDur = 250;
  d.direction = 'auto';
  d.maxEntries = 10;
  d.placeholderText = '';
  d.noResultsText = 'Nenhum resultado encontrado';

  // ---- colour utilities --------------------------------------------------
  // Bubble colour fields can come back as '', 'none' or a fully transparent
  // rgba(). Handing those straight to CSS makes the whole declaration invalid
  // (and CSS does NOT fall back to an earlier declaration), which is why the
  // selected/chip colours could silently disappear. Everything is parsed and
  // recomputed here so the stylesheet only ever receives concrete rgb()/rgba().
  var WHITE = { r: 255, g: 255, b: 255, a: 1 };
  var BLACK = { r: 0, g: 0, b: 0, a: 1 };

  var C = d.colors = {
    clamp: function(n) { n = Math.round(n); return n < 0 ? 0 : (n > 255 ? 255 : n); },

    parse: function(v) {
      if (v == null) return null;
      var s = String(v).trim().toLowerCase();
      if (!s || s === 'none' || s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'unset') return null;
      var m = s.match(/^#([0-9a-f]{3,8})$/);
      if (m) {
        var h = m[1];
        if (h.length === 3 || h.length === 4) h = h.split('').map(function(c) { return c + c; }).join('');
        if (h.length !== 6 && h.length !== 8) return null;
        return {
          r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
          a: (h.length === 8) ? parseInt(h.slice(6, 8), 16) / 255 : 1
        };
      }
      m = s.match(/^rgba?\(([^)]+)\)$/);
      if (!m) return null;
      var p = m[1].split(/[,\s\/]+/).filter(function(x) { return x !== ''; });
      if (p.length < 3) return null;
      var chan = function(x) { return (String(x).indexOf('%') !== -1) ? parseFloat(x) * 2.55 : parseFloat(x); };
      var c = { r: chan(p[0]), g: chan(p[1]), b: chan(p[2]), a: (p.length > 3) ? parseFloat(p[3]) : 1 };
      if (isNaN(c.r) || isNaN(c.g) || isNaN(c.b)) return null;
      if (isNaN(c.a)) c.a = 1;
      return c;
    },

    // a usable colour: anything missing or fully transparent falls back
    solid: function(v, fallback) {
      var c = C.parse(v);
      if (!c || c.a === 0) c = C.parse(fallback) || BLACK;
      return { r: C.clamp(c.r), g: C.clamp(c.g), b: C.clamp(c.b), a: 1 };
    },

    css: function(c, alpha) {
      var a = (alpha == null) ? c.a : alpha;
      return (a >= 1)
        ? 'rgb(' + C.clamp(c.r) + ',' + C.clamp(c.g) + ',' + C.clamp(c.b) + ')'
        : 'rgba(' + C.clamp(c.r) + ',' + C.clamp(c.g) + ',' + C.clamp(c.b) + ',' + (Math.round(a * 1000) / 1000) + ')';
    },

    // ratio = how much of b is blended into a
    mix: function(a, b, ratio) {
      return {
        r: C.clamp(a.r + (b.r - a.r) * ratio),
        g: C.clamp(a.g + (b.g - a.g) * ratio),
        b: C.clamp(a.b + (b.b - a.b) * ratio),
        a: 1
      };
    },

    luminance: function(c) {
      var f = function(v) { v = v / 255; return (v <= 0.03928) ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    },

    isDark: function(c) { return C.luminance(c) < 0.45; },

    contrast: function(a, b) {
      var la = C.luminance(a), lb = C.luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    },

    // nudges fg toward white/black until it is legible over bg
    readable: function(fg, bg, target) {
      var toward = C.isDark(bg) ? WHITE : BLACK;
      var c = fg;
      for (var i = 0; i < 24 && C.contrast(c, bg) < (target || 4.5); i++) c = C.mix(c, toward, 0.05);
      return c;
    }
  };

  // ---- theme: Bubble colour fields -> concrete CSS variables -------------
  // Every value is derived from the actual surface it sits on, so the popup
  // stays legible whether the app uses a light or a dark palette.
  d.applyTheme = function(o) {
    o = o || {};
    var popBg   = C.solid(o.popupBackground, '#ffffff');
    var accent  = C.solid(o.accent, '#6366f1');
    var optText = C.solid(o.optionColor, C.isDark(popBg) ? '#e8ecf4' : '#1e293b');
    var hover   = C.solid(o.hoverColor, optText);
    var uiText  = C.solid(o.controlColor, '#1e293b'); // element font colour
    var darkPop = C.isDark(popBg);
    var darkCtl = !C.isDark(uiText);                  // light text => dark element background

    // selected row: explicit override, otherwise an accent tint of the surface
    var selBg = C.parse(o.selectedBackground);
    selBg = (selBg && selBg.a !== 0) ? C.solid(o.selectedBackground, '#ffffff')
                                     : C.mix(popBg, accent, darkPop ? 0.30 : 0.13);
    var selText = C.parse(o.selectedColor);
    selText = (selText && selText.a !== 0) ? C.solid(o.selectedColor, '#000000')
                                           : C.readable(accent, selBg, 4.5);

    // search input: each part falls back to something derived from the surface
    var sBg = C.parse(o.searchBackground);
    sBg = (sBg && sBg.a !== 0) ? C.solid(o.searchBackground, '#f8fafc') : C.mix(popBg, darkPop ? WHITE : BLACK, 0.05);
    var sBorder = C.parse(o.searchBorder);
    sBorder = (sBorder && sBorder.a !== 0) ? C.solid(o.searchBorder, '#e2e8f0') : C.mix(popBg, optText, 0.18);
    var sText = C.parse(o.searchColor);
    sText = (sText && sText.a !== 0) ? C.solid(o.searchColor, '#0f172a') : optText;
    var sPh = C.parse(o.searchPlaceholder);
    sPh = (sPh && sPh.a !== 0) ? C.solid(o.searchPlaceholder, '#94a3b8') : C.mix(popBg, optText, 0.55);

    var phC = C.parse(o.placeholderColor);
    var num = function(v, dflt) { v = parseFloat(v); return (isNaN(v) || v < 0) ? dflt : v; };

    var vars = {
      '--sdd-accent':      C.css(accent),
      '--sdd-ring':        C.css(accent, 0.22),
      '--sdd-pop-bg':      C.css(popBg),
      '--sdd-pop-border':  C.css(optText, darkPop ? 0.18 : 0.10),
      '--sdd-opt-color':   C.css(optText),
      '--sdd-muted':       C.css(optText, 0.58),
      '--sdd-scroll':      C.css(optText, 0.22),
      '--sdd-hover-bg':    C.css(C.mix(popBg, hover, darkPop ? 0.16 : 0.10)),
      '--sdd-sel-bg':      C.css(selBg),
      '--sdd-sel-bg-hover': C.css(C.mix(selBg, accent, 0.14)),
      '--sdd-sel-color':   C.css(selText),
      '--sdd-sel-ring':    C.css(accent, 0.22),
      '--sdd-check-border': C.css(optText, 0.35),
      '--sdd-check-mark':  C.css(C.readable(WHITE, accent, 3) ),
      // chips sit on the element background (unknown), so they use
      // translucent accent + accent text tuned to the element's font colour
      '--sdd-chip-bg':     C.css(accent, darkCtl ? 0.26 : 0.14),
      '--sdd-chip-border': C.css(accent, darkCtl ? 0.45 : 0.28),
      '--sdd-chip-color':  C.css(darkCtl ? C.mix(accent, WHITE, 0.55) : C.readable(accent, WHITE, 4)),
      '--sdd-neutral-bg':  C.css(uiText, 0.14),
      '--sdd-neutral-color': C.css(uiText, 0.78),
      '--sdd-ctl-muted':   C.css(uiText, 0.55),
      '--sdd-ctl-strong':  C.css(uiText, 0.9),
      '--sdd-ph':          (phC && phC.a !== 0) ? C.css(phC) : C.css(uiText, 0.55),
      '--sdd-s-bg':        C.css(sBg),
      '--sdd-s-border':    C.css(sBorder),
      '--sdd-s-color':     C.css(sText),
      '--sdd-s-ph':        C.css(sPh),
      '--sdd-s-h':         num(o.searchHeight, 38) + 'px',
      '--sdd-s-r':         num(o.searchRadius, 10) + 'px',
      '--sdd-opt-pv':      num(o.optionPadding, 9) + 'px'
    };

    [d.$root[0], d.$popup[0]].forEach(function(el) {
      Object.keys(vars).forEach(function(k) { el.style.setProperty(k, vars[k]); });
    });
  };

  var chevron = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var closeX  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var searchIco = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  var checkIco = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  // ---- control (inside the element) -------------------------------------
  instance.canvas.addClass('sdd-host');
  var root = $('<div class="sdd-root"></div>');
  var control = $('<div class="sdd-control" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false"></div>');
  var valueWrap = $('<div class="sdd-value-wrap"></div>');
  var placeholderEl = $('<span class="sdd-placeholder"></span>');
  var singleValue = $('<span class="sdd-single-value" style="display:none;"></span>');
  var tags = $('<div class="sdd-tags" style="display:none;"></div>');
  var clearBtn = $('<button type="button" class="sdd-clear" aria-label="Limpar seleção">' + closeX + '</button>');
  var arrow = $('<span class="sdd-arrow" aria-hidden="true">' + chevron + '</span>');
  valueWrap.append(placeholderEl, singleValue, tags);
  control.append(valueWrap, clearBtn, arrow);
  root.append(control);
  instance.canvas.empty().append(root);

  // ---- popup (appended to body so no container ever clips it) -----------
  var popup = $('<div class="sdd-popup" role="dialog" aria-modal="false"></div>').attr('data-sdd', d.ns);
  var searchWrap = $('<div class="sdd-search-wrap"><div class="sdd-search-box"><span class="sdd-search-icon">' + searchIco + '</span></div></div>');
  var searchInput = $('<input class="sdd-search" type="text" autocomplete="off" spellcheck="false" />');
  searchWrap.find('.sdd-search-box').append(searchInput);
  var list = $('<div class="sdd-list" role="listbox"></div>');
  popup.append(searchWrap, list).appendTo(document.body);

  d.$root = root; d.$control = control; d.$placeholder = placeholderEl;
  d.$single = singleValue; d.$tags = tags; d.$clear = clearBtn;
  d.$popup = popup; d.$search = searchInput; d.$list = list;

  // ---- caption / group helpers ------------------------------------------
  // NOTE: never wrap e.get() in try/catch here — Bubble uses a special
  // exception to defer the update until the data is loaded.
  d.createCaption = function(properties, e) {
    if (properties.dynamic_caption_field) {
      return String(properties.dynamic_caption_field).replace(/\[([^\]]+)\]/g, function(_, key) {
        key = key.trim();
        if (key.indexOf('->') !== -1) {
          var parts = key.split('->');
          var sub = e.get(parts[0].trim());
          var v2 = (sub && typeof sub.get === 'function') ? sub.get(parts[1].trim()) : null;
          return v2 == null ? '' : String(v2);
        }
        var v = e.get(key);
        return v == null ? '' : String(v);
      });
    }
    var main = properties.caption_field ? e.get(properties.caption_field) : null;
    if (main == null) main = '';
    if (properties.secondary_caption_field) {
      var sec = e.get(properties.secondary_caption_field);
      if (sec != null && sec !== '') return String(main) + (properties.separator != null ? properties.separator : ' ') + String(sec);
    }
    return String(main);
  };

  d.groupLabel = function(e, field) {
    var gv = e.get(field);
    if (gv == null || gv === '') return 'Outros';
    if (typeof gv.get === 'function') {
      var p = (typeof gv.listProperties === 'function') ? gv.listProperties() : [];
      if (p.indexOf('display') !== -1) return String(gv.get('display'));
      if (p.indexOf('_id') !== -1) return String(gv.get('_id'));
      return 'Outros';
    }
    if (gv instanceof Date) return gv.toLocaleDateString();
    return String(gv);
  };

  // ---- selection --------------------------------------------------------
  d.getSelection = function() {
    return d.selectedIds.map(function(id) { return d.byId[id]; }).filter(Boolean);
  };

  d.publishSelection = function(fireEvent) {
    var sel = d.getSelection();
    instance.publishState('selected', sel.length ? sel[sel.length - 1].original : null);
    instance.publishState('selected_list', sel.map(function(s) { return s.original; }));
    if (fireEvent) instance.triggerEvent('searchbox_value_is_changed');
  };

  d.toggleItem = function(id) {
    if (d.disabled) return;
    d.touched = true;
    var idx = d.selectedIds.indexOf(id);
    if (d.multiple) {
      if (idx === -1) d.selectedIds.push(id); else d.selectedIds.splice(idx, 1);
    } else {
      d.selectedIds = [id];
    }
    d.renderControl();
    d.renderList();
    d.publishSelection(true);
    if (!d.multiple) d.closePopup();
  };

  d.clearSelection = function(fireEvent) {
    d.touched = true;
    d.selectedIds = [];
    d.renderControl();
    d.renderList();
    d.publishSelection(!!fireEvent);
  };

  // ---- control rendering ------------------------------------------------
  d.renderControl = function() {
    var sel = d.getSelection();
    tags.empty();
    if (!sel.length) {
      placeholderEl.text(d.placeholderText || '').show();
      singleValue.hide(); tags.hide();
      root.removeClass('sdd-has-value');
      return;
    }
    placeholderEl.hide();
    root.addClass('sdd-has-value');
    if (!d.multiple) {
      singleValue.text(sel[sel.length - 1].text).show();
      tags.hide();
      return;
    }
    singleValue.hide(); tags.show();
    var maxTags = 2;
    sel.slice(0, maxTags).forEach(function(it) {
      var tag = $('<span class="sdd-tag"></span>');
      $('<span class="sdd-tag-label"></span>').text(it.text).appendTo(tag);
      $('<button type="button" class="sdd-tag-x" aria-label="Remover">' + closeX + '</button>')
        .on('click', function(ev) { ev.stopPropagation(); d.toggleItem(it.id); })
        .appendTo(tag);
      tags.append(tag);
    });
    if (sel.length > maxTags) {
      tags.append($('<span class="sdd-tag sdd-tag-count"></span>').text('+' + (sel.length - maxTags)));
    }
  };

  // ---- list rendering (with search filter + grouping) -------------------
  d.renderList = function() {
    var st = list.scrollTop();
    list.empty();
    var q = (d.query || '').toLowerCase();
    var filtered = d.items.filter(function(it) {
      return !q || String(it.text).toLowerCase().indexOf(q) !== -1;
    });
    var capped = (d.maxEntries > 0) ? filtered.slice(0, d.maxEntries) : filtered;

    if (!capped.length) {
      list.append($('<div class="sdd-empty"></div>').text(d.noResultsText));
      return;
    }

    var appendOption = function(it, container) {
      var isSel = d.selectedIds.indexOf(it.id) !== -1;
      var opt = $('<div class="sdd-option" role="option"></div>')
        .attr('data-id', it.id)
        .toggleClass('sdd-selected', isSel)
        .attr('aria-selected', isSel ? 'true' : 'false');
      if (d.multiple) opt.append('<span class="sdd-check" aria-hidden="true">' + checkIco + '</span>');
      $('<span class="sdd-option-label"></span>').text(it.text).appendTo(opt);
      if (!d.multiple && isSel) opt.append('<span class="sdd-tick">' + checkIco + '</span>');
      opt.on('mousedown', function(ev) { ev.preventDefault(); }); // keeps focus in the search input
      opt.on('click', function(ev) { ev.stopPropagation(); d.toggleItem(it.id); });
      container.append(opt);
    };

    if (d.grouping) {
      var order = [], map = {};
      capped.forEach(function(it) {
        var g = (it.group == null || it.group === '') ? 'Outros' : it.group;
        if (!map[g]) { map[g] = []; order.push(g); }
        map[g].push(it);
      });
      order.forEach(function(g) {
        var sec = $('<div class="sdd-group"></div>');
        $('<div class="sdd-group-header"></div>').text(g).appendTo(sec);
        map[g].forEach(function(it) { appendOption(it, sec); });
        list.append(sec);
      });
    } else {
      capped.forEach(function(it) { appendOption(it, list); });
    }
    list.scrollTop(st);
  };

  // ---- popup positioning (responsive, viewport-aware) -------------------
  d.positionPopup = function() {
    if (!d.isOpen) return;
    var rect = control[0].getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight, m = 8;
    var width = Math.min(Math.max(rect.width, 240), vw - m * 2);
    var left = Math.min(Math.max(rect.left, m), Math.max(m, vw - width - m));
    var spaceBelow = vh - rect.bottom - m;
    var spaceAbove = rect.top - m;
    var openUp;
    if (d.direction === 'above') openUp = true;
    else if (d.direction === 'below') openUp = false;
    else openUp = (spaceBelow < 230 && spaceAbove > spaceBelow);
    var avail = (openUp ? spaceAbove : spaceBelow) - 4;
    var maxH = Math.max(160, Math.min(380, avail));
    popup.css({ left: left + 'px', width: width + 'px', maxHeight: maxH + 'px' });
    if (openUp) {
      popup.css({ top: 'auto', bottom: (vh - rect.top + 6) + 'px' }).addClass('sdd-up');
    } else {
      popup.css({ bottom: 'auto', top: (rect.bottom + 6) + 'px' }).removeClass('sdd-up');
    }
  };

  d._reposition = function() { d.positionPopup(); };

  d.openPopup = function() {
    if (d.isOpen || d.disabled) return;
    d.isOpen = true;
    d.query = '';
    searchInput.val('');
    d.renderList();
    list.scrollTop(0);
    popup.removeClass('sdd-anim-fade sdd-anim-slide sdd-anim-zoom');
    popup.css('animation-duration', (d.anim === 'none' ? 0 : (d.animDur || 0)) + 'ms');
    popup.addClass('sdd-open');
    if (d.anim && d.anim !== 'none') popup.addClass('sdd-anim-' + d.anim);
    control.attr('aria-expanded', 'true');
    root.addClass('sdd-focused');
    d.positionPopup();
    window.addEventListener('scroll', d._reposition, true);
    window.addEventListener('resize', d._reposition);
    setTimeout(function() { searchInput.trigger('focus'); }, 0);
  };

  d.closePopup = function() {
    if (!d.isOpen) return;
    d.isOpen = false;
    popup.removeClass('sdd-open sdd-up sdd-anim-fade sdd-anim-slide sdd-anim-zoom');
    control.attr('aria-expanded', 'false');
    root.removeClass('sdd-focused');
    list.find('.sdd-option').removeClass('sdd-focus');
    window.removeEventListener('scroll', d._reposition, true);
    window.removeEventListener('resize', d._reposition);
  };

  // ---- interactions ------------------------------------------------------
  control.on('click', function(ev) {
    ev.stopPropagation();
    if (d.disabled) return;
    if (d.isOpen) d.closePopup(); else d.openPopup();
  });

  clearBtn.on('click', function(ev) {
    ev.stopPropagation();
    if (d.disabled) return;
    d.clearSelection(true);
  });

  // search (debounced) — filters the list without closing the popup
  var searchTimer = null;
  searchInput.on('input', function() {
    var q = $(this).val() || '';
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function() {
      d.query = q;
      d.renderList();
      list.scrollTop(0);
      d.positionPopup();
    }, 80);
  });

  // keyboard navigation
  var moveFocus = function(dir) {
    var opts = list.find('.sdd-option');
    if (!opts.length) return;
    var cur = opts.filter('.sdd-focus').first();
    var next;
    if (!cur.length) next = (dir > 0) ? opts.first() : opts.last();
    else {
      var i = opts.index(cur);
      opts.removeClass('sdd-focus');
      var ni = i + dir;
      if (ni < 0) ni = opts.length - 1;
      if (ni >= opts.length) ni = 0;
      next = opts.eq(ni);
    }
    opts.removeClass('sdd-focus');
    next.addClass('sdd-focus');
    var el = next[0];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  };

  var onKeydown = function(e) {
    if (d.disabled) return;
    if (e.key === 'Escape') { d.closePopup(); control.trigger('focus'); return; }
    if (e.key === 'Tab') { d.closePopup(); return; }
    if (e.key === 'ArrowDown') { if (!d.isOpen) d.openPopup(); else moveFocus(1); e.preventDefault(); return; }
    if (e.key === 'ArrowUp') { if (!d.isOpen) d.openPopup(); else moveFocus(-1); e.preventDefault(); return; }
    if (e.key === 'Enter') {
      if (!d.isOpen) { d.openPopup(); e.preventDefault(); return; }
      var focused = list.find('.sdd-option.sdd-focus').first();
      var target = focused.length ? focused : list.find('.sdd-option').first();
      if (target.length) target.trigger('click');
      e.preventDefault();
    }
  };
  control.on('keydown', onKeydown);
  searchInput.on('keydown', onKeydown);

  // outside click closes (popup lives in <body>, so check both containers)
  $(document).on('pointerdown.' + d.ns, function(ev) {
    if (!d.isOpen) return;
    var t = ev.target;
    if (root[0].contains(t) || popup[0].contains(t)) return;
    d.closePopup();
  });

  d.ready = true;
  instance.publishState('selected', null);
  instance.publishState('selected_list', []);
  instance.publishState('sd_status', 'initialized');
}
