function(instance, properties, context) {
    if (instance.data.searchbox) instance.data.searchbox.val(null).trigger("change");
    instance.publishState('selected', null);
    if(!properties.quiet_reset){
        instance.triggerEvent('searchbox_value_is_changed');
    }
}