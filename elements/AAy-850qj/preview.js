function(instance, properties, context) {
    if (!instance.data.inizialized || !instance.data.searchbox) return;

    if (typeof $.fn.select2 !== "function") {
        console.warn("[SmartDropdown] Select2 ainda não disponível.");
        return;
    }

    // Estilos
    const el_height = instance.canvas.height();
    const fontStyle = properties.bubble.font_face().split('::').join('');
    const fontSize = properties.bubble.font_size() + 'px';
    const fontColor = properties.bubble.font_color();

    instance.canvas.css('--sb-ff', fontStyle);
    instance.canvas.css('--sb-fs', fontSize);
    instance.canvas.css('--sb-fc', fontColor);

    // Lista de dados
    let search_list = [];
    if (properties.search_list && properties.search_list.length() > 0)
        search_list = properties.search_list.get(0, properties.search_list.length());

    const props = search_list[0] ? search_list[0].listProperties() : [];
    const data = search_list.map(e => ({
        id: props.includes('_id') ? e.get('_id') : e.get(properties.id || 'display'),
        text: instance.data.createCaption(properties, e),
        original: e
    }));

    // Reinicia Select2
    if (instance.data.searchbox.hasClass("select2-hidden-accessible")) {
        instance.data.searchbox.select2("destroy");
        instance.data.searchbox.html("");
    }

    // Configuração Select2
    const config = {
        data: data,
        placeholder: { id: '-1', text: properties.placeholder || '' },
        allowClear: false,
        width: '100%',
        dropdownParent: $("body"),
        closeOnSelect: false,
        minimumResultsForSearch: 0
    };

    instance.data.searchbox.select2(config);

    // Garante centralização perfeita
    const select2Container = instance.data.searchbox.next('.select2');
    select2Container.css({
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });

    select2Container.find('.select2-selection__rendered').css({
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
    });

    // Valor padrão
    if (properties.default_value) {
        let idx = null;
        if (properties.id) idx = properties.default_value.get(properties.id);
        if (!idx) idx = properties.default_value.get('_id');
        if (idx) {
            instance.data.searchbox.val(idx).trigger("change");
            instance.publishState("selected", properties.default_value);
        }
    }

    // Fecha ao selecionar
    instance.data.searchbox.off("select2:select").on("select2:select", function(e) {
        const data = e.params.data;
        instance.publishState("selected", data.original);
        instance.triggerEvent("searchbox_value_is_changed");
        instance.data.searchbox.select2("close");
    });

    // Mantém aberto ao clicar
    select2Container.off("click").on("click", function(e) {
        const s2 = instance.data.searchbox.data("select2");
        if (!s2.isOpen()) instance.data.searchbox.select2("open");
        e.stopPropagation();
    });

    // Fecha ao clicar fora
    $(document).off("mousedown." + instance.data.uniqueId);
    $(document).on("mousedown." + instance.data.uniqueId, function(e) {
        const inside = $(e.target).closest(".select2-container, .smart-dropdown").length;
        if (!inside) {
            const s2 = instance.data.searchbox.data("select2");
            if (s2 && s2.isOpen()) instance.data.searchbox.select2("close");
        }
    });

    console.log(`[SmartDropdown] Update concluído (${data.length} opções).`);
}
