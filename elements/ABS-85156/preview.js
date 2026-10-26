function(instance, properties) {
  var ph = (properties && properties.placeholder) ? properties.placeholder : 'Selecione uma opção…';
  var wrap = $('<div></div>').css({
    width: '100%', height: '100%',
    display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
    padding: '0 12px', 'box-sizing': 'border-box',
    'font-family': 'inherit', 'font-size': 'inherit',
    color: '#94a3b8', overflow: 'hidden'
  });
  var label = $('<span></span>').css({
    overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap'
  }).text(ph);
  var arrow = $('<span aria-hidden="true"></span>').css({
    display: 'inline-flex', 'margin-left': '8px', color: '#64748b', flex: '0 0 auto'
  }).html('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>');
  wrap.append(label, arrow);
  instance.canvas.empty().append(wrap);
}
