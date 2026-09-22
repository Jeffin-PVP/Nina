(() => {

    const API = "/api/panel";

    let token = localStorage.getItem("nina_panel_token") || null;
    let guildAtual = null; // id do servidor selecionado
    let overviewCache = null; // canais/cargos do servidor atual

    /*
    =========================
        HELPERS DE API
    =========================
    */

    async function api(path, options = {}) {

        const res = await fetch(API + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {})
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {

            fazerLogout();
            throw new Error(data.error || "Sessão expirada.");

        }

        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);

        return data;

    }

    function escapeHtml(str) {

        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;

    }

    /*
    =========================
        TELAS
    =========================
    */

    const telaLogin = document.getElementById("tela-login");
    const telaServidores = document.getElementById("tela-servidores");
    const app = document.getElementById("app");

    function mostrarTela(nome) {

        telaLogin.classList.add("oculto");
        telaServidores.classList.add("oculto");
        app.classList.add("oculto");

        if (nome === "login") telaLogin.classList.remove("oculto");
        if (nome === "servidores") telaServidores.classList.remove("oculto");
        if (nome === "app") app.classList.remove("oculto");

    }

    /*
    =========================
        LOGIN
    =========================
    */

    document.getElementById("btn-entrar-discord").addEventListener("click", async () => {

        try {

            const { url } = await api("/login-url");
            window.location.href = url;

        } catch (error) {

            document.getElementById("login-erro").textContent = error.message;

        }

    });

    function fazerLogout() {

        token = null;
        guildAtual = null;
        localStorage.removeItem("nina_panel_token");
        mostrarTela("login");

    }

    document.getElementById("btn-sair").addEventListener("click", fazerLogout);
    document.getElementById("btn-sair-picker").addEventListener("click", fazerLogout);

    document.getElementById("btn-trocar-servidor").addEventListener("click", () => {

        guildAtual = null;
        mostrarTelaServidores();

    });

    /*
    =========================
        SELEÇÃO DE SERVIDOR
    =========================
    */

    async function mostrarTelaServidores() {

        mostrarTela("servidores");

        const listaEl = document.getElementById("lista-picker");
        listaEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const [{ guilds }, { clientId }] = await Promise.all([
                api("/me"),
                api("/client-id")
            ]);

            if (!guilds.length) {

                listaEl.innerHTML = `<p class="carregando">Você não é administrador em nenhum servidor.</p>`;
                return;

            }

            listaEl.innerHTML = "";

            guilds.forEach(g => {

                const el = document.createElement("div");
                el.className = "picker-item";

                if (g.botPresent) {

                    el.innerHTML = `
                        <img src="${g.icon || ""}" onerror="this.style.visibility='hidden'" alt="" />
                        <div class="servidor-nome">${escapeHtml(g.name)}</div>
                        <button class="btn-primario" data-id="${g.id}">Gerenciar</button>
                    `;

                    el.querySelector("button").addEventListener("click", () => abrirServidor(g.id, g));

                } else {

                    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=8&guild_id=${g.id}`;

                    el.innerHTML = `
                        <img src="${g.icon || ""}" onerror="this.style.visibility='hidden'" alt="" />
                        <div class="servidor-nome">${escapeHtml(g.name)}</div>
                        <a class="btn-secundario" href="${inviteUrl}" target="_blank" rel="noopener">Adicionar bot</a>
                    `;

                }

                listaEl.appendChild(el);

            });

        } catch (error) {

            listaEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    /*
    =========================
        ABRIR SERVIDOR (app)
    =========================
    */

    async function abrirServidor(guildId, guildBasico) {

        guildAtual = guildId;

        mostrarTela("app");

        document.getElementById("guild-icon").src = guildBasico?.icon || "";
        document.getElementById("guild-nome").textContent = guildBasico?.name || "—";

        try {

            overviewCache = await api(`/guilds/${guildId}/overview`);

            document.getElementById("guild-icon").src = overviewCache.icon || "";
            document.getElementById("guild-nome").textContent = overviewCache.name;
            document.getElementById("guild-membros").textContent = `${overviewCache.memberCount.toLocaleString("pt-BR")} membros`;

        } catch (error) {

            alert(error.message);
            return mostrarTelaServidores();

        }

        // sempre recomeça na primeira seção
        document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("ativo"));
        document.querySelector(".nav-item[data-secao='geral']").classList.add("ativo");
        document.querySelectorAll(".secao").forEach(s => s.classList.add("oculto"));
        document.getElementById("secao-geral").classList.remove("oculto");

        carregarGeral();

    }

    /*
    =========================
        NAVEGAÇÃO ENTRE SEÇÕES
    =========================
    */

    document.querySelectorAll(".nav-item").forEach(item => {

        item.addEventListener("click", () => {

            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("ativo"));
            item.classList.add("ativo");

            const alvo = item.dataset.secao;

            document.querySelectorAll(".secao").forEach(s => s.classList.add("oculto"));
            document.getElementById(`secao-${alvo}`).classList.remove("oculto");

            if (alvo === "geral") carregarGeral();
            if (alvo === "automod") carregarAutomod();
            if (alvo === "boasvindas") carregarBoasvindas();
            if (alvo === "autorole") carregarAutorole();
            if (alvo === "logs") carregarLogs();
            if (alvo === "sorteios") carregarSorteios();

        });

    });

    function popularSelectCanais(select, valorAtual) {

        select.innerHTML = `<option value="">— nenhum —</option>` +
            overviewCache.channels.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join("");

        if (valorAtual) select.value = valorAtual;

    }

    /*
    =========================
        GERAL
    =========================
    */

    async function carregarGeral() {

        try {

            const data = await api(`/guilds/${guildAtual}/geral`);

            document.getElementById("toggle-economia").checked = data.economyEnabled;
            document.getElementById("toggle-moderacao").checked = data.moderationEnabled;
            document.getElementById("toggle-levelup").checked = data.levelupEnabled;
            document.getElementById("input-prefixo").value = data.prefix;

        } catch (error) {

            console.error(error);

        }

    }

    document.getElementById("btn-salvar-geral").addEventListener("click", async () => {

        const feedback = document.getElementById("geral-feedback");

        try {

            await api(`/guilds/${guildAtual}/geral`, {
                method: "POST",
                body: {
                    economyEnabled: document.getElementById("toggle-economia").checked,
                    moderationEnabled: document.getElementById("toggle-moderacao").checked,
                    levelupEnabled: document.getElementById("toggle-levelup").checked,
                    prefix: document.getElementById("input-prefixo").value.trim() || "!"
                }
            });

            feedback.textContent = "✅ Salvo!";
            setTimeout(() => (feedback.textContent = ""), 2500);

        } catch (error) {

            feedback.textContent = `❌ ${error.message}`;

        }

    });

    /*
    =========================
        AUTOMOD
    =========================
    */

    const REGRAS_AUTOMOD = [
        {
            key: "spam", label: "💬 Spam de mensagens", enabledField: "spam_enabled", actionsField: "spam_actions",
            params: [
                { field: "spam_max_messages", label: "Máx. mensagens" },
                { field: "spam_interval_seconds", label: "Intervalo (s)" }
            ]
        },
        {
            key: "emoji", label: "😃 Spam de emojis", enabledField: "emoji_enabled", actionsField: "emoji_actions",
            params: [{ field: "emoji_max_count", label: "Máx. emojis" }]
        },
        {
            key: "swear", label: "🤬 Palavrão", enabledField: "swear_enabled", actionsField: "swear_actions",
            params: []
        },
        {
            key: "mention", label: "📣 Spam de menções", enabledField: "mention_enabled", actionsField: "mention_actions",
            params: [{ field: "mention_max_count", label: "Máx. menções" }]
        },
        {
            key: "invite", label: "🔗 Links de convite", enabledField: "invite_enabled", actionsField: "invite_actions",
            params: []
        }
    ];

    let automodConfigAtual = null;

    function renderRegrasAutomod(config) {

        const container = document.getElementById("am-regras");
        container.innerHTML = "";

        REGRAS_AUTOMOD.forEach(regra => {

            const acoesAtuais = String(config[regra.actionsField] || "").split(",");

            const card = document.createElement("div");
            card.className = "regra-card";
            card.dataset.regra = regra.key;

            card.innerHTML = `
                <div class="regra-card-topo">
                    <strong>${regra.label}</strong>
                    <label class="switch">
                        <input type="checkbox" class="am-enabled-field" ${config[regra.enabledField] ? "checked" : ""} />
                        <span></span>
                    </label>
                </div>
                ${regra.params.map(p => `
                    <div class="campo-linha">
                        <label>${p.label}</label>
                        <input type="number" class="am-param-field" data-field="${p.field}" value="${config[p.field]}" style="width:80px" />
                    </div>
                `).join("")}
                <div class="regra-acoes">
                    <label><input type="checkbox" class="am-acao" data-acao="delete" ${acoesAtuais.includes("delete") ? "checked" : ""} /> Apagar</label>
                    <label><input type="checkbox" class="am-acao" data-acao="notify" ${acoesAtuais.includes("notify") ? "checked" : ""} /> Notificar</label>
                    <label><input type="checkbox" class="am-acao" data-acao="warn" ${acoesAtuais.includes("warn") ? "checked" : ""} /> Advertir</label>
                    <label><input type="checkbox" class="am-acao" data-acao="mute" ${acoesAtuais.includes("mute") ? "checked" : ""} /> Mutar</label>
                </div>
            `;

            container.appendChild(card);

        });

    }

    async function carregarAutomod() {

        try {

            automodConfigAtual = await api(`/guilds/${guildAtual}/automod`);

            document.getElementById("am-enabled").checked = !!automodConfigAtual.enabled;
            document.getElementById("am-raid-enabled").checked = !!automodConfigAtual.raid_enabled;
            document.getElementById("am-raid-threshold").value = automodConfigAtual.raid_join_threshold;
            document.getElementById("am-raid-interval").value = automodConfigAtual.raid_interval_seconds;
            document.getElementById("am-raid-action").value = automodConfigAtual.raid_action;
            document.getElementById("am-mute-duracao").value = automodConfigAtual.mute_duration_minutes;

            renderRegrasAutomod(automodConfigAtual);

        } catch (error) {

            console.error(error);

        }

    }

    document.getElementById("btn-salvar-automod").addEventListener("click", async () => {

        const feedback = document.getElementById("automod-feedback");

        const payload = {
            enabled: document.getElementById("am-enabled").checked,
            raid_enabled: document.getElementById("am-raid-enabled").checked,
            raid_join_threshold: Number(document.getElementById("am-raid-threshold").value) || 10,
            raid_interval_seconds: Number(document.getElementById("am-raid-interval").value) || 60,
            raid_action: document.getElementById("am-raid-action").value,
            mute_duration_minutes: Number(document.getElementById("am-mute-duracao").value) || 10
        };

        document.querySelectorAll("#am-regras .regra-card").forEach(card => {

            const regraKey = card.dataset.regra;
            const regra = REGRAS_AUTOMOD.find(r => r.key === regraKey);

            payload[regra.enabledField] = card.querySelector(".am-enabled-field").checked;

            regra.params.forEach(p => {

                const input = card.querySelector(`.am-param-field[data-field="${p.field}"]`);
                payload[p.field] = Number(input.value) || 1;

            });

            const acoes = Array.from(card.querySelectorAll(".am-acao"))
                .filter(el => el.checked)
                .map(el => el.dataset.acao);

            payload[regra.actionsField] = acoes.join(",");

        });

        try {

            await api(`/guilds/${guildAtual}/automod`, { method: "POST", body: payload });

            feedback.textContent = "✅ Salvo!";
            setTimeout(() => (feedback.textContent = ""), 2500);

        } catch (error) {

            feedback.textContent = `❌ ${error.message}`;

        }

    });

    /*
    =========================
        BOAS-VINDAS
    =========================
    */

    async function carregarBoasvindas() {

        try {

            const data = await api(`/guilds/${guildAtual}/welcome`);

            document.getElementById("bv-enabled").checked = !!data.enabled;
            popularSelectCanais(document.getElementById("bv-canal"), data.channel_id);
            document.getElementById("bv-fundo").value = data.background_url || "";
            document.getElementById("bv-cor").value = data.accent_color || "#5865f2";
            document.getElementById("bv-titulo").value = data.title_text || "";
            document.getElementById("bv-subtitulo").value = data.subtitle_text || "";
            document.getElementById("bv-mensagem").value = data.message_content || "";

        } catch (error) {

            console.error(error);

        }

    }

    document.getElementById("btn-salvar-boasvindas").addEventListener("click", async () => {

        const feedback = document.getElementById("boasvindas-feedback");

        try {

            await api(`/guilds/${guildAtual}/welcome`, {
                method: "POST",
                body: {
                    enabled: document.getElementById("bv-enabled").checked,
                    channel_id: document.getElementById("bv-canal").value || null,
                    background_url: document.getElementById("bv-fundo").value.trim() || null,
                    accent_color: document.getElementById("bv-cor").value,
                    title_text: document.getElementById("bv-titulo").value.trim(),
                    subtitle_text: document.getElementById("bv-subtitulo").value.trim(),
                    message_content: document.getElementById("bv-mensagem").value.trim()
                }
            });

            feedback.textContent = "✅ Salvo!";
            setTimeout(() => (feedback.textContent = ""), 2500);

        } catch (error) {

            feedback.textContent = `❌ ${error.message}`;

        }

    });

    /*
    =========================
        AUTOROLE
    =========================
    */

    function popularSelectCargos(select) {

        select.innerHTML = overviewCache.roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");

    }

    async function carregarAutorole() {

        popularSelectCargos(document.getElementById("ar-select-cargo"));

        const listaEl = document.getElementById("ar-lista");
        listaEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { roleIds } = await api(`/guilds/${guildAtual}/autorole`);

            if (!roleIds.length) {

                listaEl.innerHTML = `<p class="carregando">Nenhum cargo de entrada configurado.</p>`;
                return;

            }

            listaEl.innerHTML = "";

            roleIds.forEach(id => {

                const cargo = overviewCache.roles.find(r => r.id === id);

                const el = document.createElement("div");
                el.className = "servidor-item";

                el.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(cargo?.name || id)}</div>
                    </div>
                    <div class="servidor-acoes">
                        <button class="btn-perigo" data-id="${id}">Remover</button>
                    </div>
                `;

                el.querySelector("button").addEventListener("click", async () => {

                    await api(`/guilds/${guildAtual}/autorole/${id}`, { method: "DELETE" });
                    carregarAutorole();

                });

                listaEl.appendChild(el);

            });

        } catch (error) {

            listaEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    document.getElementById("btn-add-autorole").addEventListener("click", async () => {

        const roleId = document.getElementById("ar-select-cargo").value;

        if (!roleId) return;

        try {

            await api(`/guilds/${guildAtual}/autorole`, { method: "POST", body: { roleId } });
            carregarAutorole();

        } catch (error) {

            alert(error.message);

        }

    });

    /*
    =========================
        LOGS
    =========================
    */

    async function carregarLogs() {

        try {

            const data = await api(`/guilds/${guildAtual}/logs`);

            popularSelectCanais(document.getElementById("logs-canal"), data.channelId);

            const container = document.getElementById("logs-categorias");
            container.innerHTML = "";

            data.categories.forEach(cat => {

                const linha = document.createElement("div");
                linha.className = "status-item";

                linha.innerHTML = `
                    <span style="flex:1">${cat.emoji} ${escapeHtml(cat.label)}</span>
                    <label class="switch">
                        <input type="checkbox" data-key="${cat.key}" ${cat.enabled ? "checked" : ""} />
                        <span></span>
                    </label>
                `;

                linha.querySelector("input").addEventListener("change", async (e) => {

                    await api(`/guilds/${guildAtual}/logs/categoria`, {
                        method: "POST",
                        body: { key: cat.key, enabled: e.target.checked }
                    });

                });

                container.appendChild(linha);

            });

        } catch (error) {

            console.error(error);

        }

    }

    document.getElementById("btn-salvar-logs-canal").addEventListener("click", async () => {

        try {

            await api(`/guilds/${guildAtual}/logs/canal`, {
                method: "POST",
                body: { channelId: document.getElementById("logs-canal").value || null }
            });

            alert("Canal de logs salvo!");

        } catch (error) {

            alert(error.message);

        }

    });

    /*
    =========================
        SORTEIOS
    =========================
    */

    async function carregarSorteios() {

        const listaEl = document.getElementById("sorteios-lista");
        listaEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { giveaways } = await api(`/guilds/${guildAtual}/giveaways`);

            if (!giveaways.length) {

                listaEl.innerHTML = `<p class="carregando">Nenhum sorteio em andamento.</p>`;
                return;

            }

            listaEl.innerHTML = "";

            giveaways.forEach(g => {

                const el = document.createElement("div");
                el.className = "servidor-item";

                el.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(g.prize)}</div>
                        <div class="servidor-meta">ID ${g.id} • ${g.winners_count} vencedor(es) • termina em ${new Date(g.ends_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <div class="servidor-acoes">
                        <button class="btn-perigo" data-id="${g.id}">Cancelar</button>
                    </div>
                `;

                el.querySelector("button").addEventListener("click", async () => {

                    if (!confirm(`Cancelar o sorteio de "${g.prize}"?`)) return;

                    await api(`/guilds/${guildAtual}/giveaways/${g.id}/cancel`, { method: "POST" });
                    carregarSorteios();

                });

                listaEl.appendChild(el);

            });

        } catch (error) {

            listaEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    /*
    =========================
        INICIALIZAÇÃO
    =========================
    */

    (async function init() {

        const params = new URLSearchParams(window.location.search);
        const tokenDaUrl = params.get("token");
        const erro = params.get("erro");

        if (tokenDaUrl) {

            token = tokenDaUrl;
            localStorage.setItem("nina_panel_token", token);
            window.history.replaceState({}, "", window.location.pathname);

        }

        if (erro) {

            document.getElementById("login-erro").textContent = `Erro no login: ${erro}`;

        }

        if (!token) return mostrarTela("login");

        try {

            await api("/me");
            mostrarTelaServidores();

        } catch {

            mostrarTela("login");

        }

    })();

})();
