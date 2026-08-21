function(instance, properties, context) {

    if (!instance.data.inizialized || !instance.data.searchbox) return;
    if (!$.fn.select2) return;

    try {
        const ff = properties.bubble.font_face().split("::").join("");
        instance.canvas.css('--sb-ff', ff);
        instance.canvas.css('--sb-fs', properties.bubble.font_size() + "px");
        instance.canvas.css('--sb-fc', properties.bubble.font_color());
    } catch(e){}

    let search_list = [];
    if (properties.search_list?.length() > 0)
        search_list = properties.search_list.get(0, properties.search_list.length());

    const props = search_list[0] ? search_list[0].listProperties() : [];

    const data = search_list.map(e => ({
        id: props.includes("_id") ? e.get("_id") : e.get(properties.id || "display"),
        text: instance.data.createCaption(properties, e),
        original: e
    }));

    if (instance.data.searchbox.hasClass("select2-hidden-accessible")) {
        instance.data.searchbox.select2("destroy");
        instance.data.searchbox.html("");
    }

    const config = {
        data: data,
        width: "100%",
        dropdownParent: $(document.body),
        allowClear: false,
        placeholder: properties.placeholder || "",
        closeOnSelect: true
    };

    instance.data.searchbox.val(null);
    instance.data.searchbox.select2(config);

    if (properties.default_value) {
        let id = properties.default_value.get(properties.id) || properties.default_value.get("_id");
        instance.data.searchbox.val(id).trigger("change");
        instance.publishState("selected", properties.default_value);
    } else {
        instance.data.searchbox.val(null).trigger("change");
        instance.publishState("selected", null);
    }

    const h = instance.canvas.height();
    instance.data.searchbox.next(".select2")
        .find(".select2-selection__rendered")
        .css("line-height", h + "px");

    instance.data.searchbox.off("select2:select").on("select2:select", e => {
        instance.publishState("selected", e.params.data.original);
        instance.triggerEvent("searchbox_value_is_changed");
    });

    instance.data.searchbox.off("select2:open").on("select2:open", () => {});

    $(document)
        .off("mousedown.smartdropdown_" + instance.instanceid)
        .on("mousedown.smartdropdown_" + instance.instanceid, ev => {
            if ($(ev.target).closest(".select2-container,.smart-dropdown").length === 0) {
                instance.data.searchbox.select2("close");
            }
        });
}
