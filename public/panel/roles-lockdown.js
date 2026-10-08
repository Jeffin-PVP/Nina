(() => {
    const API = "/api/panel";
    let guildId = null;
    let overview = null;
    let loading = false;

    const $ = selector => document.querySelector(selector);
    const escapeHtml = value => {
        const element = document.createElement("span");
        element.textContent = value ?? "";
        return element.innerHTML;
    };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const match = url.match(/\/guilds\/(\d+)(?:\/|$)/);
        if (match) guildId = match[1];
        return nativeFetch(input, options);
    };

    async function api(path, options = {}) {
        const token = localStorage.getItem("nina_panel_token");
        const response = await nativeFetch(`${API}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {})
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
        return data;
    }

    function toast(message, failed = false) {
        const element = $("#toast");
        if (!element) return;
        element.textContent = message;
        element.className = `toast show${failed ? " bad" : ""}`;
        setTimeout(() => { element.className = "toast"; }, 3000);
    }

    function addNavigation() {
        const sidebar = $(".sidebar");
        const content = $(".content");
        if (!sidebar || !content || $("#secao-cargos-lockdown")) return;

        const nav = document.createElement("button");
        nav.className = "nav-item";
        nav.dataset.section = "cargos-lockdown";
        nav.innerHTML = '<span class="nav-icon"><img src="icons/cadeado.svg?v=5" alt=""></span> Cargos & Lockdown';
        $(".nav-item[data-section='autorole']")?.insertAdjacentElement("afterend", nav);
        nav.addEventListener("click", () => {
            $$(".nav-item").forEach(item => item.classList.toggle("active", item === nav));
            $$(".section").forEach(section => section.classList.toggle("hidden", section.id !== "secao-cargos-lockdown"));
            $("#sidebar")?.classList.remove("open");
            load();
        });

        const section = document.createElement("section");
        section.id = "secao-cargos-lockdown";
        section.className = "section hidden";
        section.innerHTML = `
            <div class="section-head"><div><div class="eyebrow">CONFIGURAÇÃO</div><h2>Cargos & Lockdown</h2><p>Gerencie cargos por botão/reação e bloqueie o servidor em poucos cliques.</p></div></div>
            <div class="panel">
                <h3>Cargos por botão</h3>
                <div class="grid-3">
                    <div class="field"><label>Cargo</label><select id="rl-role"></select></div>
                    <div class="field"><label>Texto do botão</label><input id="rl-label" maxlength="80" placeholder="Ex.: Jogos"></div>
                    <div class="field"><label>Emoji (opcional)</label><input id="rl-emoji" maxlength="100" placeholder="🎮"></div>
                </div>
                <div class="form-actions"><button id="rl-add-role" class="btn secondary">Adicionar cargo</button><span id="rl-status" class="feedback"></span></div>
                <div id="rl-role-list" class="list"></div>
                <div class="divider"></div>
                <h3>Publicar painel de botões</h3>
                <div class="grid-3">
                    <div class="field"><label>Canal</label><select id="rl-panel-channel"></select></div>
                    <div class="field"><label>Título</label><input id="rl-panel-title" maxlength="256" value="Escolha seus cargos"></div>
                    <div class="field"><label>Descrição</label><input id="rl-panel-description" maxlength="2000" value="Clique em um botão para escolher ou remover um cargo."></div>
                </div>
                <div class="form-actions"><button id="rl-publish" class="btn primary">Publicar painel</button></div>
            </div>
            <div class="panel">
                <h3>Cargos por reação</h3>
                <p>Ao adicionar uma regra, a Nina coloca a reação na mensagem selecionada.</p>
                <div class="grid-3">
                    <div class="field"><label>Canal</label><select id="rr-channel"></select></div>
                    <div class="field"><label>ID da mensagem</label><input id="rr-message" inputmode="numeric" placeholder="ID da mensagem"></div>
                    <div class="field"><label>Emoji</label><input id="rr-emoji" maxlength="100" placeholder="✅"></div>
                    <div class="field"><label>Cargo</label><select id="rr-role"></select></div>
                </div>
                <div class="form-actions"><button id="rr-add" class="btn secondary">Adicionar regra</button></div>
                <div id="rr-list" class="list"></div>
            </div>
            <div class="panel">
                <h3>Lockdown</h3>
                <p>Bloqueia mensagens em canais de texto e conexão em canais de voz. Cargos permitidos mantêm acesso; cargos negados perdem a visibilidade. Administradores mantêm acesso pelo bypass do Discord.</p>
                <div class="setting"><div><b>Sistema ativado</b><small>Permite iniciar o lockdown pelo comando ou pelo painel.</small></div><label class="switch"><input id="ld-enabled" type="checkbox"><i></i></label></div>
                <div class="grid-2">
                    <div class="field"><label>Canais específicos</label><select id="ld-channels" multiple size="8"></select></div>
                    <div class="field"><label>Categorias inteiras</label><select id="ld-categories" multiple size="8"></select></div>
                    <div class="field"><label>Cargos com acesso</label><select id="ld-allowed" multiple size="8"></select></div>
                    <div class="field"><label>Cargos sem acesso</label><select id="ld-denied" multiple size="8"></select></div>
                </div>
                <div class="form-actions">
                    <button id="ld-save" class="btn secondary">Salvar configuração</button>
                    <button id="ld-lock" class="btn danger">Trancar canais</button>
                    <button id="ld-unlock" class="btn primary">Destrancar e restaurar</button>
                    <span id="ld-state" class="feedback"></span>
                </div>
            </div>`;
        content.appendChild(section);

        $("#rl-add-role").addEventListener("click", addButtonRole);
        $("#rl-publish").addEventListener("click", publishPanel);
        $("#rr-add").addEventListener("click", addReactionRole);
        $("#ld-save").addEventListener("click", saveLockdown);
        $("#ld-lock").addEventListener("click", () => runLockdown("lock"));
        $("#ld-unlock").addEventListener("click", () => runLockdown("unlock"));
    }

    function addFeatureCommands() {
        const grid = $("#commands-grid");
        if (!grid || grid.querySelector("[data-lockdown-command-list]")) return;
        const group = document.createElement("div");
        group.className = "command-group";
        group.dataset.lockdownCommandList = "true";
        const title = document.createElement("h3");
        title.textContent = "Cargos & Lockdown";
        const list = document.createElement("div");
        for (const command of [
            "/autorole selfrole adicionar",
            "/autorole selfrole remover",
            "/autorole selfrole painel",
            "/autorole reacao adicionar",
            "/autorole reacao remover",
            "/autorole reacao listar",
            "/lockdown iniciar",
            "/lockdown encerrar",
            "/lockdown status"
        ]) {
            const code = document.createElement("code");
            code.textContent = command;
            list.appendChild(code);
        }
        group.append(title, list);
        grid.appendChild(group);
    }

    function $$(selector) {
        return [...document.querySelectorAll(selector)];
    }

    function fillSelect(selector, entries, selected = []) {
        const element = $(selector);
        if (!element) return;
        const selectedIds = new Set(selected);
        element.innerHTML = entries.map(entry =>
            `<option value="${escapeHtml(entry.id)}"${selectedIds.has(entry.id) ? " selected" : ""}>${escapeHtml(entry.name)}</option>`
        ).join("");
    }

    function selectedValues(selector) {
        return [...$(selector).selectedOptions].map(option => option.value);
    }

    function feedback(message, failed = false) {
        const element = $("#rl-status");
        element.textContent = message;
        element.className = `feedback ${failed ? "bad" : "ok"}`;
    }

    async function addButtonRole() {
        try {
            const roleId = $("#rl-role").value;
            if (!roleId) throw new Error("Selecione um cargo.");
            await api(`/guilds/${guildId}/autorole/selfroles`, {
                method: "POST",
                body: {
                    roleId,
                    label: $("#rl-label").value.trim() || undefined,
                    emoji: $("#rl-emoji").value.trim() || null
                }
            });
            $("#rl-label").value = "";
            $("#rl-emoji").value = "";
            feedback("Cargo adicionado.");
            await load();
        } catch (error) {
            feedback(error.message, true);
        }
    }

    async function publishPanel() {
        try {
            const channelId = $("#rl-panel-channel").value;
            if (!channelId) throw new Error("Selecione o canal onde o painel será publicado.");
            await api(`/guilds/${guildId}/autorole/selfroles/panel`, {
                method: "POST",
                body: {
                    channelId,
                    title: $("#rl-panel-title").value.trim(),
                    description: $("#rl-panel-description").value.trim()
                }
            });
            toast("Painel de botões publicado.");
        } catch (error) {
            toast(error.message, true);
        }
    }

    async function addReactionRole() {
        try {
            const body = {
                channelId: $("#rr-channel").value,
                messageId: $("#rr-message").value.trim(),
                emoji: $("#rr-emoji").value.trim(),
                roleId: $("#rr-role").value
            };
            if (Object.values(body).some(value => !value)) throw new Error("Preencha canal, mensagem, emoji e cargo.");
            await api(`/guilds/${guildId}/autorole/reactions`, { method: "POST", body });
            $("#rr-message").value = "";
            $("#rr-emoji").value = "";
            toast("Regra de reação adicionada.");
            await load();
        } catch (error) {
            toast(error.message, true);
        }
    }

    async function saveLockdown() {
        try {
            const body = {
                enabled: $("#ld-enabled").checked,
                channelIds: selectedValues("#ld-channels"),
                categoryIds: selectedValues("#ld-categories"),
                allowedRoleIds: selectedValues("#ld-allowed"),
                deniedRoleIds: selectedValues("#ld-denied")
            };
            const config = await api(`/guilds/${guildId}/lockdown`, { method: "POST", body });
            renderLockdown(config);
            toast("Configuração de lockdown salva.");
        } catch (error) {
            toast(error.message, true);
        }
    }

    async function runLockdown(action) {
        try {
            const result = await api(`/guilds/${guildId}/lockdown/${action}`, { method: "POST", body: {} });
            renderLockdown(result.config);
            toast(action === "lock" ? "Lockdown iniciado." : "Canais restaurados.");
        } catch (error) {
            toast(error.message, true);
        }
    }

    function renderLockdown(config) {
        $("#ld-enabled").checked = !!config.enabled;
        $("#ld-state").textContent = config.active ? "LOCKDOWN ATIVO" : "Lockdown inativo";
        $("#ld-state").className = `feedback ${config.active ? "bad" : "ok"}`;
        $("#ld-lock").disabled = !config.enabled || !!config.active;
        $("#ld-unlock").disabled = !config.active;
        $("#ld-enabled").disabled = !!config.active;
        ["#ld-channels", "#ld-categories", "#ld-allowed", "#ld-denied", "#ld-save"].forEach(selector => {
            $(selector).disabled = !!config.active;
        });
        fillSelect("#ld-channels", overview.lockdownChannels || [], config.channel_ids || []);
        fillSelect("#ld-categories", overview.categories || [], config.category_ids || []);
        fillSelect("#ld-allowed", overview.roles || [], config.allowed_role_ids || []);
        fillSelect("#ld-denied", overview.roles || [], config.denied_role_ids || []);
    }

    async function load() {
        if (loading || !guildId || !$("#secao-cargos-lockdown")) return;
        loading = true;
        try {
            const [nextOverview, selfRoles, lockdown] = await Promise.all([
                api(`/guilds/${guildId}/overview`),
                api(`/guilds/${guildId}/autorole/selfroles`),
                api(`/guilds/${guildId}/lockdown`)
            ]);
            overview = nextOverview;
            const textChannels = (overview.lockdownChannels || []).filter(channel => [0, 5].includes(channel.type));
            fillSelect("#rl-role", overview.roles);
            fillSelect("#rr-role", overview.roles);
            fillSelect("#rl-panel-channel", textChannels);
            fillSelect("#rr-channel", textChannels);
            $("#rl-role-list").innerHTML = selfRoles.roles.length
                ? selfRoles.roles.map(role => `<div class="list-row"><div><b>${escapeHtml(role.label)}</b><small>${escapeHtml(overview.roles.find(item => item.id === role.role_id)?.name || role.role_id)}</small></div><button class="btn danger" data-remove-role="${escapeHtml(role.role_id)}">Remover</button></div>`).join("")
                : '<div class="empty">Nenhum cargo de botão configurado.</div>';
            $$("[data-remove-role]").forEach(button => button.addEventListener("click", async () => {
                try {
                    await api(`/guilds/${guildId}/autorole/selfroles/${button.dataset.removeRole}`, { method: "DELETE" });
                    await load();
                } catch (error) { toast(error.message, true); }
            }));
            $("#rr-list").innerHTML = selfRoles.reactions.length
                ? selfRoles.reactions.map(rule => {
                    const channelName = overview.lockdownChannels.find(item => item.id === rule.channel_id)?.name || rule.channel_id;
                    const roleName = overview.roles.find(item => item.id === rule.role_id)?.name || rule.role_id;
                    return `<div class="list-row"><div><b>Regra #${rule.id} · ${escapeHtml(rule.emoji_key.replace(/^(custom|unicode):/, ""))}</b><small>#${escapeHtml(channelName)} · ${escapeHtml(roleName)} · mensagem ${escapeHtml(rule.message_id)}</small></div><button class="btn danger" data-remove-reaction="${rule.id}">Remover</button></div>`;
                }).join("")
                : '<div class="empty">Nenhum cargo por reação configurado.</div>';
            $$("[data-remove-reaction]").forEach(button => button.addEventListener("click", async () => {
                try {
                    await api(`/guilds/${guildId}/autorole/reactions/${button.dataset.removeReaction}`, { method: "DELETE" });
                    await load();
                } catch (error) { toast(error.message, true); }
            }));
            renderLockdown(lockdown);
        } catch (error) {
            toast(error.message, true);
        } finally {
            loading = false;
        }
    }

    addNavigation();
    const commandGrid = $("#commands-grid");
    if (commandGrid) {
        new MutationObserver(addFeatureCommands).observe(commandGrid, { childList: true });
        addFeatureCommands();
    }
})();
