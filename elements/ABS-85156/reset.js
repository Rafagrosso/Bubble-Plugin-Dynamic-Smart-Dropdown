function(instance, context) {
  // Bubble calls this for "Reset relevant inputs": go back to the default
  // value, the way a native input does, instead of emptying the selection.
  if (instance.data && instance.data.resetToDefault) {
    instance.data.resetToDefault(true);
  }
}