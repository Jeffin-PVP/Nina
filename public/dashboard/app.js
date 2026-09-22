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
        remover.textContent = "✕";
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
        resultado.textContent = "Enviando...";

        try {

            const data = await api("/broadcast", {
                method: "POST",
                body: {
                    title: document.getElementById("com-titulo").value.trim() || undefined,
                    description: document.getElementById("com-descricao").value.trim(),
                    color: document.getElementById("com-cor").value
                }
            });

            resultado.textContent =
                `✅ Enviado para ${data.enviados} servidor(es).` +
                (data.falhas.length ? `\n⚠️ Falhou em ${data.falhas.length}: ${data.falhas.map(f => f.guildName).join(", ")}` : "");

            carregarHistoricoComunicados();

        } catch (error) {

            resultado.textContent = `❌ ${error.message}`;

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

                const rotulo = h.kind === "restart" ? "🔧 Reinício" : "📢 Comunicado";

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
        resultado.textContent = "Enviando aviso e reiniciando...";

        try {

            const data = await api("/restart", {
                method: "POST",
                body: {
                    title: document.getElementById("re-titulo").value.trim() || undefined,
                    description: document.getElementById("re-descricao").value.trim()
                }
            });

            resultado.textContent = `✅ ${data.message} (avisados: ${data.broadcast.enviados})`;

            carregarHistoricoComunicados();

        } catch (error) {

            resultado.textContent = `❌ ${error.message}`;

        }

    });

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
