function(instance, properties, context) {
  var d = instance.data;
  if (!d || !d.ready) return;
  var MI = d.MI, U = d.U, input = d.$input;
  function blank(v) { return v == null || String(v).trim() === ''; }

  // ---- behaviour flags ------------------------------------------------------
  d.disabled = !!properties.disabled;
  d.readOnly = !!properties.read_only;
  d.checksum = properties.validate_checksum !== false;
  d.valueFormat = (MI.norm(properties.autobinding_format).indexOf('sem') === 0) ? 'raw' : 'masked';
  d.alertOnSuccess = !!properties.alert_on_success;
  d.successMessage = blank(properties.success_message) ? 'Salvo com sucesso!' : String(properties.success_message);
  d.showFlag = properties.show_flag !== false;
  d.popColors = {
    bg: U.color(properties.popup_background, ''), fg: U.color(properties.popup_font_color, ''),
    hover: U.color(properties.popup_hover_color, '')
  };
  input.prop('disabled', d.disabled).prop('readOnly', d.readOnly);
  if (d.disabled && d.ccOpen) d.closeCC();

  // ---- mask ---------------------------------------------------------------
  // the country picked by the user sticks until the country property changes
  var propCountry = MI.findCountry(!blank(properties.dynamic_country) ? properties.dynamic_country : properties.default_country) || MI.COUNTRIES[0];
  if (propCountry[0] !== d.countryKey) { d.countryKey = propCountry[0]; d.country = propCountry[0]; }
  var opts = U.opts(properties, d.country);
  var key = JSON.stringify(opts);
  if (key !== d.specKey) {
    var prev = d.spec;
    d.rebuildSpec(opts);
    // number -> number keeps the canonical value; anything else is re-read
    // from what is on screen, so a mask change reformats the same digits
    var res = (prev.kind === 'number' && d.spec.kind === 'number')
      ? MI.setRaw(d.spec, d.state.raw)
      : MI.parseText(d.spec, d.state.text);
    d.apply(res, {});
  }
  var spec = d.spec;

  // ---- country selector -----------------------------------------------------
  d.showSelector = (spec.id === 'phone') && !!properties.show_country_selector;
  if (d.showSelector) { d.renderCC(); d.$cc.show().prop('disabled', d.disabled || d.readOnly); }
  else { d.$cc.hide(); if (d.ccOpen) d.closeCC(); }

  // ---- input attributes (native-like autofill) ----------------------------------
  var ac = U.auto(properties.autocomplete, spec);
  input.attr('autocomplete', ac);
  if (ac === 'off') input.attr({ 'data-lpignore': 'true', 'data-1p-ignore': 'true' });
  else input.removeAttr('data-lpignore').removeAttr('data-1p-ignore');
  var nm = blank(properties.input_name) ? ((ac === 'on' || ac === 'off') ? '' : ac) : String(properties.input_name).trim();
  if (nm) input.attr('name', nm); else input.removeAttr('name');
  input.attr('inputmode', U.mode(spec));
  var ph = !blank(properties.placeholder) ? String(properties.placeholder)
         : (properties.use_mask_example ? MI.example(spec) : '');
  if (ph) input.attr('placeholder', ph); else input.removeAttr('placeholder');
  U.pad(d.$root[0], properties);
  U.layout(instance.canvas, d.host);

  // ---- style from the Bubble editor -------------------------------------------
  U.style(input[0], d.host, properties);
  var rs = d.$root[0].style;
  rs.setProperty('--mi-ph', U.color(properties.placeholder_color, '#94a3b8'));
  var fc = U.color(properties.focus_outline_color, '');
  var fw = parseFloat(properties.focus_outline_width);
  d.focusOutline = fc ? ((fw >= 0 ? fw : 2) + 'px solid ' + fc) : '';

  // ---- value: autobinding (database) or initial content ---------------------------
  var ab = properties.autobinding;
  // Bubble tells whether the user picked a field to bind in the property editor
  d.bound = null;
  try { if (properties.bubble && typeof properties.bubble.auto_binding === 'function') d.bound = !!properties.bubble.auto_binding(); } catch (e) {}
  var hasAB = (typeof ab === 'string' && ab !== '') || typeof ab === 'number';
  var initText = blank(properties.initial_content) ? '' : String(properties.initial_content);
  var canonical = d.valueFormat === 'raw';
  if (hasAB) {
    var s = String(ab);
    d.seenAB = s;
    // never overwrite what is being typed; the echo of our own write is skipped
    if (!d.focused) {
      if (s !== d.lastAB && s !== d.outputValue()) {
        d.apply(MI.parseText(spec, s, canonical), {});
        d.dirtyAlert = false;
      }
      d.lastAB = s;
    }
    d.lastInit = initText;
  } else if (d.lastInit === undefined || initText !== d.lastInit) {
    d.lastInit = initText;
    d.apply(MI.parseText(spec, initText, false), {});
    d.dirtyAlert = false;
  }

  d.publishStates();
  instance.publishState('mi_status', 'ready');
}
