function(instance, properties, context) {
  var d = instance.data;
  if (d && d.focusInput) d.focusInput(!!properties.select_all);
}
