function(instance, properties, context) {
  var d = instance.data;
  if (!d || !d.ready) return;

  // ---- typography from the Bubble element style ----------------------
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
  var fontInfo = sddFontInfo(properties, d.$root[0] ? d.$root[0].parentElement : null);
  d.$root.css({
    'font-family': fontInfo.family || '', 'font-size': fontInfo.size || '', 'color': fontInfo.color || '',
    'font-weight': fontInfo.weight || '', 'font-style': fontInfo.style || ''
  });
  d.$popup.css({ 'font-family': fontInfo.family || '', 'font-size': fontInfo.size || '' });

  // ---- behavior properties ----------------------------------------------
  d.multiple = !!properties.multiple_selection;
  d.grouping = !!properties.group_results && !!properties.group_by_field;
  d.disabled = !!properties.disabled;
  // caps search results only — with no query the whole list is available
  d.searchLimit = (properties.max_entries_to_show > 0) ? properties.max_entries_to_show : 0;
  d.sortDir = properties.sort_direction || 'none';
  d.sortField = properties.sort_by_field || null;
  d.anim = properties.dropdown_animation || 'fade';
  d.animDur = (properties.dropdown_animation_duration != null) ? properties.dropdown_animation_duration : 250;
  d.direction = properties.dropdown_direction || 'auto';
  d.placeholderText = properties.placeholder || '';
  d.noResultsText = properties.no_results_text || 'Nenhum resultado encontrado';

  d.$search.attr('placeholder', properties.search_placeholder || 'Pesquisar…');
  d.$popup.toggleClass('sdd-no-icon', properties.show_search_icon === false);
  d.$root.toggleClass('sdd-disabled', d.disabled);
  d.$root.toggleClass('sdd-multiple', d.multiple);
  d.$control.attr('aria-disabled', d.disabled ? 'true' : 'false');
  if (d.disabled && d.isOpen) d.closePopup();

  // ---- colours (every value is validated and derived in applyTheme) ------
  var controlColor = null;
  try { controlColor = properties.bubble.font_color(); } catch (e) {}
  d.applyTheme({
    accent: properties.accent_color,
    popupBackground: properties.dropdown_background,
    optionColor: properties.dropdown_font_color,
    hoverColor: properties.dropdown_hover_color,
    selectedBackground: properties.selected_background,
    selectedColor: properties.selected_font_color,
    placeholderColor: properties.placeholder_color,
    controlColor: controlColor,
    searchBackground: properties.search_background,
    searchBorder: properties.search_border_color,
    searchColor: properties.search_font_color,
    searchPlaceholder: properties.search_placeholder_color,
    searchHeight: properties.search_height,
    searchRadius: properties.search_border_radius,
    optionPadding: properties.option_padding_vertical
  });

  // ---- build items --------------------------------------------------------
  // IMPORTANT: no try/catch around .length()/.get() — Bubble throws a special
  // "not ready" exception here to defer and re-run this update automatically.
  var raw = [];
  if (properties.search_list) {
    var len = properties.search_list.length();
    if (len > 0) raw = properties.search_list.get(0, len);
  }
  // Option Sets don't implement listProperties()/_id like regular Things —
  // guard the call so the whole update doesn't throw and abort mid-way.
  var propsList = (raw[0] && typeof raw[0].listProperties === 'function') ? raw[0].listProperties() : [];
  var hasBubbleId = propsList.indexOf('_id') !== -1;

  // one id resolver for both the list rows and the default values: when the
  // two disagreed, a default could never match its own row in the list
  var thingId = function(thing) {
    var vid = null;
    if (properties.id) vid = thing.get(properties.id);
    if ((vid == null || vid === '') && hasBubbleId) vid = thing.get('_id');
    return (vid == null || vid === '') ? null : String(vid);
  };

  var items = [];
  raw.forEach(function(e, i) {
    var caption = d.buildCaption(properties, e);
    // records whose caption fields are all blank would render as empty rows,
    // so they are left out of the list entirely
    if (!caption.hasContent) return;
    // Option Sets and records without _id fall back to their position
    var id = thingId(e) || ('sdd_idx_' + i);
    var it = { id: String(id), text: caption.text, original: e };
    if (d.grouping) it.group = d.groupLabel(e, properties.group_by_field);
    if (d.sortField) {
      var sv = e.get(d.sortField);
      // a field pointing at another Thing sorts by its display text
      it.sortValue = (sv && typeof sv.get === 'function') ? d.groupLabel(e, d.sortField) : sv;
    }
    items.push(it);
  });

  d.items = d.sortItems(items);
  d.byId = {};
  d.items.forEach(function(it) { d.byId[it.id] = it; });

  // keep only selections that still exist in the new list
  d.selectedIds = d.selectedIds.filter(function(id) { return !!d.byId[id]; });
  if (!d.multiple && d.selectedIds.length > 1) {
    d.selectedIds = [d.selectedIds[d.selectedIds.length - 1]];
  }

  // default values — only before the first user interaction, so updates
  // never wipe out what the user already picked.
  // Multiple mode: "default_value_list" first, falling back to
  // "default_value"; single mode: "default_value" only.
  // Resolves a default to the id of its own row in the list, so that row is
  // highlighted. The id alone is not enough: Option Sets and lists without
  // _id are keyed by position, so the record is also matched by identity and
  // then by the caption it renders as.
  var ghostSeq = 0;
  var matchInList = function(thing) {
    var vid = thingId(thing);
    if (vid && d.byId[vid]) return vid;
    for (var i = 0; i < d.items.length; i++) {
      if (d.items[i].original === thing) return d.items[i].id;
    }
    var caption = d.createCaption(properties, thing);
    if (caption !== '') {
      for (var j = 0; j < d.items.length; j++) {
        if (d.items[j].text === caption) return d.items[j].id;
      }
    }
    return null;
  };

  // a default genuinely absent from the provided list still gets selected: it
  // is registered on the side so the control, the chips and the exposed states
  // show it even before (or without) the list containing that record
  var registerDefault = function(thing) {
    var found = matchInList(thing);
    if (found) return found;
    var vid = thingId(thing) || ('sdd_default_' + (ghostSeq++));
    if (!d.byId[vid]) {
      d.byId[vid] = { id: vid, text: d.createCaption(properties, thing), original: thing };
    }
    return vid;
  };

  // Which records the defaults point at. Recomputed on every update — even
  // after the user has picked something — so a later reset can restore them.
  var defaultIds = [];
  var addDefault = function(thing) {
    var vid = registerDefault(thing);
    if (vid && defaultIds.indexOf(vid) === -1) defaultIds.push(vid);
  };
  var listDefaults = function() {
    if (!properties.default_value_list) return [];
    var n = properties.default_value_list.length();
    return (n > 0) ? properties.default_value_list.get(0, n) : [];
  };

  if (d.multiple) {
    listDefaults().forEach(addDefault);
    // multiple selection with only the single field filled: honour it anyway
    if (!defaultIds.length && properties.default_value) addDefault(properties.default_value);
  } else {
    if (properties.default_value) addDefault(properties.default_value);
    // single selection with only the list filled: take its first entry, so a
    // default is never silently ignored just because it sits in the other field
    if (!defaultIds.length) {
      var firstOfList = listDefaults()[0];
      if (firstOfList) addDefault(firstOfList);
    }
  }
  d.defaultIds = defaultIds;

  // applied only before the first user interaction, so updates never overwrite
  // a real choice
  if (!d.touched && !d.selectedIds.length && defaultIds.length) {
    d.selectedIds = defaultIds.slice();
  }

  d.renderControl();
  d.renderList();
  if (d.isOpen) d.positionPopup();
  d.publishSelection(false);
  instance.publishState('sd_status', 'ready');
}
