// UPDATE (cole no Update)
function(instance, properties, context) {
  instance.data = instance.data || {};
  if (!instance.data.inizialized || !instance.data.searchbox) return;

  // make sure select2 is ready via the global promise
  if (!window.__select2Ready) {
    console.warn('[SD] __select2Ready not found - abort update');
    try { instance.publishState && instance.publishState('sd_status','no_select2_promise'); } catch(e){}
    return;
  }

  // use the promise to initialize safely
  window.__select2Ready.then(function() {
    try {
      // apply Bubble native CSS variables
      try {
        var ff = properties.bubble.font_face().split('::').join('');
        instance.canvas.css('--sb-ff', ff);
        instance.canvas.css('--sb-fs', properties.bubble.font_size() + 'px');
        instance.canvas.css('--sb-fc', properties.bubble.font_color());
        instance.canvas.css('--sb-pc', properties.placeholder_color || '');
      } catch(e){ console.warn('[SD] bubble css vars error', e); }

      // build data safely
      var search_list = [];
      if (properties.search_list && properties.search_list.length && properties.search_list.length() > 0) {
        try { search_list = properties.search_list.get(0, properties.search_list.length()); } catch(e){ search_list = []; }
      }
      var props = search_list[0] ? search_list[0].listProperties() : [];
      var data = search_list.map(function(e){
        return {
          id: props.includes('_id') ? e.get('_id') : e.get(properties.id || 'display'),
          text: instance.data.createCaption(properties, e),
          original: e
        };
      });

      // destroy previous select2 if exists
      try {
        if (instance.data.searchbox.hasClass && instance.data.searchbox.hasClass('select2-hidden-accessible')) {
          instance.data.searchbox.select2('destroy');
          instance.data.searchbox.html('');
        }
      } catch(e) { console.warn('[SD] destroy prior instance error', e); }

      // config
      var config = {
        data: data,
        placeholder: { id: '-1', text: properties.placeholder || '' },
        allowClear: true,
        width: '100%',
        dropdownParent: $(document.body),
        minimumResultsForSearch: 0,
        closeOnSelect: true,
        templateResult: function(item, container) {
          $(container).addClass(instance.data.uniqueId);
          if (!item.id) return item.text;
          return $('<span>' + item.text + '</span>');
        }
      };

      // initialize select2
      try {
        instance.data.searchbox.val(null);
        instance.data.searchbox.select2(config);
      } catch(initErr) {
        console.error('[SD] select2 init error', initErr);
        try { instance.publishState && instance.publishState('sd_status','select2_init_error'); } catch(e){}
        return;
      }

      // reveal select safely (avoid initial flash)
      setTimeout(function(){
        try {
          instance.data.searchbox.css({opacity:1, visibility:'visible', transition:'opacity 0.06s linear'});
          instance.data.searchbox.next('.select2').css({opacity:1, visibility:'visible', transition:'opacity 0.06s linear'});
        } catch(e){}
      }, 30);

      // ensure no preselection unless default_value provided
      try {
        instance.data.searchbox.val(null).trigger('change');
        instance.publishState && instance.publishState('selected', null);

        if (properties.default_value) {
          var idx = null;
          if (properties.id) idx = properties.default_value.get(properties.id);
          if (!idx) idx = properties.default_value.get('_id');
          if (idx) {
            instance.data.searchbox.val(idx).trigger('change');
            instance.publishState && instance.publishState('selected', properties.default_value);
          }
        }
      } catch(e) { console.warn('[SD] apply default error', e); }

      // vertical alignment: set line-height equal element height
      try {
        var h = instance.canvas.height() || 32;
        instance.data.searchbox.next('.select2').find('.select2-selection__rendered').css('line-height', h + 'px');
      } catch(e){}

      // events: select
      instance.data.searchbox.off('select2:select').on('select2:select', function(e){
        try {
          instance.publishState && instance.publishState('selected', e.params.data.original);
          instance.triggerEvent && instance.triggerEvent('searchbox_value_is_changed');
        } catch(er){ console.warn('[SD] select event error', er); }
      });

      // open/close behavior: keep open while interacting; close on outside click
      // clicking container toggles open
      try {
        var container = instance.data.searchbox.next('.select2');
        container.off('.smartdropdown').on('click.smartdropdown', function(ev){
          ev.stopPropagation();
          var s2 = instance.data.searchbox.data('select2');
          try {
            if (!s2.isOpen()) instance.data.searchbox.select2('open');
          } catch(err) { try { instance.data.searchbox.select2('open'); } catch(e){} }
        });
      } catch(e){}

      // close when click outside
      $(document).off('mousedown.smartdropdown_' + instance.data.uniqueId);
      $(document).on('mousedown.smartdropdown_' + instance.data.uniqueId, function(ev){
        var inside = $(ev.target).closest('.select2-container, .smart-dropdown').length > 0;
        if (!inside) {
          try { instance.data.searchbox.select2('close'); } catch(e){}
        }
      });

      // final status
      try { instance.publishState && instance.publishState('sd_status','ready'); } catch(e){}
      console.log('[SD] update complete. items:', data.length);
    } catch(outerErr) {
      console.error('[SD] update outer error', outerErr);
      try { instance.publishState && instance.publishState('sd_status','update_error'); } catch(e){}
    }
  }).catch(function(err){
    console.error('[SD] __select2Ready rejected', err);
    try { instance.publishState && instance.publishState('sd_status','select2_load_failed'); } catch(e){}
  });
}
