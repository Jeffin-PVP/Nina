// Seção "Inteligência Artificial" do painel web.
// Recebe do app.js: { guildId, api, toast, feedback, esc }.
(() => {
    const $ = selector => document.querySelector(selector);
    let ctx = null;
    let data = null;

    const sourceText = feature => {
        if (!data.enabled) return "desligada";
        const key = data.mode === "custom" ? data.keys[data.scope === "per_feature" ? feature : "all"] : null;
        if (!key) return "API padrão da Nina";
        const provider = data.providers[key.provider]?.label || key.provider;
        return `sua API (${provider}${key.model ? ` · ${key.model}` : ""} · …${key.last4})`;
    };

    function render() {
        const custom = data.mode === "custom";
        const perFeature = data.scope === "per_feature";
        const canKeys = data.canManageKeys;

        $("#ia-enabled").checked = data.enabled;
        $("#ia-mode").value = data.mode;
        $("#ia-scope").value = data.scope;
        $("#ia-scope-field").classList.toggle("hidden", !custom);
        $("#ia-keys-panel").classList.toggle("hidden", !custom);
        $("#ia-mode").disabled = !canKeys;
        $("#ia-scope").disabled = !canKeys;
        $("#ia-hint").textContent = canKeys
            ? (custom ? "Com a sua API os limites diários da API padrão não se aplicam e o custo é seu. Função sem chave própria usa a API padrão." : "Usando a API padrão da Nina, com limites diários por usuário e por servidor.")
            : "Só o dono do servidor ou um Administrador pode trocar a API de IA.";

        const features = Object.entries(data.features);
        $("#ia-status").innerHTML = features.map(([id, f]) => {
            const own = data.keys[perFeature ? id : "all"];
            const remove = custom && canKeys && data.keys[id] ? `<button class="btn ghost" data-remove="${ctx.esc(id)}">Remover</button>` : "";
            return `<div class="list-row"><div><b>${ctx.esc(f.label)}</b><small>${ctx.esc(sourceText(id))}</small></div>${remove || (own && custom ? '<span class="pill good">Sua API</span>' : '<span class="pill muted">Padrão</span>')}</div>`;
        }).join("") + (!perFeature && data.keys.all && canKeys ? '<div class="list-row"><div><b>API única</b><small>Vale para todas as funções</small></div><button class="btn ghost" data-remove="all">Remover</button></div>' : "");

        $("#ia-status").querySelectorAll("[data-remove]").forEach(btn => {
            btn.onclick = async () => {
                try {
                    await ctx.api(`/guilds/${ctx.guildId}/ia/keys/${btn.dataset.remove}`, { method: "DELETE" });
                    ctx.toast("API removida.");
                    load(ctx);
                } catch (error) { ctx.toast(error.message, "bad"); }
            };
        });

        const featureSelect = $("#ia-key-feature");
        featureSelect.innerHTML = perFeature
            ? features.map(([id, f]) => `<option value="${ctx.esc(id)}">${ctx.esc(f.label)}</option>`).join("")
            : '<option value="all">Todas as funções</option>';

        $("#ia-key-provider").innerHTML = Object.entries(data.providers).map(([id, p]) => `<option value="${ctx.esc(id)}">${ctx.esc(p.label)}</option>`).join("");
        providerChanged();

        for (const id of ["#ia-key-feature", "#ia-key-provider", "#ia-key-value", "#ia-key-model", "#ia-key-url", "#btn-salvar-ia-key", "#btn-testar-ia"]) {
            $(id).disabled = !canKeys;
        }
    }

    function providerChanged() {
        const provider = data.providers[$("#ia-key-provider").value];
        $("#ia-key-url-field").classList.toggle("hidden", !provider?.needsUrl);
        $("#ia-key-model").placeholder = provider?.model ? `Padrão: ${provider.model}` : "Obrigatório neste provedor";
    }

    async function load(context) {
        ctx = context;
        try {
            data = await ctx.api(`/guilds/${ctx.guildId}/ia`);
            render();
        } catch (error) { ctx.toast(error.message, "bad"); }
    }

    $("#ia-key-provider").onchange = () => data && providerChanged();
    $("#ia-mode").onchange = () => { if (data) { data.mode = $("#ia-mode").value; render(); } };
    $("#ia-scope").onchange = () => { if (data) { data.scope = $("#ia-scope").value; render(); } };

    $("#btn-salvar-ia").onclick = async () => {
        try {
            const body = { enabled: $("#ia-enabled").checked };
            if (data.canManageKeys) { body.mode = $("#ia-mode").value; body.scope = $("#ia-scope").value; }
            await ctx.api(`/guilds/${ctx.guildId}/ia`, { method: "POST", body });
            ctx.feedback("ia-feedback", "Configuração salva!");
            load(ctx);
        } catch (error) { ctx.feedback("ia-feedback", error.message, false); }
    };

    $("#btn-salvar-ia-key").onclick = async () => {
        const button = $("#btn-salvar-ia-key");
        button.disabled = true;
        try {
            await ctx.api(`/guilds/${ctx.guildId}/ia/keys`, {
                method: "POST",
                body: {
                    feature: $("#ia-key-feature").value,
                    provider: $("#ia-key-provider").value,
                    apiKey: $("#ia-key-value").value,
                    model: $("#ia-key-model").value,
                    baseUrl: $("#ia-key-url").value
                }
            });
            $("#ia-key-value").value = "";
            ctx.feedback("ia-key-feedback", "API testada e salva!");
            load(ctx);
        } catch (error) { ctx.feedback("ia-key-feedback", error.message, false); }
        button.disabled = false;
    };

    $("#btn-testar-ia").onclick = async () => {
        try {
            const { results } = await ctx.api(`/guilds/${ctx.guildId}/ia/test`, { method: "POST", body: {} });
            const failed = results.filter(item => !item.ok);
            ctx.toast(failed.length ? `Falhou: ${failed.map(item => `${data.features[item.feature].label} (${item.message})`).join("; ")}` : "Todas as funções responderam.", failed.length ? "bad" : "ok");
        } catch (error) { ctx.toast(error.message, "bad"); }
    };

    window.NinaAI = { load };
})();
