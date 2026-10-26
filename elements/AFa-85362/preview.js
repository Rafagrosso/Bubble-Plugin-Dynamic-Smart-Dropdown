function(instance, properties) {
var MI = (function () {
  'use strict';

  // ======================================================================
  // Slot classes. Pattern syntax (jQuery-Mask style):
  //   0 digit (required)   9 digit (optional)   A letter or digit
  //   S letter             X digit or "X" (req)  x digit or "X" (optional)
  //   \  escapes the next character; anything else is a literal.
  // ======================================================================
  var LETTER = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF';
  var CLASS = {
    '0': new RegExp('^[0-9]$'), '9': new RegExp('^[0-9]$'),
    'A': new RegExp('^[0-9' + LETTER + ']$'), 'S': new RegExp('^[' + LETTER + ']$'),
    'X': new RegExp('^[0-9Xx]$'), 'x': new RegExp('^[0-9Xx]$')
  };
  var OPTIONAL = { '9': true, 'x': true };

  var cache = {};
  function compile(src) {
    src = String(src == null ? '' : src);
    if (cache[src]) return cache[src];
    var tokens = [], slots = [], req = 0, i, ch, t;
    for (i = 0; i < src.length; i++) {
      ch = src.charAt(i);
      if (ch === '\\' && i + 1 < src.length) { tokens.push({ lit: src.charAt(++i) }); continue; }
      if (CLASS[ch]) {
        t = { cls: ch };
        tokens.push(t); slots.push(t);
        if (!OPTIONAL[ch]) req = slots.length;
      } else tokens.push({ lit: ch });
    }
    return (cache[src] = { src: src, tokens: tokens, slots: slots, cap: slots.length, req: req });
  }

  function stripAccents(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s;
  }
  function norm(s) { return stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // ======================================================================
  // Pattern-mask engine
  // ======================================================================
  function entry(p, when, unless) {
    return { p: compile(p), when: when || null, unless: unless || null };
  }
  function slotCase(spec, ch) {
    if (spec.letterCase === 'upper') return ch.toUpperCase();
    if (spec.letterCase === 'lower') return ch.toLowerCase();
    return ch;
  }
  function fits(e, raw) {
    var p = e.p, i;
    if (raw.length > p.cap) return false;
    for (i = 0; i < raw.length; i++) if (!CLASS[p.slots[i].cls].test(raw.charAt(i))) return false;
    return true;
  }
  // first pattern that accepts this raw text (patterns are ordered)
  function pick(spec, raw) {
    var i, e;
    for (i = 0; i < spec.patterns.length; i++) {
      e = spec.patterns[i];
      if (e.when && !e.when.test(raw)) continue;
      if (e.unless && e.unless.test(raw)) continue;
      if (fits(e, raw)) return e;
    }
    return null;
  }

  // text for a raw string. Literals are lazy: they appear only once a
  // following character exists, so deleting never gets stuck on one.
  function formatPattern(spec, raw) {
    var e = pick(spec, raw) || spec.patterns[spec.patterns.length - 1];
    var out = '', map = [], pend = '', ri = 0, k, t;
    for (k = 0; k < e.p.tokens.length; k++) {
      t = e.p.tokens[k];
      if (t.lit !== undefined) { pend += t.lit; continue; }
      if (ri >= raw.length) break;
      out += pend + raw.charAt(ri);
      map.push(out.length - 1);
      pend = ''; ri++;
    }
    return { text: out, map: map };
  }

  function buildPattern(spec, head, ins, tail) {
    var res = '', caretIdx = 0, seq = head + ins + tail, i, c;
    for (i = 0; i < seq.length; i++) {
      c = slotCase(spec, seq.charAt(i));
      if (pick(spec, res + c)) res += c;
      if (i === head.length + ins.length - 1) caretIdx = res.length;
    }
    if (!ins.length && !tail.length) caretIdx = res.length;
    if (!ins.length) caretIdx = Math.min(head.length, res.length);
    return { raw: res, caretIdx: caretIdx };
  }

  // ======================================================================
  // Numeric engine (currency / number / percent); raw is canonical:
  // optional "-", digits, optional "." and decimals.
  // ======================================================================
  function formatNumber(spec, raw) {
    var neg = raw.charAt(0) === '-', body = neg ? raw.slice(1) : raw;
    var out = '', map = [], i, dot = body.indexOf('.');
    var ip = dot === -1 ? body : body.slice(0, dot);
    var off = neg ? 1 : 0;
    if (neg) { out += '-'; map.push(0); }
    if (body === '') return { text: out, map: map };
    out += spec.prefix;
    for (i = 0; i < body.length; i++) {
      if (i < ip.length) {
        if (i > 0 && (ip.length - i) % 3 === 0 && spec.thousands) out += spec.thousands;
        out += body.charAt(i);
      } else if (i === dot) out += spec.decimal;
      else out += body.charAt(i);
      map[i + off] = out.length - 1;
    }
    out += spec.suffix;
    return { text: out, map: map };
  }

  function buildNumber(spec, head, ins, tail) {
    var res = '', caretIdx = 0, seq = head + ins + tail, i, c, ch, neg, body, dot, ip;
    for (i = 0; i < seq.length; i++) {
      ch = seq.charAt(i);
      var typed = i >= head.length && i < head.length + ins.length;
      c = null;
      neg = res.charAt(0) === '-';
      body = neg ? res.slice(1) : res;
      dot = body.indexOf('.');
      if (ch >= '0' && ch <= '9') {
        if (dot !== -1) { if (body.length - dot - 1 < spec.decimals) c = ch; }
        else if (body === '0') { res = (neg ? '-' : '') + ch; if (ch === '0') res = (neg ? '-' : '') + '0'; c = ''; }
        else if (body.length < 15) c = ch;
      } else if (ch === '.' || (ch === ',' && typed && spec.decimal === ',')) {
        if (ch === '.' && typed && spec.decimal === ',' && false) c = null;
        else if (spec.decimals > 0 && dot === -1) c = (body === '' ? '0.' : '.');
      } else if (ch === '-') {
        if (spec.negative && res === '') c = '-';
      }
      if (c) res += c;
      if (i === head.length + ins.length - 1) caretIdx = res.length;
    }
    if (!ins.length) caretIdx = Math.min(head.length, res.length);
    return { raw: res, caretIdx: caretIdx };
  }

  function formatAny(spec, raw) {
    if (spec.kind === 'number') return formatNumber(spec, raw);
    if (spec.kind === 'pattern') return formatPattern(spec, raw);
    return { text: raw, map: raw.split('').map(function (_, i) { return i; }) };
  }
  function buildAny(spec, head, ins, tail) {
    if (spec.kind === 'number') return buildNumber(spec, head, ins, tail);
    if (spec.kind === 'pattern') return buildPattern(spec, head, ins, tail);
    var r = head + ins + tail;
    return { raw: r, caretIdx: head.length + ins.length };
  }

  // Re-filters an existing raw string through a (possibly new) spec.
  function setRaw(spec, raw) {
    var r = buildAny(spec, '', String(raw == null ? '' : raw), '').raw;
    var f = formatAny(spec, r);
    return { raw: r, text: f.text, caret: f.text.length };
  }

  // Parses an arbitrary string (initial content, autobinding, pasted whole
  // value) into a raw value, walking the pattern so literal digits of the
  // pattern are not mistaken for typed ones.
  function parseText(spec, text, canonical) {
    text = String(text == null ? '' : text);
    var chars = '', i, j, e, t, ch;
    if (spec.kind === 'number') {
      // canonical dot-decimal input ("1234.5") or localized text ("1.234,5")
      var s = text.replace(/[^0-9,.\-]/g, '');
      if (canonical) return setRaw(spec, s);
      var hasComma = s.indexOf(',') !== -1, hasDot = s.indexOf('.') !== -1;
      if (spec.decimal === ',') {
        if (hasComma) s = s.replace(/\./g, '').replace(',', '.');
        else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      } else {
        if (hasDot) s = s.replace(/,/g, '');
        else if (hasComma && /^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else s = s.replace(/,/g, '.');
      }
      return setRaw(spec, s);
    }
    if (spec.kind !== 'pattern') return setRaw(spec, text);
    // dial code prefix ("+55 11 9...") is dropped when the mask knows it
    if (spec.dial && /^\s*\+/.test(text)) {
      var digits = text.replace(/\D/g, '');
      if (digits.indexOf(spec.dial) === 0) text = digits.slice(spec.dial.length);
    }
    e = spec.patterns[spec.patterns.length - 1];
    for (i = 0; i < spec.patterns.length; i++) {
      if (spec.patterns[i].p.cap > e.p.cap) e = spec.patterns[i];
    }
    var plain = text.replace(/[^0-9A-Za-zÀ-ÿ]/g, '');
    // a bare string longer than any pattern that starts with the dial code
    if (spec.dial && /^\d+$/.test(plain) && plain.length > e.p.cap && plain.indexOf(spec.dial) === 0) {
      text = plain.slice(spec.dial.length);
    }
    j = 0;
    for (i = 0; i < e.p.tokens.length && j < text.length; i++) {
      t = e.p.tokens[i];
      if (t.lit !== undefined) { if (text.charAt(j) === t.lit) j++; continue; }
      while (j < text.length && !CLASS[t.cls].test(text.charAt(j))) j++;
      if (j < text.length) chars += text.charAt(j++);
    }
    // anything beyond the widest pattern is ignored; build handles the rest
    return setRaw(spec, chars);
  }

  // ======================================================================
  // The edit pipeline. state = { raw }. N = new DOM value, caret = caret in N.
  // ======================================================================
  function edit(spec, state, N, caret, inputType) {
    var fm = formatAny(spec, state.raw), P = fm.text, map = fm.map;
    var raw = state.raw, k, i;
    N = String(N);
    if (caret == null || caret > N.length || caret < 0) caret = N.length;
    var suf = N.length - caret;
    if (suf > P.length || P.slice(P.length - suf) !== N.slice(caret)) { suf = 0; caret = N.length; }
    var Pend = P.length - suf, headN = N.slice(0, caret), headP = P.slice(0, Pend);
    var cp = 0;
    while (cp < headN.length && cp < headP.length && headN.charAt(cp) === headP.charAt(cp)) cp++;
    var removedEnd = Pend;               // text [cp, removedEnd) was removed
    var ins = headN.slice(cp);
    var keep = 0;                          // raw chars strictly before cp
    for (i = 0; i < map.length; i++) if (map[i] < cp) keep = i + 1;
    var tailStart = raw.length;            // first raw char at/after removedEnd
    for (i = 0; i < map.length; i++) if (map[i] >= removedEnd) { tailStart = i; break; }
    var removedAny = tailStart > keep;
    var type = String(inputType || '');
    if (!ins && !removedAny && removedEnd > cp) {
      // only literals were deleted: act on the neighbouring raw character
      if (type.indexOf('Forward') !== -1) tailStart = Math.min(raw.length, tailStart + 1);
      else keep = Math.max(0, keep - 1);
    }
    var head = raw.slice(0, keep), tail = raw.slice(Math.max(tailStart, keep));
    var b = buildAny(spec, head, ins, tail);
    var f = formatAny(spec, b.raw);
    var idx = Math.min(b.caretIdx, b.raw.length);
    var pos = idx === 0 ? (f.text.length && !b.raw.length ? 0 : 0) : f.map[idx - 1] + 1;
    if (idx === 0 && b.raw.length && spec.kind === 'number') pos = 0;
    return { raw: b.raw, text: f.text, caret: pos };
  }

  // ======================================================================
  // Validators (return true/false; only called for complete values)
  // ======================================================================
  function allSame(s) { return /^(.)\1*$/.test(s); }
  function validCPF(r) {
    if (!/^\d{11}$/.test(r) || allSame(r)) return false;
    var i, s, d;
    for (d = 9; d <= 10; d++) {
      for (s = 0, i = 0; i < d; i++) s += (+r.charAt(i)) * (d + 1 - i);
      s = (s * 10) % 11; if (s === 10) s = 0;
      if (s !== +r.charAt(d)) return false;
    }
    return true;
  }
  function validCNPJ(r) {
    r = r.toUpperCase();
    if (!/^[0-9A-Z]{12}\d{2}$/.test(r) || allSame(r)) return false;
    var w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2], i, s, d;
    function val(c) { return c.charCodeAt(0) - 48; }
    for (s = 0, i = 0; i < 12; i++) s += val(r.charAt(i)) * w1[i];
    d = s % 11; d = d < 2 ? 0 : 11 - d;
    if (d !== +r.charAt(12)) return false;
    for (s = 0, i = 0; i < 13; i++) s += val(r.charAt(i)) * w2[i];
    d = s % 11; d = d < 2 ? 0 : 11 - d;
    return d === +r.charAt(13);
  }
  function validPIS(r) {
    if (!/^\d{11}$/.test(r) || allSame(r)) return false;
    var w = [3,2,9,8,7,6,5,4,3,2], s = 0, i, d;
    for (i = 0; i < 10; i++) s += (+r.charAt(i)) * w[i];
    d = 11 - (s % 11); if (d >= 10) d = 0;
    return d === +r.charAt(10);
  }
  function validLuhn(r) {
    if (!/^\d{13,19}$/.test(r)) return false;
    var s = 0, alt = false, i, n;
    for (i = r.length - 1; i >= 0; i--) {
      n = +r.charAt(i);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      s += n; alt = !alt;
    }
    return s % 10 === 0;
  }
  function validDate(r) {
    if (!/^\d{8}$/.test(r)) return false;
    var d = +r.slice(0, 2), m = +r.slice(2, 4), y = +r.slice(4, 8);
    if (y < 1 || m < 1 || m > 12 || d < 1) return false;
    var dim = [31, ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= dim[m - 1];
  }
  function validTime(r) {
    if (!/^\d{4}(\d{2})?$/.test(r)) return false;
    return +r.slice(0, 2) < 24 && +r.slice(2, 4) < 60 && (r.length === 4 || +r.slice(4, 6) < 60);
  }
  function validBRPhone(r) {
    if (!/^[1-9][1-9]/.test(r)) return false;
    if (r.length === 11) return r.charAt(2) === '9';
    return r.length === 10;
  }

  // ======================================================================
  // Phone countries: [iso, name (pt-BR), dial, patterns[]]
  // Patterns are ordered shortest -> longest; "9" slots are optional digits.
  // ======================================================================
  var COUNTRIES = [
    ['BR', 'Brasil', '55', ['(00) 0000-0000', '(00) 00000-0000']],
    ['PT', 'Portugal', '351', ['000 000 000']],
    ['US', 'Estados Unidos', '1', ['(000) 000-0000']],
    ['CA', 'Canadá', '1', ['(000) 000-0000']],
    ['AR', 'Argentina', '54', ['00 0000-0000']],
    ['BO', 'Bolívia', '591', ['0000 0000']],
    ['CL', 'Chile', '56', ['0 0000 0000']],
    ['CO', 'Colômbia', '57', ['000 000 0000']],
    ['EC', 'Equador', '593', ['00 000 0000']],
    ['MX', 'México', '52', ['00 0000 0000']],
    ['PY', 'Paraguai', '595', ['000 000 000']],
    ['PE', 'Peru', '51', ['000 000 000']],
    ['UY', 'Uruguai', '598', ['0000 0000']],
    ['VE', 'Venezuela', '58', ['000 000 0000']],
    ['AO', 'Angola', '244', ['000 000 000']],
    ['MZ', 'Moçambique', '258', ['00 000 0000']],
    ['CV', 'Cabo Verde', '238', ['000 00 00']],
    ['ZA', 'África do Sul', '27', ['00 000 0000']],
    ['NG', 'Nigéria', '234', ['000 000 0000']],
    ['EG', 'Egito', '20', ['000 000 0000']],
    ['ES', 'Espanha', '34', ['000 00 00 00']],
    ['FR', 'França', '33', ['0 00 00 00 00']],
    ['DE', 'Alemanha', '49', ['0000 000000', '0000 0000000']],
    ['IT', 'Itália', '39', ['000 000 000', '000 000 0000']],
    ['GB', 'Reino Unido', '44', ['0000 000000']],
    ['IE', 'Irlanda', '353', ['00 000 0000']],
    ['NL', 'Países Baixos', '31', ['0 00000000']],
    ['BE', 'Bélgica', '32', ['000 00 00 00']],
    ['CH', 'Suíça', '41', ['00 000 00 00']],
    ['AT', 'Áustria', '43', ['000 0000000']],
    ['SE', 'Suécia', '46', ['00 000 00 00']],
    ['NO', 'Noruega', '47', ['000 00 000']],
    ['DK', 'Dinamarca', '45', ['00 00 00 00']],
    ['FI', 'Finlândia', '358', ['00 000 0000']],
    ['PL', 'Polônia', '48', ['000 000 000']],
    ['RU', 'Rússia', '7', ['(000) 000-00-00']],
    ['TR', 'Turquia', '90', ['(000) 000 00 00']],
    ['IL', 'Israel', '972', ['00 000 0000']],
    ['SA', 'Arábia Saudita', '966', ['00 000 0000']],
    ['AE', 'Emirados Árabes Unidos', '971', ['00 000 0000']],
    ['IN', 'Índia', '91', ['00000 00000']],
    ['CN', 'China', '86', ['000 0000 0000']],
    ['JP', 'Japão', '81', ['00 0000 0000']],
    ['KR', 'Coreia do Sul', '82', ['00 0000 0000']],
    ['AU', 'Austrália', '61', ['000 000 000']],
    ['NZ', 'Nova Zelândia', '64', ['00 000 0000']]
  ];
  var GENERIC_PHONE = '000999999999999';

  function findCountry(v) {
    var n = norm(v), i, c;
    if (!n) return null;
    for (i = 0; i < COUNTRIES.length; i++) {
      c = COUNTRIES[i];
      if (n === c[0].toLowerCase() || n === norm(c[1]) || n === '+' + c[2] && c[0] === 'BR') return c;
    }
    // "Brasil (+55)" style option labels
    for (i = 0; i < COUNTRIES.length; i++) {
      if (n.indexOf(norm(COUNTRIES[i][1])) === 0) return COUNTRIES[i];
    }
    return null;
  }
  function countryLabel(c) { return c[1] + ' (+' + c[2] + ')'; }

  // ======================================================================
  // Inscrição Estadual by UF
  // ======================================================================
  var IE = {
    AC: '00.000.000/000-00', AL: '000000000', AP: '000000000', AM: '00.000.000-0',
    BA: ['000000-00', '0000000-00'], CE: '00000000-0', DF: '00000000000-00',
    ES: '000.000.00-0', GO: '00.000.000-0', MA: '000000000', MT: '0000000000-0',
    MS: '000000000', MG: '000.000.000/0000', PA: '00-000000-0', PB: '00000000-0',
    PR: '000.00000-00', PE: '0000000-00', PI: '000000000', RJ: '00.000.00-0',
    RN: ['00.000.000-0', '00.0.000.000-0'], RS: '000/0000000', RO: '000.00000-0',
    RR: '00000000-0', SC: '000.000.000', SP: '000.000.000.000', SE: '00000000-0',
    TO: '00.00.000000-0'
  };

  // ======================================================================
  // Mask registry. id -> label shown in the editor dropdown.
  // ======================================================================
  var MASKS = [
    ['none', 'Nenhuma'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['cpf_cnpj', 'CPF ou CNPJ (automático)'],
    ['rg', 'RG'], ['ie', 'Inscrição Estadual'], ['phone', 'Telefone'], ['cep', 'CEP'],
    ['postbox', 'Caixa Postal'], ['date', 'Data (dd/mm/aaaa)'], ['time', 'Hora (hh:mm)'],
    ['datetime', 'Data e hora'], ['currency', 'Moeda'], ['number', 'Número'],
    ['percent', 'Percentual'], ['card', 'Cartão de crédito'], ['plate', 'Placa de veículo'],
    ['pis', 'PIS / NIS'], ['voter', 'Título de eleitor'], ['cnh', 'CNH'],
    ['pt_postal', 'Código postal (Portugal)'], ['us_zip', 'ZIP (EUA)'], ['custom', 'Personalizada']
  ];
  function maskId(label) {
    var n = norm(label), i;
    if (!n) return 'none';
    for (i = 0; i < MASKS.length; i++) {
      if (n === MASKS[i][0] || n === norm(MASKS[i][1])) return MASKS[i][0];
    }
    if (n.indexOf('moeda') === 0) return 'currency';
    if (n.indexOf('data e hora') === 0) return 'datetime';
    if (n.indexOf('data') === 0) return 'date';
    if (n.indexOf('hora') === 0) return 'time';
    if (n.indexOf('cpf ou') === 0) return 'cpf_cnpj';
    if (n.indexOf('personaliz') === 0) return 'custom';
    return 'none';
  }

  function simple(id, patterns, extra) {
    var spec = { id: id, kind: 'pattern', patterns: [], letterCase: '' };
    (Array.isArray(patterns) ? patterns : [patterns]).forEach(function (p) {
      if (typeof p === 'string') spec.patterns.push(entry(p));
      else spec.patterns.push(entry(p[0], p[1], p[2]));
    });
    if (extra) for (var k in extra) spec[k] = extra[k];
    return spec;
  }

  // opts: { mask, custom, ieState, country, alpha, decimals, numberFormat,
  //         currency, letterCase }
  function build(opts) {
    opts = opts || {};
    var id = maskId(opts.mask), spec, dec = parseInt(opts.decimals, 10);
    if (isNaN(dec)) dec = 2;
    dec = Math.max(0, Math.min(8, dec));
    var us = norm(opts.numberFormat).indexOf('1,234.56') !== -1 || norm(opts.numberFormat) === 'us';
    var CNPJ_A = 'AA.AAA.AAA/AAAA-00';
    switch (id) {
      case 'cpf': spec = simple(id, '000.000.000-00', { validate: validCPF }); break;
      case 'cnpj':
        spec = opts.alpha ? simple(id, CNPJ_A, { letterCase: 'upper', validate: validCNPJ })
                          : simple(id, '00.000.000/0000-00', { validate: validCNPJ });
        break;
      case 'cpf_cnpj':
        spec = opts.alpha
          ? simple(id, [['000.000.000-00'], [CNPJ_A]], { letterCase: 'upper' })
          : simple(id, ['000.000.000-00', '00.000.000/0000-00']);
        spec.validate = function (r) { return r.length === 11 ? validCPF(r) : validCNPJ(r); };
        break;
      case 'rg': spec = simple(id, '00.000.000-x'); spec.letterCase = 'upper'; break;
      case 'ie': {
        var uf = String(opts.ieState || '').toUpperCase().match(/[A-Z]{2}/);
        uf = uf && IE[uf[0]] ? uf[0] : '';
        var pats = uf ? [].concat(IE[uf]) : ['00000000000000'.replace(/0/g, '9').replace(/^9/, '0')];
        // "ISENTO" is a legal value for the field; letters switch to that word
        var list = pats.map(function (p) { return [p, null, /[A-Za-z]/]; });
        list.push(['SSSSSS', /^[A-Za-z]/, null]);
        spec = simple(id, list, { letterCase: 'upper' });
        spec.complete = function (raw) { return /^[A-Z]+$/.test(raw) ? raw === 'ISENTO' : null; };
        break;
      }
      case 'phone': {
        var c = findCountry(opts.country) || COUNTRIES[0];
        spec = simple(id, c[3]);
        spec.dial = c[2]; spec.iso = c[0];
        if (c[0] === 'BR') spec.validate = validBRPhone;
        break;
      }
      case 'cep': spec = simple(id, '00000-000'); break;
      case 'postbox': spec = simple(id, 'CP 0999999'); break;
      case 'date': spec = simple(id, '00/00/0000', { validate: validDate }); break;
      case 'time': spec = simple(id, ['00:00', '00:00:00'], { validate: validTime }); break;
      case 'datetime':
        spec = simple(id, '00/00/0000 00:00', { validate: function (r) { return validDate(r.slice(0, 8)) && validTime(r.slice(8)); } });
        break;
      case 'card':
        spec = simple(id, [['0000 000000 00000', /^3[47]/], ['0000 000000 0000', /^3[068]/], ['0000 0000 0000 0000', null, /^3[04678]/]],
          { validate: validLuhn });
        spec.patterns = [entry('0000 000000 00000', /^3[47]/), entry('0000 000000 0000', /^3[068]/),
                         entry('0000 0000 0000 0000', null, /^3[04678]/)];
        break;
      case 'plate': spec = simple(id, 'SSS-0A00', { letterCase: 'upper' }); break;
      case 'pis': spec = simple(id, '000.00000.00-0', { validate: validPIS }); break;
      case 'voter': spec = simple(id, '0000 0000 0000'); break;
      case 'cnh': spec = simple(id, '00000000000'); break;
      case 'pt_postal': spec = simple(id, '0000-000'); break;
      case 'us_zip': spec = simple(id, ['00000', '00000-0000']); break;
      case 'custom': {
        var parts = String(opts.custom == null ? '' : opts.custom).split('|')
          .map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
        var valid = parts.filter(function (s) { return compile(s).cap > 0; });
        if (!valid.length) { spec = { id: 'none', kind: 'none' }; break; }
        valid.sort(function (a, b) { return compile(a).cap - compile(b).cap; });
        spec = simple(id, valid);
        break;
      }
      case 'currency':
      case 'number':
      case 'percent':
        spec = {
          id: id, kind: 'number', decimals: dec, negative: !!opts.negative,
          decimal: us ? '.' : ',', thousands: opts.noThousands ? '' : (us ? ',' : '.'),
          prefix: id === 'currency' ? (String(opts.currency == null ? 'R$' : opts.currency).trim() + ' ').replace(/^ $/, '') : '',
          suffix: id === 'percent' ? '%' : ''
        };
        break;
      default: spec = { id: 'none', kind: 'none' };
    }
    if (spec.kind === 'pattern') {
      var lc = norm(opts.letterCase);
      if (lc.indexOf('mai') === 0 || lc === 'upper') spec.letterCase = 'upper';
      else if (lc.indexOf('min') === 0 || lc === 'lower') spec.letterCase = 'lower';
    }
    return spec;
  }

  function example(spec) {
    if (spec.kind === 'number') {
      var n = spec.prefix + '1' + spec.thousands + '234' + (spec.decimals ? spec.decimal + '56789012'.slice(0, spec.decimals).replace(/./g, function (c, i) { return String((i + 5) % 10); }) : '') + spec.suffix;
      return n;
    }
    if (spec.kind !== 'pattern') return '';
    var e = spec.patterns[spec.patterns.length - 1], out = '';
    // prefer the first (shortest) pattern for a readable hint
    e = spec.patterns[0];
    e.p.tokens.forEach(function (t) {
      if (t.lit !== undefined) out += t.lit;
      else out += (t.cls === 'S' || t.cls === 'A') ? 'A' : '0';
    });
    return out;
  }

  // completeness: every required slot filled for some pattern
  function isComplete(spec, raw) {
    if (!raw) return false;
    if (spec.kind === 'none') return true;
    if (spec.kind === 'number') return /\d/.test(raw);
    var e = pick(spec, raw);
    if (!e) return false;
    if (spec.complete) { var r = spec.complete(raw); if (r !== null && r !== undefined) return r; }
    return raw.length >= e.p.req;
  }
  function isValid(spec, raw, checksum) {
    if (!isComplete(spec, raw)) return false;
    if (checksum !== false && spec.validate) return !!spec.validate(raw);
    return true;
  }

  // Country search helper for the phone selector
  function searchCountries(q) {
    var n = norm(q).replace(/^\+/, '');
    return COUNTRIES.filter(function (c) {
      return !n || norm(c[1]).indexOf(n) !== -1 || c[0].toLowerCase().indexOf(n) === 0 || c[2].indexOf(n) === 0;
    });
  }

  return {
    build: build, edit: edit, parseText: parseText, setRaw: setRaw, format: formatAny,
    isComplete: isComplete, isValid: isValid, example: example, norm: norm, maskId: maskId,
    findCountry: findCountry, countryLabel: countryLabel, searchCountries: searchCountries,
    COUNTRIES: COUNTRIES, MASKS: MASKS, IE: IE
  };
})();

  // ---- shared UI helpers (identical in initialize.js and preview.js) -------
  var MI_CSS = ".mi-host { overflow: visible !important; } .mi-root { position: relative; display: flex; align-items: center; width: 100%; height: 100%; min-width: 0; box-sizing: border-box; font-family: inherit; font-size: inherit; color: inherit; } .mi-root *, .mi-pop * { box-sizing: border-box; } .mi-input { flex: 1 1 auto; min-width: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; box-shadow: none; border-radius: 0; -webkit-appearance: none; appearance: none; font: inherit; font-family: inherit; font-size: inherit; font-weight: inherit; font-style: inherit; letter-spacing: inherit; color: inherit; text-align: inherit; text-decoration: inherit; text-overflow: ellipsis; line-height: normal; } .mi-input::placeholder { color: var(--mi-ph, #94a3b8); opacity: 1; } .mi-input::-ms-input-placeholder { color: var(--mi-ph, #94a3b8); } .mi-input:disabled { cursor: not-allowed; opacity: 1; -webkit-text-fill-color: currentColor; } .mi-input:-webkit-autofill, .mi-input:-webkit-autofill:hover, .mi-input:-webkit-autofill:focus { -webkit-text-fill-color: var(--mi-color, inherit) !important; caret-color: var(--mi-color, auto); transition: background-color 600000s 0s, color 600000s 0s; } .mi-cc { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; height: 100%; margin: 0 8px 0 0; padding: 0 8px 0 0; border: 0; border-right: 1px solid var(--mi-sep, rgba(148,163,184,.45)); border-radius: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; white-space: nowrap; } .mi-cc:disabled { cursor: not-allowed; } .mi-cc .mi-dial { font-size: .92em; opacity: .85; } .mi-cc svg { flex: 0 0 auto; opacity: .6; } .mi-flag { width: 20px; height: 15px; flex: 0 0 auto; object-fit: cover; border-radius: 2px; display: inline-block; } .mi-flag-txt { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 15px; font-size: 9px; font-weight: 700; border-radius: 2px; background: rgba(148,163,184,.3); } .mi-pop { position: fixed; z-index: 2147483647; display: flex; flex-direction: column; min-width: 260px; max-height: 320px; overflow: hidden; background: var(--mi-pop-bg, #fff); color: var(--mi-pop-fg, #1e293b); border: 1px solid rgba(148,163,184,.4); border-radius: 10px; box-shadow: 0 12px 32px rgba(15,23,42,.18); font-family: inherit; font-size: 14px; } .mi-pop-search { flex: 0 0 auto; margin: 8px; padding: 8px 10px; border: 1px solid rgba(148,163,184,.45); border-radius: 8px; outline: 0; background: transparent; color: inherit; font: inherit; } .mi-pop-list { flex: 1 1 auto; overflow-y: auto; margin: 0; padding: 0 4px 6px; list-style: none; } .mi-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; } .mi-opt:hover, .mi-opt.mi-active { background: var(--mi-pop-hover, #f1f5f9); } .mi-opt.mi-sel { font-weight: 600; } .mi-opt .mi-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .mi-opt .mi-dial { opacity: .65; } .mi-empty { padding: 12px; text-align: center; opacity: .6; } .mi-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; padding: 10px 18px; border-radius: 10px; background: #16a34a; color: #fff; font: 600 14px/1.3 inherit; font-family: inherit; box-shadow: 0 8px 24px rgba(0,0,0,.18); pointer-events: none; opacity: 1; transition: opacity .3s ease; } .mi-toast.mi-out { opacity: 0; }";
  function miEnsureStyle() {
    try {
      if (document.getElementById('mi-style-v1')) return;
      var s = document.createElement('style');
      s.id = 'mi-style-v1';
      s.appendChild(document.createTextNode(MI_CSS));
      document.head.appendChild(s);
    } catch (e) {}
  }
  function miBlank(v) { return v == null || String(v).trim() === ''; }
  function miOpts(p, country) {
    var mask = !miBlank(p.dynamic_mask_type) ? p.dynamic_mask_type : p.mask_type;
    if (MI.maskId(mask) === 'none' && !miBlank(p.custom_mask)) mask = 'Personalizada';
    return {
      mask: mask, custom: p.custom_mask, ieState: p.ie_state,
      country: country || (!miBlank(p.dynamic_country) ? p.dynamic_country : p.default_country),
      alpha: !!p.cnpj_alpha, decimals: p.decimals, numberFormat: p.number_format,
      currency: p.currency_symbol, negative: !!p.allow_negative,
      noThousands: p.thousands_separator === false, letterCase: p.letter_case
    };
  }
  function miColor(v, fallback) {
    var s = (v == null) ? '' : String(v).trim();
    return (!s || s.toLowerCase() === 'none') ? fallback : s;
  }
  // Makes the canvas fill the element and centre its content vertically.
  // When the element has a fixed height but Bubble's canvas does not stretch to
  // it, the canvas is sized to the element's content box explicitly.
  function miLayout(canvas, host) {
    canvas.css({ width: '100%', height: '100%', display: 'flex', 'align-items': 'center' });
    try {
      if (host) {
        var cs = window.getComputedStyle(host);
        var h = host.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        if (h > 0 && canvas[0].offsetHeight < h - 1) canvas.css('height', h + 'px');
      }
    } catch (e) {}
  }
  // Editor preview: the canvas Bubble gives the preview does not always stretch
  // to the element, so the content is pinned to the element's box (inside its
  // padding) and centred, whatever height the canvas ends up with.
  function miLayoutPreview(canvas, root) {
    var el = canvas[0], host = el ? el.parentElement : null;
    // normally the element's own box; one level up only if that one is collapsed
    if (host && host.clientHeight < 2 && host.parentElement) host = host.parentElement;
    canvas.css({ width: '100%', display: 'flex', 'align-items': 'center' });
    if (!host) return;
    try {
      var cs = window.getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
      root.css({
        position: 'absolute', width: 'auto', height: 'auto',
        top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft
      });
    } catch (e) {}
  }
  // Individual padding (px) on top of the one Bubble applies; blank = none.
  function miPad(root, p) {
    var map = { top: p.padding_top, right: p.padding_right, bottom: p.padding_bottom, left: p.padding_left };
    Object.keys(map).forEach(function (k) {
      var n = parseFloat(map[k]);
      root.style['padding' + k.charAt(0).toUpperCase() + k.slice(1)] = (isFinite(n) && n >= 0) ? n + 'px' : '';
    });
  }
  var MI_SYSTEM_FONTS = /^(arial|helvetica|times|georgia|verdana|tahoma|trebuchet|courier|system-ui|sans-serif|serif|monospace|segoe|-apple)/i;
  function seg0(ff) {
    var s = String(ff == null ? '' : ff).split('::').filter(function (x) { return x.trim() !== ''; })[0] || '';
    return s.split(':')[0].replace(/["']/g, '').trim();
  }
  // The editor does not always have the chosen Google font loaded; ask for it
  // once (a stylesheet request to fonts.googleapis.com) so the text matches.
  function miLoadFont(name) {
    try {
      if (!name || name.indexOf(',') !== -1 || !/^[A-Za-z0-9 ]+$/.test(name) || MI_SYSTEM_FONTS.test(name)) return;
      var id = 'mi-font-' + name.toLowerCase().replace(/\s+/g, '-');
      if (document.getElementById(id)) return;
      var l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@300;400;500;600;700&display=swap';
      document.head.appendChild(l);
    } catch (e) {}
  }
  // Copies the typography chosen in the Bubble editor onto the input. The
  // values come from properties.bubble (runtime and, when exposed, preview).
  // A value that already equals what the element container computes becomes
  // "inherit", so hover / pressed styles Bubble applies to the container keep
  // flowing through to the text.
  function miStyle(input, host, properties) {
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
    function put(prop, value) {
      input.style[prop] = '';
      if (value == null || value === '') return;
      try {
        input.style[prop] = value;
        if (host && window.getComputedStyle(host)[prop] === window.getComputedStyle(input)[prop]) input.style[prop] = 'inherit';
      } catch (e) {}
    }
    var ff = get('font_face'), fs = get('font_size'), al = get('alignment'), weight = null;
    var family = null;
    if (ff != null && String(ff).trim() !== '') {
      var seg = String(ff).split('::').filter(function (s) { return s.trim() !== ''; })[0] || '';
      var m = seg.match(/^(.*?):(\d{3})/);
      if (m) { seg = m[1]; weight = m[2]; } else seg = seg.split(':')[0];
      seg = seg.trim().replace(/["']/g, '');
      if (seg) family = (seg.indexOf(',') !== -1) ? seg : '"' + seg + '", system-ui, sans-serif';
    }
    if (!family && host) {
      // nothing from Bubble: never fall back to the browser's default serif
      try { if (/^"?times/i.test(window.getComputedStyle(host).fontFamily)) family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; } catch (e) {}
    }
    put('fontFamily', family);
    input.setAttribute('data-mi-font', ff == null ? '' : String(ff));
    if (family && properties.load_google_font !== false) miLoadFont(seg0(ff));
    put('fontSize', (fs != null && fs !== '' && isFinite(parseFloat(fs))) ? parseFloat(fs) + 'px' : null);
    put('color', miColor(get('font_color'), ''));
    put('fontWeight', get('bold') === true ? '700' : weight);
    put('fontStyle', get('italic') === true ? 'italic' : null);
    put('textDecoration', get('underline') === true ? 'underline' : null);
    put('textAlign', (al === 'left' || al === 'center' || al === 'right') ? al : null);
    try { input.style.setProperty('--mi-color', window.getComputedStyle(input).color); } catch (e) {}
  }
  function miFlag(iso, show) {
    var span = document.createElement('span');
    span.style.display = 'inline-flex';
    function txt() {
      var t = document.createElement('span');
      t.className = 'mi-flag-txt'; t.textContent = iso;
      return t;
    }
    if (show === false || !iso) { span.appendChild(txt()); return span; }
    var img = document.createElement('img');
    img.className = 'mi-flag'; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = 'https://flagcdn.com/w40/' + String(iso).toLowerCase() + '.png';
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(txt(), img); };
    span.appendChild(img);
    return span;
  }
  var MI_CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function miDigitsOnly(spec) {
    if (spec.kind !== 'pattern') return false;
    return spec.patterns.every(function (e) {
      return e.p.slots.every(function (t) { return t.cls === '0' || t.cls === '9'; });
    });
  }
  function miInputMode(spec) {
    if (spec.kind === 'number') return spec.negative ? 'text' : (spec.decimals > 0 ? 'decimal' : 'numeric');
    if (spec.id === 'phone') return 'tel';
    return miDigitsOnly(spec) ? 'numeric' : 'text';
  }
  var MI_AUTO = { phone: 'tel-national', cep: 'postal-code', pt_postal: 'postal-code', us_zip: 'postal-code', card: 'cc-number' };
  function miAutocomplete(label, spec) {
    var n = MI.norm(label);
    if (!n || n === 'automatico') return MI_AUTO[spec.id] || 'on';
    var m = String(label).match(/\(([a-z0-9\-]+)\)\s*$/i);
    return m ? m[1].toLowerCase() : 'on';
  }
  function miBuildCC(btn, spec, showFlag) {
    btn.empty();
    var c = null, i;
    for (i = 0; i < MI.COUNTRIES.length; i++) if (MI.COUNTRIES[i][0] === spec.iso) c = MI.COUNTRIES[i];
    if (!c) c = MI.COUNTRIES[0];
    btn[0].appendChild(miFlag(c[0], showFlag));
    var dial = document.createElement('span');
    dial.className = 'mi-dial'; dial.textContent = '+' + c[2];
    btn[0].appendChild(dial);
    btn.append(MI_CHEVRON);
    btn.attr('aria-label', c[1] + ' +' + c[2]);
  }

  miEnsureStyle();
  var host = instance.canvas[0] ? instance.canvas[0].parentElement : null;
  var country = MI.findCountry(!miBlank(properties.dynamic_country) ? properties.dynamic_country : properties.default_country) || MI.COUNTRIES[0];
  var spec = MI.build(miOpts(properties, country[0]));

  var root = $('<div class="mi-root"></div>');
  miPad(root[0], properties);
  if (spec.id === 'phone' && properties.show_country_selector) {
    var cc = $('<button type="button" class="mi-cc" tabindex="-1"></button>');
    miBuildCC(cc, spec, properties.show_flag !== false);
    root.append(cc);
  }
  var input = $('<input class="mi-input" type="text" readonly tabindex="-1" />');
  var init = miBlank(properties.initial_content) ? '' : String(properties.initial_content);
  input.val(init ? MI.parseText(spec, init).text : '');
  var ph = !miBlank(properties.placeholder) ? String(properties.placeholder)
         : (properties.use_mask_example ? MI.example(spec) : '');
  if (ph) input.attr('placeholder', ph);
  input.prop('disabled', !!properties.disabled);
  root[0].style.setProperty('--mi-ph', miColor(properties.placeholder_color, '#94a3b8'));
  root.append(input);
  instance.canvas.addClass('mi-host').empty().append(root);
  miLayoutPreview(instance.canvas, root);
  miStyle(input[0], host, properties);
}
