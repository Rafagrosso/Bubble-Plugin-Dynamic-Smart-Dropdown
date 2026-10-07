function(instance, context) {
  // Bubble calls this for "Reset relevant inputs": back to the initial
  // content, like a native input (it does not write to the database).
  if (instance.data && instance.data.resetToInitial) instance.data.resetToInitial();
}
