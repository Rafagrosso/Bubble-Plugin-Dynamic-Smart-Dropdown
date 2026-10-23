function(instance, properties, context) {
  var d = instance.data;
  if (!d || !d.lookupCEP) return;
  var raw = d.state.raw;
  if (d.spec.id !== 'cep' || raw.length !== 8) return;
  d.lookupCEP(raw, /brasil/i.test(String(properties.provider || '')) ? 'brasilapi' : 'viacep');
}
