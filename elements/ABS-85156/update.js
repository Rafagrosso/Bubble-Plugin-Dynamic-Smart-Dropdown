function(instance, properties, context) {
  var d = instance.data;
  if (!d || !d.ready) return;

  // ---- typography inherited from the Bubble element ----------------------
  try {
    var ff = properties.bubble.font_face().split('::').join('');
    var fs = properties.bubble.font_size() + 'px';
    var fc = properties.bubble.font_color();
    d.$root.css({ 'font-family': ff, 'font-size': fs, 'color': fc });
    d.$popup.css({ 'font-family': ff, 'font-size': fs });
  } catch (e) {}

  // dropdown_font_size overrides the popup font size when provided
  try {
    if (properties.dropdown_font_size > 0) {
      d.$popup.css('font-size', properties.dropdown_font_size + 'px');
    }
  } catch (e) {}

  // ---- behavior properties ----------------------------------------------
  d.multiple = !!properties.multiple_selection;
  d.grouping = !!properties.group_results && !!properties.group_by_field;
  d.disabled = !!properties.disabled;
  d.maxEntries = (properties.max_entries_to_show > 0) ? properties.max_entries_to_show : 0;
  d.anim = properties.dropdown_animation || 'fade';
  d.animDur = (properties.dropdown_animation_duration != null) ? properties.dropdown_animation_duration : 200;
  // open_up_if_no_space=true -> auto flip; false -> always open below
  d.direction = (properties.open_up_if_no_space === false) ? 'below' : 'auto';
  // close_on_select applies to single mode; multiple mode always stays open
  d.closeOnSelect = (properties.close_on_select === false) ? false : true;
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
    searchHeight: properties.search_box_height,
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

  var items = raw.map(function(e, i) {
    var id = null;
    if (properties.id) id = e.get(properties.id);
    if ((id == null || id === '') && hasBubbleId) id = e.get('_id');
    if (id == null || id === '') id = 'sdd_idx_' + i;
    var it = { id: String(id), text: d.createCaption(properties, e), original: e };
    if (d.grouping) it.group = d.groupLabel(e, properties.group_by_field);
    return it;
  });

  d.items = items;
  d.byId = {};
  items.forEach(function(it) { d.byId[it.id] = it; });

  // keep only selections that still exist in the new list
  d.selectedIds = d.selectedIds.filter(function(id) { return !!d.byId[id]; });
  if (!d.multiple && d.selectedIds.length > 1) {
    d.selectedIds = [d.selectedIds[d.selectedIds.length - 1]];
  }

  // default values — only before the first user interaction, so updates
  // never wipe out what the user already picked.
  // Multiple mode: "default_values" (list) first, falling back to
  // "default_value"; single mode: "default_value" only.
  var resolveThingId = function(thing) {
    var vid = null;
    if (properties.id) vid = thing.get(properties.id);
    if (vid == null || vid === '') {
      var tp = (typeof thing.listProperties === 'function') ? thing.listProperties() : [];
      if (tp.indexOf('_id') !== -1) vid = thing.get('_id');
    }
    return (vid == null || vid === '') ? null : String(vid);
  };

  if (!d.touched && !d.selectedIds.length) {
    if (d.multiple && properties.default_value_list) {
      var dlen = properties.default_value_list.length();
      if (dlen > 0) {
        var defaults = properties.default_value_list.get(0, dlen);
        var defIds = [];
        defaults.forEach(function(t) {
          var vid = resolveThingId(t);
          if (vid && d.byId[vid] && defIds.indexOf(vid) === -1) defIds.push(vid);
        });
        if (defIds.length) d.selectedIds = defIds;
      }
    }
    if (!d.selectedIds.length && properties.default_value) {
      var dvId = resolveThingId(properties.default_value);
      if (dvId && d.byId[dvId]) d.selectedIds = [dvId];
    }
  }

  d.renderControl();
  d.renderList();
  if (d.isOpen) d.positionPopup();
  d.publishSelection(false);
}
