function(instance, properties, context) {
  var d = instance.data;
  if (d && d.setValue) d.setValue(properties.value == null ? '' : String(properties.value), !properties.quiet);
}
