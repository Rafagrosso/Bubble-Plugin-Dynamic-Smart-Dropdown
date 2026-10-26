function(instance, properties, context) {
  var d = instance.data;
  if (d && d.clearValue) d.clearValue(!properties.quiet);
}
