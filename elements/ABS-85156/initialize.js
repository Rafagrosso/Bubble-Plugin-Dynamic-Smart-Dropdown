function(instance, context) {
  // prepare data container
  instance.data = instance.data || {};
  instance.canvas.addClass('sd-root');

  // build DOM
  const root = $('<div class="sd-root"></div>');
  const clearBtn = $('<div class="sd-clear" title="Clear">✕</div>');
  const control = $('<div class="sd-control" tabindex="0" role="combobox"></div>');
  const valueEl = $('<div class="sd-value"></div>');
  const arrow = $('<div class="sd-arrow" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"></path></svg></div>');
  const popup = $('<div class="sd-popup" role="listbox" aria-hidden="true"></div>');
  const searchWrap = $('<div class="sd-search-wrap"></div>');
  const searchInput = $('<input class="sd-search" placeholder="Search..." />');
  const list = $('<div class="sd-list"></div>');

  searchWrap.append(searchInput);
  popup.append(searchWrap).append(list);
  control.append(valueEl).append(arrow);
  root.append(control).append(clearBtn).append(popup);

  // clear existing canvas and append
  instance.canvas.empty().append(root);

  // store refs
  instance.data._root = root;
  instance.data._control = control;
  instance.data._value = valueEl;
  instance.data._arrow = arrow;
  instance.data._popup = popup;
  instance.data._search = searchInput;
  instance.data._list = list;
  instance.data._clear = clearBtn;

  // state
  instance.data._items = []; // {id,text,original}
  instance.data._selected = null;
  instance.data._isOpen = false;
  instance.data._anim = 'fade'; // default anim
  instance.data._keepOpenOnSearch = true;
  instance.data._openUpIfNoSpace = true;
  instance.data._closeOnSelect = true;

  // helper open/close
  instance.data._open = function() {
    if (instance.data._isOpen) return;
    instance.data._isOpen = true;
    instance.data._popup.addClass('open');
    if (instance.data._anim) instance.data._popup.addClass('sd-anim-' + instance.data._anim);
    instance.data._popup.attr('aria-hidden','false');
    // decide direction
    if (instance.data._openUpIfNoSpace) {
      const rect = instance.data._root[0].getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popH = Math.min(320, Math.max(120, instance.data._popup[0].scrollHeight || 150));
      if (spaceBelow < popH + 10) instance.data._popup.addClass('up'); else instance.data._popup.removeClass('up');
    }
  };
  instance.data._close = function() {
    if (!instance.data._isOpen) return;
    instance.data._isOpen = false;
    instance.data._popup.removeClass('open up');
    if (instance.data._anim) instance.data._popup.removeClass('sd-anim-' + instance.data._anim);
    instance.data._popup.attr('aria-hidden','true');
  };

  // control click toggles and focuses search
  control.on('click', function(e){
    if (instance.data._isOpen) { instance.data._close(); }
    else { instance.data._open(); instance.data._search.focus(); }
    e.stopPropagation();
  });

  // clicking inside root should not close
  root.on('mousedown', function(e){ e.stopPropagation(); });

  // clear button
  clearBtn.on('click', function(e){
    e.stopPropagation();
    instance.data._selected = null;
    instance.data._value.text('');
    instance.data._root.removeClass('sd-has-value');
    try { instance.publishState('selected', null); } catch(err){}
    try { instance.triggerEvent('searchbox_value_is_changed'); } catch(err){}
  });

  // outside click closes
  $(document).on('mousedown.sd_' + (instance.instanceid || Math.random()), function(ev){
    if ($(ev.target).closest(instance.data._root).length === 0) instance.data._close();
  });

  // search input handling (debounced)
  let timer = null;
  searchInput.on('input', function(){
    const q = $(this).val() || '';
    if (instance.data._keepOpenOnSearch) instance.data._open();
    if (timer) clearTimeout(timer);
    timer = setTimeout(function(){ renderList(q); }, 120);
  });

  // keyboard nav
  control.on('keydown', function(e){
    if (e.key === 'Escape') { instance.data._close(); return; }
    if (e.key === 'ArrowDown') { instance.data._open(); focusNext(); e.preventDefault(); return; }
    if (e.key === 'ArrowUp') { instance.data._open(); focusPrev(); e.preventDefault(); return; }
    if (e.key === 'Enter') {
      const focused = instance.data._list.find('.sd-option.focus');
      if (focused.length) focused.trigger('click');
      else instance.data._list.find('.sd-option:visible').first().trigger('click');
      e.preventDefault();
    }
  });

  // helper renderList will be replaced in update but define now so code won't break
  function renderList(q) {
    instance.data._list.empty();
    (instance.data._items || []).forEach(function(it){
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
  }

  // navigation helpers
  function focusNext(){
    const all = instance.data._list.find('.sd-option:visible');
    if (!all.length) return;
    const cur = all.filter('.focus').first();
    if (!cur.length) { all.first().addClass('focus'); return; }
    cur.removeClass('focus');
    const next = cur.nextAll('.sd-option:visible').first();
    if (next.length) next.addClass('focus'); else all.first().addClass('focus');
  }
  function focusPrev(){
    const all = instance.data._list.find('.sd-option:visible');
    if (!all.length) return;
    const cur = all.filter('.focus').first();
    if (!cur.length) { all.last().addClass('focus'); return; }
    cur.removeClass('focus');
    const prev = cur.prevAll('.sd-option:visible').first();
    if (prev.length) prev.addClass('focus'); else all.last().addClass('focus');
  }

  // attach helpers to instance for update to use
  instance.data._renderList = renderList;
  instance.data._focusNext = focusNext;
  instance.data._focusPrev = focusPrev;

  // initial empty publish
  try { instance.publishState('selected', null); } catch(e){}
}
