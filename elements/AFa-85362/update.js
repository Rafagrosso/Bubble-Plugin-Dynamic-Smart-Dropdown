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
  var dl = parseFloat(properties.autobinding_delay);
  d.abDelay = isFinite(dl) ? Math.max(0, Math.min(5000, dl)) : 600;
  d.keepOnReset = properties.reset_keeps_value !== false;
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
  // Bubble echoes the bound value back after every write, and the first echo
  // can still carry the OLD database value. Right after our own write
  // (d.abSentAt) a differing value is therefore never applied, so clearing the
  // input to blank is never reverted to the previous fill.
  var recent = !!d.abSentAt && (Date.now() - d.abSentAt < 3000);
  if (hasAB) {
    var s = String(ab);
    // never overwrite what is being typed; the echo of our own write is skipped
    if (!d.focused && !d._abT) {
      if (s === d.lastAB || s === d.outputValue()) {
        d.lastAB = s; d.seenAB = s;
      } else if (recent && d.lastAB === '' && !d._retriedClear) {
        // we wrote blank but the field kept its old value: clear it explicitly once
        d._retriedClear = true; d.abSentAt = Date.now();
        try { if (typeof instance.publishAutobinding === 'function') instance.publishAutobinding(null); } catch (e) {}
      } else if (!recent) {
        d.apply(MI.parseText(spec, s, canonical), {});
        d.lastAB = s; d.seenAB = s; d.dirtyAlert = false;
      }
    }
    d.lastInit = initText;
  } else {
    // the bound field was emptied elsewhere: follow it (never right after our own write)
    if (d.bound === true && d.seenAB && !d.focused && !d._abT && !recent && d.state.raw !== '') {
      d.apply({ raw: '', text: '', caret: 0 }, {});
      d.lastAB = ''; d.dirtyAlert = false;
    }
    if (!recent) d.seenAB = '';
    if (d.lastInit === undefined || initText !== d.lastInit) {
      d.lastInit = initText;
      d.apply(MI.parseText(spec, initText, false), {});
      d.dirtyAlert = false;
    }
  }

  d.publishStates();
  instance.publishState('mi_status', 'ready');
}
