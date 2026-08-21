function(instance, properties, context) {
  instance.data = instance.data || {};
  if (!instance.data._root) return;

  // Apply Bubble native font & colors to control root (so it inherits)
  try {
    const ff = properties.bubble.font_face().split('::').join('');
    instance.data._root.css('font-family', ff);
    instance.data._root.css('font-size', properties.bubble.font_size() + 'px');
    instance.data._root.css('color', properties.bubble.font_color());
  } catch(e){}

  // Map behavior properties
  instance.data._anim = properties.dropdown_animation || 'fade'; // 'fade','slide','zoom' or 'none'
  instance.data._keepOpenOnSearch = (properties.keep_open_on_search === undefined) ? true : !!properties.keep_open_on_search;
  instance.data._openUpIfNoSpace = (properties.open_up_if_no_space === undefined) ? true : !!properties.open_up_if_no_space;
  instance.data._closeOnSelect = (properties.close_on_select === undefined) ? true : !!properties.close_on_select;
  instance.data._disabled = !!properties.disabled;

  // Disabled appearance
  instance.data._control.toggleClass('sd-disabled', instance.data._disabled);
  if (instance.data._disabled) instance.data._control.attr('aria-disabled','true'); else instance.data._control.removeAttr('aria-disabled');

  // Build items from search_list
  let raw = [];
  try {
    if (properties.search_list && properties.search_list.length() > 0) raw = properties.search_list.get(0, properties.search_list.length());
  } catch(e){ raw = []; }

  const props = raw[0] ? raw[0].listProperties() : [];

  // create items array
  const items = raw.map(function(e){
    const id = props.includes('_id') ? e.get('_id') : e.get(properties.id || 'display');
    // caption logic
    let text = '';
    if (properties.secondary_caption_field && properties.caption_field) {
      text = (e.get(properties.caption_field) || '') + (properties.separator || '') + (e.get(properties.secondary_caption_field) || '');
    } else if (properties.caption_field) {
      text = e.get(properties.caption_field) || '';
    } else if (properties.dynamic_caption_field) {
      text = (properties.dynamic_caption_field || '').replace(/\[[^\]]+\]/g, function(s){
        const key = s.replace(/[\[\]]/g,'');
        if (key.includes('->')) {
          const parts = key.split('->');
          return e.get(parts[0]) ? e.get(parts[0]).get(parts[1]) : '';
        }
        return e.get(key) || '';
      });
    } else {
      text = e.get(properties.display || 'display') || '';
    }
    return { id: id, text: text, original: e };
  });

  // respect max_entries_to_show
  const max = properties.max_entries_to_show || items.length;
  instance.data._items = items.slice(0, max);

  // Render list initially (no query)
  instance.data._renderList('');

  // Placeholder / default selection logic:
  if (properties.default_value) {
    // try set default value
    let dvId = null;
    try {
      dvId = properties.default_value.get(properties.id) || properties.default_value.get('_id');
    } catch(err){ dvId = null; }
    if (dvId) {
      const found = instance.data._items.find(i => i.id == dvId);
      if (found) {
        instance.data._selected = found;
        instance.data._value.text(found.text);
        instance.data._root.addClass('sd-has-value');
        try { instance.publishState('selected', found.original); } catch(err){}
      } else {
        // if default value doesn't match available options -> clear
        instance.data._selected = null;
        instance.data._value.text(properties.placeholder || '');
        instance.data._root.removeClass('sd-has-value');
        try { instance.publishState('selected', null); } catch(err){}
      }
    } else {
      // default provided but empty id -> treat as no selection
      instance.data._selected = null;
      instance.data._value.text(properties.placeholder || '');
      instance.data._root.removeClass('sd-has-value');
      try { instance.publishState('selected', null); } catch(err){}
    }
  } else {
    // no default -> no selection (blank placeholder)
    instance.data._selected = null;
    instance.data._value.text(properties.placeholder || '');
    instance.data._root.removeClass('sd-has-value');
    try { instance.publishState('selected', null); } catch(err){}
  }

  // adjust control height to parent's height (keeps vertical centering)
  try {
    const h = instance.canvas.height();
    instance.data._control.css({'height': h + 'px', 'line-height': h + 'px'});
    instance.data._value.css('line-height', h + 'px');
  } catch(e){}

  // ensure popup animation class
  instance.data._popup.removeClass('sd-anim-fade sd-anim-slide sd-anim-zoom');
  if (instance.data._anim && instance.data._anim !== 'none') instance.data._popup.addClass('sd-anim-' + instance.data._anim);

  // search interaction: keep open on search and filter
  instance.data._search.off('input.sd').on('input.sd', function(){
    const q = $(this).val() || '';
    // filter and render
    const filtered = instance.data._items.filter(it => (it.text || '').toString().toLowerCase().indexOf(q.toString().toLowerCase()) !== -1);
    // temporarily render filtered list
    instance.data._list.empty();
    if (filtered.length) {
      filtered.forEach(function(it){
        const opt = $('<div class="sd-option"></div>').text(it.text).data('item', it);
        opt.on('mouseenter', function(){ $(this).addClass('highlight'); }).on('mouseleave', function(){ $(this).removeClass('highlight'); });
        opt.on('click', function(e){
          e.stopPropagation();
          const item = $(this).data('item');
          instance.data._selected = item;
          instance.data._value.text(item.text);
          instance.data._root.addClass('sd-has-value');
          try { instance.publishState('selected', item.original); } catch(err){}
          try { instance.triggerEvent('searchbox_value_is_changed'); } catch(err){}
          if (instance.data._closeOnSelect) instance.data._close();
        });
        instance.data._list.append(opt);
      });
    } else {
      instance.data._list.append($('<div class="sd-option" style="opacity:.6;cursor:default;">' + (properties.no_results_text || 'No results') + '</div>'));
    }
    if (instance.data._keepOpenOnSearch) instance.data._open();
  });

  // clicking control opens popup and focuses search input
  instance.data._control.off('click').on('click', function(e){
    if (instance.data._disabled) return;
    instance.data._open();
    instance.data._search.focus();
    e.stopPropagation();
  });

  // clicking inside popup prevents close
  instance.data._popup.off('click').on('click', function(e){ e.stopPropagation(); });

  // final log (for debugging)
  console.log('[sd] update: items=', instance.data._items.length, 'default=', !!properties.default_value);
}
