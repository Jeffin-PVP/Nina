// Seção "Gravação de calls" do painel web.
// Recebe do app.js: { guildId, api, toast, feedback, esc, IC }.
(() => {
    const $ = selector => document.querySelector(selector);

    let ctx = null;
    let apiConfigured = false;

    const STATUS = {
        recording: ["Gravando", "bad"],
        processing: ["Processando", ""],
        ready: ["Pronta", "ok"],
        failed: ["Falhou", "bad"]
    };

    const TRANSCRIPT = {
        none: "Não transcrita",
        pending: "Transcrevendo…",
        ready: "Pronta",
        failed: "Falhou"
    };

    const dateTime = ms => new Date(ms).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });

    function duration(ms) {
        const total = Math.max(0, Math.round((ms || 0) / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h) return `${h}h ${String(m).padStart(2, "0")}min`;
        if (m) return `${m}min ${String(s).padStart(2, "0")}s`;
        return `${s}s`;
    }

    function size(bytes) {
        if (!bytes) return "—";
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    function checkGrid(target, items, selected, group, label = item => item.name) {
        $(target).innerHTML = items.length
            ? items.map(item => `<label class="check-line"><input data-rec-group="${group}" value="${item.id}" type="checkbox" ${selected.includes(item.id) ? "checked" : ""}><span>${ctx.esc(label(item))}</span></label>`).join("")
            : '<div class="empty">Nada disponível.</div>';
    }

    const checked = group => [...document.querySelectorAll(`[data-rec-group="${group}"]:checked`)].map(input => input.value);

    // Baixa com o token do painel (o link direto não envia o cabeçalho Authorization).
    async function download(recordingId, kind, button) {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = "Baixando…";

        try {
            const token = localStorage.getItem("nina_panel_token");
            const response = await fetch(`/api/panel/guilds/${ctx.guildId}/recordings/${recordingId}/${kind}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Erro ${response.status}`);
            }

            const disposition = response.headers.get("content-disposition") || "";
            const name = (disposition.match(/filename="([^"]+)"/) || [])[1] || `${kind}-${recordingId}`;
            const url = URL.createObjectURL(await response.blob());

            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (error) {
            ctx.toast(error.message, "bad");
        } finally {
            button.disabled = false;
            button.textContent = original;
        }
    }

    function renderList(recordings) {
        const list = $("#rec-list");

        if (!recordings.length) {
            list.innerHTML = '<div class="empty">Nenhuma gravação neste servidor ainda.</div>';
            return;
        }

        list.innerHTML = recordings.map(r => {
            const [statusLabel] = STATUS[r.status] || [r.status];
            const audioReady = r.status === "ready";
            const canTranscribe = audioReady && ["none", "failed"].includes(r.transcriptStatus);

            return `<div class="list-row" data-rec-id="${r.id}">
                <div>
                    <b>${ctx.IC("mic")} ${ctx.esc(dateTime(r.startedAt))} · #${ctx.esc(r.channelName || "canal")}</b>
                    <small>Iniciada por ${ctx.esc(r.startedByName || r.startedBy)} · ${duration(r.durationMs)} · ${size(r.sizeBytes)} · ${r.participants} participante(s) · ${r.hasAudio ? `Áudio: ${statusLabel}` : "Áudio não guardado"} · Transcrição: ${TRANSCRIPT[r.transcriptStatus] || "—"}</small>
                </div>
                <div class="form-actions">
                    ${r.hasAudio ? `<button class="btn ghost" data-rec-action="audio" ${audioReady ? "" : "disabled"}>Baixar áudio</button>
                    <button class="btn secondary" data-rec-action="transcribe" ${canTranscribe ? "" : "disabled"}>Transcrever</button>` : ""}
                    <button class="btn ghost" data-rec-action="transcript" ${r.transcriptStatus === "ready" ? "" : "disabled"}>Baixar transcrição</button>
                    <button class="btn danger" data-rec-action="delete" ${r.status === "recording" ? "disabled" : ""}>Excluir</button>
                </div>
            </div>`;
        }).join("");

        list.querySelectorAll("[data-rec-action]").forEach(button => {
            button.onclick = async () => {
                const id = button.closest("[data-rec-id]").dataset.recId;
                const action = button.dataset.recAction;

                if (action === "audio" || action === "transcript") return download(id, action, button);

                try {
                    if (action === "transcribe") {
                        await ctx.api(`/guilds/${ctx.guildId}/recordings/${id}/transcribe`, { method: "POST", body: {} });
                        ctx.toast("Transcrição solicitada! Atualize a lista em instantes.");
                    }

                    if (action === "delete") {
                        if (!confirm("Excluir esta gravação e sua transcrição? Essa ação não pode ser desfeita.")) return;
                        await ctx.api(`/guilds/${ctx.guildId}/recordings/${id}`, { method: "DELETE" });
                        ctx.toast("Gravação excluída.");
                    }

                    load(ctx);
                } catch (error) {
                    ctx.toast(error.message, "bad");
                }
            };
        });
    }

    async function load(context) {
        ctx = context;

        try {
            const data = await ctx.api(`/guilds/${ctx.guildId}/recordings`);
            const config = data.config;
            apiConfigured = data.apiConfigured;

            $("#rec-api-warning").classList.toggle("hidden", apiConfigured);

            const active = $("#rec-active");
            if (data.active) {
                active.classList.remove("hidden");
                active.innerHTML = `${ctx.IC("mic")} <b>Gravando agora</b> em #${ctx.esc(data.active.channelName)} desde ${ctx.esc(dateTime(data.active.startedAt))}.`;
            } else {
                active.classList.add("hidden");
            }

            $("#rec-enabled").checked = !!config.enabled;
            $("#rec-max-minutes").innerHTML = data.maxMinutesOptions.map(m => `<option value="${m}">${m} minutos</option>`).join("");
            $("#rec-max-minutes").value = String(config.max_minutes);

            checkGrid("#rec-roles", data.roles, config.allowed_role_ids, "roles");
            checkGrid("#rec-allowed-channels", data.voiceChannels, config.allowed_channel_ids, "allowed");
            checkGrid("#rec-blocked-channels", data.voiceChannels, config.blocked_channel_ids, "blocked");

            renderList(data.recordings);
        } catch (error) {
            $("#rec-list").innerHTML = `<div class="empty error">${ctx.esc(error.message)}</div>`;
        }
    }

    async function save() {
        try {
            await ctx.api(`/guilds/${ctx.guildId}/recordings/config`, {
                method: "POST",
                body: {
                    enabled: $("#rec-enabled").checked,
                    max_minutes: Number($("#rec-max-minutes").value),
                    allowed_role_ids: checked("roles"),
                    allowed_channel_ids: checked("allowed"),
                    blocked_channel_ids: checked("blocked")
                }
            });

            ctx.feedback("rec-feedback", "Configuração salva!");
            load(ctx);
        } catch (error) {
            ctx.feedback("rec-feedback", error.message, false);
        }
    }

    $("#btn-rec-save").onclick = save;
    $("#btn-rec-refresh").onclick = () => ctx && load(ctx);

    window.NinaRecordings = { load };
})();
