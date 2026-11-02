const ICON=n=>`<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function setResultado(el,estado,texto){el.textContent=texto||"";if(estado&&texto)el.dataset.estado=estado;else delete el.dataset.estado;}
(() => {

    const API = "/api/dashboard";

    let token = localStorage.getItem("nina_dashboard_token") || null;

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

        if (!res.ok) {

            throw new Error(data.error || `Erro ${res.status}`);

        }

        return data;

    }

    /*
    =========================
        LOGIN / LOGOUT
    =========================
    */

    const telaLogin = document.getElementById("tela-login");
    const app = document.getElementById("app");
    const formLogin = document.getElementById("form-login");
    const inputSenha = document.getElementById("input-senha");
    const loginErro = document.getElementById("login-erro");
    const btnSair = document.getElementById("btn-sair");

    formLogin.addEventListener("submit", async (e) => {

        e.preventDefault();
        loginErro.textContent = "";

        try {

            const res = await fetch(API + "/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: inputSenha.value })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Falha ao entrar.");

            token = data.token;
            localStorage.setItem("nina_dashboard_token", token);

            mostrarApp();

        } catch (error) {

            loginErro.textContent = error.message;

        }

    });

    btnSair.addEventListener("click", fazerLogout);

    function fazerLogout() {

        token = null;
        localStorage.removeItem("nina_dashboard_token");

        app.classList.add("oculto");
        telaLogin.classList.remove("oculto");
        inputSenha.value = "";

    }

    function mostrarApp() {

        telaLogin.classList.add("oculto");
        app.classList.remove("oculto");

        carregarVisaoGeral();

    }

    /*
    =========================
        NAVEGAÇÃO
    =========================
    */

    const navItens = document.querySelectorAll(".nav-item");
    const secoes = document.querySelectorAll(".secao");

    navItens.forEach(item => {

        item.addEventListener("click", () => {

            navItens.forEach(i => i.classList.remove("ativo"));
            item.classList.add("ativo");

            const alvo = item.dataset.secao;

            secoes.forEach(s => s.classList.add("oculto"));
            document.getElementById(`secao-${alvo}`).classList.remove("oculto");

            if (alvo === "visao-geral") carregarVisaoGeral();
            if (alvo === "servidores") { carregarServidores(); carregarBanidos(); }
            if (alvo === "usuarios-banidos") carregarUsuariosBanidos();
            if (alvo === "planos") carregarPlanos();
            if (alvo === "status") carregarStatus();
            if (alvo === "comunicados") carregarHistoricoComunicados();

        });

    });

    /*
    =========================
        VISÃO GERAL
    =========================
    */

    function formatarUptime(ms) {

        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);

        return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");

    }

    function formatarBytes(bytes) {

        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    }

    async function carregarVisaoGeral() {

        try {

            const data = await api("/overview");

            document.getElementById("bot-avatar").src = data.avatar || "";
            document.getElementById("bot-tag").textContent = data.tag || "—";
            document.getElementById("bot-dot").classList.toggle("online", data.online);
            document.getElementById("bot-ping").textContent = `${data.ping} ms`;

            document.getElementById("stat-servers").textContent = data.servers;
            document.getElementById("stat-members").textContent = data.members.toLocaleString("pt-BR");
            document.getElementById("stat-ping").textContent = `${data.ping} ms`;
            document.getElementById("stat-uptime").textContent = formatarUptime(data.uptimeMs);
            document.getElementById("stat-memoria").textContent = formatarBytes(data.memory.rss);
            document.getElementById("stat-node").textContent = data.node;

        } catch (error) {

            console.error(error);

        }

        carregarGraficoCrescimento();

    }

    /*
    =========================
        GRÁFICO DE CRESCIMENTO (canvas puro, sem lib externa)
    =========================
    */

    async function carregarGraficoCrescimento() {

        const canvas = document.getElementById("grafico-crescimento");
        const vazio = document.getElementById("grafico-vazio");

        try {

            const { history } = await api("/stats-history");

            if (!history || history.length < 2) {

                canvas.classList.add("oculto");
                vazio.classList.remove("oculto");
                return;

            }

            canvas.classList.remove("oculto");
            vazio.classList.add("oculto");

            desenharGrafico(canvas, history);

        } catch (error) {

            console.error(error);

        }

    }

    function desenharGrafico(canvas, history) {

        const ctx = canvas.getContext("2d");
        const largura = canvas.clientWidth || 600;
        const altura = 180;

        canvas.width = largura * devicePixelRatio;
        canvas.height = altura * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        ctx.clearRect(0, 0, largura, altura);

        const padding = { top: 10, right: 10, bottom: 24, left: 40 };
        const areaW = largura - padding.left - padding.right;
        const areaH = altura - padding.top - padding.bottom;

        const valores = history.map(h => h.servers);
        const max = Math.max(...valores, 1);
        const min = Math.min(...valores, 0);
        const range = Math.max(max - min, 1);

        const pontos = history.map((h, i) => ({
            x: padding.left + (i / (history.length - 1)) * areaW,
            y: padding.top + areaH - ((h.servers - min) / range) * areaH,
            data: h.date,
            servers: h.servers
        }));

        // linha
        ctx.beginPath();
        ctx.strokeStyle = "#5865f2";
        ctx.lineWidth = 2;

        pontos.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });

        ctx.stroke();

        // área preenchida (leve)
        ctx.lineTo(pontos[pontos.length - 1].x, padding.top + areaH);
        ctx.lineTo(pontos[0].x, padding.top + areaH);
        ctx.closePath();
        ctx.fillStyle = "rgba(88, 101, 242, 0.12)";
        ctx.fill();

        // pontos
        ctx.fillStyle = "#7983f5";
        pontos.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // eixo X: primeira e última data
        ctx.fillStyle = "#8890a4";
        ctx.font = "11px monospace";
        ctx.fillText(pontos[0].data, padding.left, altura - 6);
        ctx.textAlign = "right";
        ctx.fillText(pontos[pontos.length - 1].data, largura - padding.right, altura - 6);
        ctx.textAlign = "left";

    }

    /*
    =========================
        SERVIDORES
    =========================
    */

    const listaServidoresEl = document.getElementById("lista-servidores");

    async function carregarServidores() {

        listaServidoresEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { guilds } = await api("/guilds");

            if (!guilds.length) {

                listaServidoresEl.innerHTML = `<p class="carregando">O bot não está em nenhum servidor.</p>`;
                return;

            }

            listaServidoresEl.innerHTML = "";

            guilds.forEach(g => {

                const el = document.createElement("div");
                el.className = "servidor-item";

                el.innerHTML = `
                    <img src="${g.icon || ""}" alt="" onerror="this.style.visibility='hidden'" />
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(g.name)}</div>
                        <div class="servidor-meta">${g.memberCount.toLocaleString("pt-BR")} membros • ID ${g.id}</div>
                    </div>
                    <div class="servidor-acoes">
                        <button class="btn-secundario" data-acao="convite" data-id="${g.id}">Convite</button>
                        <button class="btn-perigo" data-acao="sair" data-id="${g.id}" data-nome="${escapeHtml(g.name)}">Sair</button>
                        <button class="btn-perigo" data-acao="banir" data-id="${g.id}" data-nome="${escapeHtml(g.name)}">Banir</button>
                    </div>
                `;

                listaServidoresEl.appendChild(el);

            });

        } catch (error) {

            listaServidoresEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    listaServidoresEl.addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-acao]");

        if (!btn) return;

        const { acao, id, nome } = btn.dataset;

        if (acao === "sair") {

            if (!confirm(`Tem certeza que quer sair de "${nome}"? Essa ação não pode ser desfeita pelo dashboard.`)) return;

            btn.disabled = true;

            try {

                await api(`/guilds/${id}/leave`, { method: "POST" });
                carregarServidores();

            } catch (error) {

                alert(error.message);
                btn.disabled = false;

            }

        }

        if (acao === "convite") {

            btn.disabled = true;

            try {

                const data = await api(`/guilds/${id}/invite`);
                abrirModalConvite(data.url);

            } catch (error) {

                alert(error.message);

            } finally {

                btn.disabled = false;

            }

        }

        if (acao === "banir") {

            if (!confirm(`Banir "${nome}"? O bot vai sair AGORA e nunca mais entrar se for readicionado.`)) return;

            const motivo = prompt("Motivo do banimento (opcional):") || null;

            btn.disabled = true;

            try {

                await api(`/guilds/${id}/ban`, { method: "POST", body: { reason: motivo } });
                carregarServidores();
                carregarBanidos();

            } catch (error) {

                alert(error.message);
                btn.disabled = false;

            }

        }

    });

    /*
    =========================
        SERVIDORES BANIDOS
    =========================
    */

    const listaBanidosEl = document.getElementById("lista-banidos");

    async function carregarBanidos() {

        listaBanidosEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { banned } = await api("/guilds/banned");

            if (!banned.length) {

                listaBanidosEl.innerHTML = `<p class="carregando">Nenhum servidor banido.</p>`;
                return;

            }

            listaBanidosEl.innerHTML = "";

            banned.forEach(b => {

                const el = document.createElement("div");
                el.className = "servidor-item";

                el.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(b.guild_name || b.guild_id)}</div>
                        <div class="servidor-meta">ID ${b.guild_id}${b.reason ? ` • ${escapeHtml(b.reason)}` : ""}</div>
                    </div>
                    <div class="servidor-acoes">
                        <button class="btn-secundario" data-acao="desbanir" data-id="${b.guild_id}">Desbanir</button>
                    </div>
                `;

                listaBanidosEl.appendChild(el);

            });

        } catch (error) {

            listaBanidosEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    listaBanidosEl.addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-acao='desbanir']");

        if (!btn) return;

        btn.disabled = true;

        try {

            await api(`/guilds/banned/${btn.dataset.id}/unban`, { method: "POST" });
            carregarBanidos();

        } catch (error) {

            alert(error.message);
            btn.disabled = false;

        }

    });

    /*
    =========================
        USUÁRIOS BANIDOS GLOBALMENTE
    =========================
    */

    const formBanGlobal = document.getElementById("form-ban-global");
    const listaUsuariosBanidosEl = document.getElementById("lista-usuarios-banidos");
    const banGlobalResultado = document.getElementById("ban-global-resultado");

    async function carregarUsuariosBanidos() {

        listaUsuariosBanidosEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { banned } = await api("/users/banned");

            if (!banned.length) {
                listaUsuariosBanidosEl.innerHTML = `<p class="carregando">Nenhum usuário banido globalmente.</p>`;
                return;
            }

            listaUsuariosBanidosEl.innerHTML = "";

            banned.forEach(b => {

                const el = document.createElement("div");
                el.className = "servidor-item";

                const nome = b.user_tag || b.user_id;
                const data = b.banned_at ? new Date(b.banned_at).toLocaleString("pt-BR") : "—";

                el.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(nome)}</div>
                        <div class="servidor-meta">ID ${escapeHtml(b.user_id)} • ${escapeHtml(data)}</div>
                        ${b.reason ? `<div class="servidor-meta">Motivo: ${escapeHtml(b.reason)}</div>` : ""}
                    </div>
                    <div class="servidor-acoes">
                        <button class="btn-secundario" data-acao="desbanir-usuario" data-id="${escapeHtml(b.user_id)}">Desbanir</button>
                    </div>
                `;

                listaUsuariosBanidosEl.appendChild(el);

            });

        } catch (error) {

            listaUsuariosBanidosEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    formBanGlobal.addEventListener("submit", async (e) => {

        e.preventDefault();
        setResultado(banGlobalResultado, "");

        const id = document.getElementById("ban-global-id").value.trim();
        const reason = document.getElementById("ban-global-motivo").value.trim();
        const button = formBanGlobal.querySelector("button[type='submit']");

        if (!/^\d{17,20}$/.test(id)) {
            setResultado(banGlobalResultado, "erro", "Informe um ID de usuário Discord válido.");
            return;
        }

        if (!confirm(`Banir o usuário ${id} globalmente?`)) return;

        button.disabled = true;

        try {

            const data = await api(`/users/${id}/ban`, {
                method: "POST",
                body: { reason }
            });

            setResultado(banGlobalResultado, "ok", `${data.message}${data.leftServers ? ` A Nina saiu de ${data.leftServers} servidor(es) desse usuário.` : ""}`);
            formBanGlobal.reset();
            carregarUsuariosBanidos();

        } catch (error) {

            setResultado(banGlobalResultado, "erro", `${error.message}`);

        } finally {

            button.disabled = false;

        }

    });

    listaUsuariosBanidosEl.addEventListener("click", async (e) => {

        const btn = e.target.closest("button[data-acao='desbanir-usuario']");

        if (!btn) return;

        if (!confirm(`Desbanir globalmente o usuário ${btn.dataset.id}?`)) return;

        btn.disabled = true;

        try {
            await api(`/users/banned/${btn.dataset.id}/unban`, { method: "POST" });
            carregarUsuariosBanidos();
        } catch (error) {
            alert(error.message);
            btn.disabled = false;
        }

    });

    /*
    =========================
        MODAL DE CONVITE
    =========================
    */

    const modalConvite = document.getElementById("modal-convite");
    const modalConviteTexto = document.getElementById("modal-convite-texto");

    function abrirModalConvite(url) {

        modalConviteTexto.textContent = url;
        modalConvite.classList.remove("oculto");

    }

    document.getElementById("modal-convite-fechar").addEventListener("click", () => {

        modalConvite.classList.add("oculto");

    });

    document.getElementById("modal-convite-copiar").addEventListener("click", () => {

        navigator.clipboard.writeText(modalConviteTexto.textContent).catch(() => {});

    });

    /*
    =========================
        STATUS (PRESENÇA)
    =========================
    */

    const listaStatusEl = document.getElementById("lista-status");
    const inputIntervalo = document.getElementById("input-intervalo");
    let tiposDisponiveis = ["PLAYING", "WATCHING", "LISTENING", "COMPETING", "STREAMING"];

    const rotulosTipo = {
        PLAYING: "Jogando",
        WATCHING: "Assistindo",
        LISTENING: "Ouvindo",
        COMPETING: "Competindo em",
        STREAMING: "Transmitindo"
    };

    function criarLinhaStatus(item = { type: "WATCHING", text: "" }) {

        const linha = document.createElement("div");
        linha.className = "status-item";

        const select = document.createElement("select");

        tiposDisponiveis.forEach(tipo => {

            const opt = document.createElement("option");
            opt.value = tipo;
            opt.textContent = rotulosTipo[tipo] || tipo;
            if (tipo === item.type) opt.selected = true;
            select.appendChild(opt);

        });

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Ex: tickets personalizados";
        input.value = item.text || "";
        input.maxLength = 128;

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "remover";
        remover.innerHTML = ICON("x");
        remover.setAttribute("aria-label", "Remover");
        remover.addEventListener("click", () => linha.remove());

        linha.appendChild(select);
        linha.appendChild(input);
        linha.appendChild(remover);

        listaStatusEl.appendChild(linha);

    }

    document.getElementById("btn-add-status").addEventListener("click", () => criarLinhaStatus());

    async function carregarStatus() {

        listaStatusEl.innerHTML = "";

        try {

            const data = await api("/presence");

            tiposDisponiveis = data.tipos || tiposDisponiveis;
            inputIntervalo.value = data.intervalSeconds || 15;

            if (!data.statuses.length) {

                criarLinhaStatus();

            } else {

                data.statuses.forEach(criarLinhaStatus);

            }

        } catch (error) {

            console.error(error);
            criarLinhaStatus();

        }

    }

    document.getElementById("btn-salvar-status").addEventListener("click", async () => {

        const statuses = Array.from(listaStatusEl.querySelectorAll(".status-item")).map(linha => ({
            type: linha.querySelector("select").value,
            text: linha.querySelector("input").value.trim()
        })).filter(s => s.text.length > 0);

        const feedback = document.getElementById("status-salvo");

        try {

            await api("/presence", {
                method: "POST",
                body: { statuses, intervalSeconds: Number(inputIntervalo.value) || 15 }
            });

            feedback.textContent = "Salvo!";
            setTimeout(() => (feedback.textContent = ""), 2500);

        } catch (error) {

            feedback.style.color = "var(--perigo)";
            feedback.textContent = error.message;

        }

    });

    /*
    =========================
        COMUNICADOS
    =========================
    */

    document.getElementById("form-comunicado").addEventListener("submit", async (e) => {

        e.preventDefault();

        const resultado = document.getElementById("comunicado-resultado");
        setResultado(resultado, "info", "Enviando...");

        try {

            const data = await api("/broadcast", {
                method: "POST",
                body: {
                    title: document.getElementById("com-titulo").value.trim() || undefined,
                    description: document.getElementById("com-descricao").value.trim(),
                    color: document.getElementById("com-cor").value
                }
            });

            setResultado(resultado, data.falhas.length ? "aviso" : "ok",
                `Enviado para ${data.enviados} servidor(es).` +
                (data.falhas.length ? `\nFalhou em ${data.falhas.length}: ${data.falhas.map(f => f.guildName).join(", ")}` : ""));

            carregarHistoricoComunicados();

        } catch (error) {

            setResultado(resultado, "erro", `${error.message}`);

        }

    });

    const listaHistoricoEl = document.getElementById("lista-historico-comunicados");

    function formatarDataHora(iso) {

        try {
            return new Date(iso.replace(" ", "T") + "Z").toLocaleString("pt-BR");
        } catch {
            return iso;
        }

    }

    async function carregarHistoricoComunicados() {

        listaHistoricoEl.innerHTML = `<p class="carregando">Carregando...</p>`;

        try {

            const { history } = await api("/broadcast/history");

            if (!history.length) {

                listaHistoricoEl.innerHTML = `<p class="carregando">Nenhum comunicado enviado ainda.</p>`;
                return;

            }

            listaHistoricoEl.innerHTML = "";

            history.forEach(h => {

                const el = document.createElement("div");
                el.className = "servidor-item";

                const rotulo = h.kind === "restart" ? ICON("wrench") + " Reinício" : ICON("megaphone") + " Comunicado";

                el.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome">${rotulo} — ${escapeHtml(h.title || "(sem título)")}</div>
                        <div class="servidor-meta">${formatarDataHora(h.created_at)} • enviado a ${h.sent_count}, falhou em ${h.failed_count}</div>
                    </div>
                `;

                listaHistoricoEl.appendChild(el);

            });

        } catch (error) {

            listaHistoricoEl.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`;

        }

    }

    /*
    =========================
        REINICIAR
    =========================
    */

    document.getElementById("form-reiniciar").addEventListener("submit", async (e) => {

        e.preventDefault();

        if (!confirm("Tem certeza? Isso vai avisar todos os servidores e derrubar o processo do bot.")) return;

        const resultado = document.getElementById("reiniciar-resultado");
        setResultado(resultado, "info", "Enviando aviso e reiniciando...");

        try {

            const data = await api("/restart", {
                method: "POST",
                body: {
                    title: document.getElementById("re-titulo").value.trim() || undefined,
                    description: document.getElementById("re-descricao").value.trim()
                }
            });

            setResultado(resultado, "ok", `${data.message} (avisados: ${data.broadcast.enviados})`);

            carregarHistoricoComunicados();

        } catch (error) {

            setResultado(resultado, "erro", `${error.message}`);

        }

    });


    /*
    =========================
        PLANOS
    =========================
    */

    const planoResultadoEl = document.getElementById("plano-resultado");
    const planoDetalheEl = document.getElementById("plano-detalhe");
    const PLANO_NOMES = { free: "Free", basic: "Basic", pro: "Pro" };

    function fmtData(ms) {
        return ms ? new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem vencimento";
    }

    function fmtLimite(def, valor) {
        if (def && def.type === "boolean") return valor ? "✅" : "❌";
        if (valor === null || valor === undefined) return "∞";
        if (valor === true) return "✅";
        if (valor === false || valor === 0) return "❌";
        return Number(valor).toLocaleString("pt-BR") + (def && def.unit === "×" ? "×" : "");
    }

    function badgePlano(plano, estado) {
        return `<span class="plano-badge" data-plano="${escapeHtml(plano)}" ${estado ? `data-estado="${escapeHtml(estado)}"` : ""}>${escapeHtml(PLANO_NOMES[plano] || plano)}${estado === "expired" ? " (expirado)" : ""}</span>`;
    }

    let planosLigados = false;

    function pintarChavePlanos() {
        document.getElementById("plano-chave").dataset.ligado = planosLigados ? "1" : "0";
        document.getElementById("plano-chave-titulo").textContent = planosLigados ? "Sistema de planos: LIGADO" : "Sistema de planos: DESLIGADO";
        document.getElementById("plano-chave-texto").textContent = planosLigados
            ? "Os limites de Free, Basic e Pro estão valendo em todos os servidores."
            : "Todos os servidores usam a Nina sem limites de plano, como antes. Você pode configurar e testar planos normalmente; só não há bloqueios.";
        const btn = document.getElementById("btn-plano-chave");
        btn.textContent = planosLigados ? "Desligar planos" : "Ligar planos";
        btn.className = planosLigados ? "btn-perigo" : "btn-primario";
    }

    document.getElementById("btn-plano-chave").addEventListener("click", async () => {
        const proximo = !planosLigados;
        const aviso = proximo
            ? "Ligar o sistema de planos? Servidores sem plano passam a ter os limites do Free."
            : "Desligar o sistema de planos? Todos voltam a usar a Nina sem limites.";
        if (!confirm(aviso)) return;
        try {
            const r = await api("/plans/enabled", { method: "POST", body: { enabled: proximo } });
            planosLigados = r.enabled;
            pintarChavePlanos();
        } catch (error) { setResultado(planoResultadoEl, "erro", error.message); }
    });

    async function carregarPlanos() {
        api("/plans/enabled").then(r => { planosLigados = r.enabled; pintarChavePlanos(); }).catch(() => { });
        carregarResumoPlanos();
        carregarListaPlanos();
        carregarCodigos();
        carregarTabelaPlanos();
        carregarEventosPlanos();
    }

    async function carregarResumoPlanos() {
        try {
            const { counts } = await api("/plans/summary");
            for (const id of ["free", "basic", "pro"]) {
                document.getElementById(`plano-count-${id}`).textContent = (counts[id] ?? 0).toLocaleString("pt-BR");
            }
        } catch { /* mantém os traços */ }
    }

    async function carregarListaPlanos() {
        const el = document.getElementById("lista-planos");
        try {
            const { subscriptions } = await api("/plans/subscriptions");
            if (!subscriptions.length) { el.innerHTML = `<p class="carregando">Nenhum servidor com plano ainda.</p>`; return; }
            el.innerHTML = "";
            subscriptions.forEach(sub => {
                const item = document.createElement("div");
                item.className = "servidor-item";
                item.innerHTML = `
                    <img src="${escapeHtml(sub.icon || "")}" alt="" onerror="this.style.visibility='hidden'" />
                    <div class="servidor-info">
                        <div class="servidor-nome">${escapeHtml(sub.name || "Servidor fora da Nina")} ${badgePlano(sub.plan, sub.status === "expired" ? "expired" : "")}</div>
                        <div class="servidor-meta">ID ${escapeHtml(sub.id)} • ${sub.expiresAt ? "vence " + fmtData(sub.expiresAt) : "sem vencimento"} • ${escapeHtml(sub.source)}${sub.note ? " • " + escapeHtml(sub.note) : ""}</div>
                    </div>
                    <div class="servidor-acoes"><button class="btn-secundario" type="button">Abrir</button></div>`;
                item.querySelector("button").addEventListener("click", () => {
                    document.getElementById("plano-guild").value = sub.id;
                    consultarPlano();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                });
                el.appendChild(item);
            });
        } catch (error) { el.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`; }
    }

    function guildIdDoForm() {
        const id = document.getElementById("plano-guild").value.trim();
        if (!/^\d{17,20}$/.test(id)) {
            setResultado(planoResultadoEl, "erro", "Informe um ID de servidor válido (17 a 20 números).");
            return null;
        }
        return id;
    }

    async function consultarPlano() {
        const id = guildIdDoForm();
        if (!id) return;
        try {
            const info = await api(`/plans/guild/${id}`);
            const eventos = info.events.slice(0, 8).map(e => `<li>${fmtData(e.at)} — <b>${escapeHtml(e.action)}</b>${e.plan ? " (" + escapeHtml(e.plan) + ")" : ""}${e.details ? " — " + escapeHtml(e.details) : ""}</li>`).join("");
            const overrides = Object.entries(info.overrides).map(([k, v]) => `<li><code>${escapeHtml(k)}</code> = ${escapeHtml(String(v))} <button type="button" class="btn-fantasma" data-rm="${escapeHtml(k)}">remover</button></li>`).join("");
            planoDetalheEl.innerHTML = `
                <h4>${escapeHtml(info.guild.name || "Servidor fora da Nina")} <span style="color:var(--texto-sutil);font-weight:400">· ${escapeHtml(id)}</span></h4>
                <div>Plano: ${badgePlano(info.plan, info.status === "expired" ? "expired" : "")} • ${info.expiresAt ? "vence " + fmtData(info.expiresAt) : (info.active ? "sem vencimento" : "—")}${info.source ? " • origem: " + escapeHtml(info.source) : ""}</div>
                <div style="margin-top:10px"><b>Override de limite</b> (exceção só deste servidor)</div>
                <ul>${overrides || "<li>Nenhum.</li>"}</ul>
                <div class="plano-form" id="form-override" style="margin-top:10px;padding:10px">
                    <div class="plano-campo"><label>Limite</label><select id="override-key">${Object.entries(planoCatalogo?.catalog || {}).map(([k, m]) => `<option value="${escapeHtml(k)}">${escapeHtml(m.label)}</option>`).join("")}</select></div>
                    <div class="plano-campo"><label>Valor (número, “ilimitado”, true/false)</label><input type="text" id="override-valor" placeholder="Ex: 100" /></div>
                    <div class="plano-botoes"><button type="button" id="btn-override" class="btn-secundario">Aplicar override</button></div>
                </div>
                <div style="margin-top:10px"><b>Histórico</b></div>
                <ul>${eventos || "<li>Sem histórico.</li>"}</ul>`;
            planoDetalheEl.classList.remove("oculto");
            planoDetalheEl.querySelectorAll("[data-rm]").forEach(btn => btn.addEventListener("click", async () => {
                await api("/plans/override/remove", { method: "POST", body: { guildId: id, key: btn.dataset.rm } });
                consultarPlano();
            }));
            document.getElementById("btn-override").addEventListener("click", async () => {
                const key = document.getElementById("override-key").value;
                let value = document.getElementById("override-valor").value.trim();
                if (value === "") return;
                try {
                    await api("/plans/override", { method: "POST", body: { guildId: id, key, value } });
                    consultarPlano();
                } catch (error) { setResultado(planoResultadoEl, "erro", error.message); }
            });
            setResultado(planoResultadoEl, null, "");
        } catch (error) { setResultado(planoResultadoEl, "erro", error.message); }
    }

    document.getElementById("btn-plano-consultar").addEventListener("click", consultarPlano);

    document.getElementById("form-plano").addEventListener("submit", async (e) => {
        e.preventDefault();
        const guildId = guildIdDoForm();
        if (!guildId) return;
        try {
            await api("/plans/grant", { method: "POST", body: {
                guildId,
                plan: document.getElementById("plano-tipo").value,
                days: document.getElementById("plano-dias").value,
                note: document.getElementById("plano-nota").value
            } });
            setResultado(planoResultadoEl, "ok", "Plano atualizado.");
            consultarPlano(); carregarResumoPlanos(); carregarListaPlanos(); carregarEventosPlanos();
        } catch (error) { setResultado(planoResultadoEl, "erro", error.message); }
    });

    document.getElementById("btn-plano-remover").addEventListener("click", async () => {
        const guildId = guildIdDoForm();
        if (!guildId) return;
        if (!confirm("Remover o plano deste servidor? Ele volta ao Free (nenhum dado é apagado).")) return;
        try {
            const { removed } = await api("/plans/revoke", { method: "POST", body: { guildId } });
            setResultado(planoResultadoEl, "ok", removed ? "Plano removido. O servidor voltou ao Free." : "Esse servidor não tinha plano.");
            consultarPlano(); carregarResumoPlanos(); carregarListaPlanos(); carregarEventosPlanos();
        } catch (error) { setResultado(planoResultadoEl, "erro", error.message); }
    });

    async function carregarCodigos() {
        const el = document.getElementById("lista-codigos");
        try {
            const { codes } = await api("/plans/codes");
            if (!codes.length) { el.innerHTML = `<p class="carregando">Nenhum código gerado.</p>`; return; }
            el.innerHTML = "";
            codes.forEach(c => {
                const item = document.createElement("div");
                item.className = "servidor-item";
                const esgotado = c.uses >= c.maxUses;
                item.innerHTML = `
                    <div class="servidor-info">
                        <div class="servidor-nome"><code>${escapeHtml(c.code)}</code> ${badgePlano(c.plan)} ${c.revoked ? "· revogado" : (esgotado ? "· esgotado" : "")}</div>
                        <div class="servidor-meta">${c.durationDays ? c.durationDays + " dia(s)" : "permanente"} • ${c.uses}/${c.maxUses} usos${c.note ? " • " + escapeHtml(c.note) : ""} • criado ${fmtData(c.createdAt)}</div>
                    </div>
                    <div class="servidor-acoes">${c.revoked ? "" : `<button class="btn-perigo" type="button">Revogar</button>`}</div>`;
                item.querySelector("button")?.addEventListener("click", async () => {
                    await api("/plans/codes/revoke", { method: "POST", body: { code: c.code } });
                    carregarCodigos();
                });
                el.appendChild(item);
            });
        } catch (error) { el.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`; }
    }

    document.getElementById("form-codigo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const box = document.getElementById("codigos-gerados");
        try {
            const { codes } = await api("/plans/codes", { method: "POST", body: {
                plan: document.getElementById("codigo-plano").value,
                durationDays: document.getElementById("codigo-dias").value,
                maxUses: document.getElementById("codigo-usos").value,
                quantity: document.getElementById("codigo-qtd").value,
                note: document.getElementById("codigo-nota").value
            } });
            box.textContent = codes.join("\n");
            box.classList.remove("oculto");
            carregarCodigos();
        } catch (error) {
            box.textContent = error.message;
            box.classList.remove("oculto");
        }
    });

    let planoCatalogo = null;

    async function carregarTabelaPlanos() {
        const wrap = document.getElementById("plano-tabela");
        try {
            planoCatalogo = await api("/plans/catalog");
            const { catalog, plans } = planoCatalogo;
            let grupo = null;
            let html = `<table class="plano-tabela"><thead><tr><th>Limite</th>${plans.map(p => `<th>${escapeHtml(p.name)}</th>`).join("")}</tr></thead><tbody>`;
            for (const [key, meta] of Object.entries(catalog)) {
                if (meta.group !== grupo) {
                    grupo = meta.group;
                    html += `<tr class="plano-grupo"><td colspan="${plans.length + 1}">${escapeHtml(grupo)}</td></tr>`;
                }
                html += `<tr><td>${escapeHtml(meta.label)}${meta.wired === false ? `<span class="nao-aplicado">não aplicado</span>` : ""}</td>${plans.map(p => `<td>${fmtLimite(meta, p.limits[key])}</td>`).join("")}</tr>`;
            }
            wrap.innerHTML = html + "</tbody></table>";
        } catch (error) { wrap.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`; }
    }

    async function carregarEventosPlanos() {
        const el = document.getElementById("plano-eventos");
        try {
            const { events } = await api("/plans/events");
            if (!events.length) { el.innerHTML = `<p class="carregando">Sem atividade ainda.</p>`; return; }
            el.innerHTML = events.slice(0, 20).map(e => `
                <div class="servidor-item"><div class="servidor-info">
                    <div class="servidor-nome">${escapeHtml(e.action)}${e.plan ? " · " + escapeHtml(e.plan) : ""} — ${escapeHtml(e.guild.name || e.guild.id)}</div>
                    <div class="servidor-meta">${fmtData(e.at)}${e.source ? " • " + escapeHtml(e.source) : ""}${e.details ? " • " + escapeHtml(e.details) : ""}</div>
                </div></div>`).join("");
        } catch (error) { el.innerHTML = `<p class="carregando">${escapeHtml(error.message)}</p>`; }
    }

    /*
    =========================
        UTIL
    =========================
    */

    function escapeHtml(str) {

        const div = document.createElement("div");
        div.textContent = str ?? "";
        return div.innerHTML;

    }

    /*
    =========================
        INICIALIZAÇÃO
    =========================
    */

    if (token) {

        mostrarApp();

    }

})();
