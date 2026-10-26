function(instance, properties, context) {
  if (instance.data && instance.data.clearSelection) {
    instance.data.clearSelection(!properties.quiet_reset);
    return;
  }
  instance.publishState('selected', null);
  instance.publishState('selected_list', []);
  if (!properties.quiet_reset) {
    instance.triggerEvent('searchbox_value_is_changed');
  }
}
