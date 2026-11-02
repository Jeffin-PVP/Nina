// Seção "Plano" do painel web.
// Recebe do app.js: { guildId, api, toast, feedback, esc }.
(() => {
    const $ = selector => document.querySelector(selector);
    let ctx = null;

    const NOMES = { free: "Free", basic: "Basic", pro: "Pro" };

    const data = ms => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

    function valor(meta, v) {
        if (meta.type === "boolean" || typeof v === "boolean") return v ? "✅" : "❌";
        if (v === null || v === undefined) return "∞";
        if (v === 0) return "❌";
        return Number(v).toLocaleString("pt-BR") + (meta.unit === "×" ? "×" : "");
    }

    function renderAtual(info) {
        const esc = ctx.esc;
        const venc = info.expiresAt ? `vence em ${data(info.expiresAt)}` : (info.active ? "sem vencimento" : "");
        const aviso = info.status === "expired" ? `<small>Seu plano anterior expirou. Seus dados continuam salvos.</small>` : "";
        $("#plano-atual").innerHTML = `<div><b>${esc(NOMES[info.plan] || info.plan)}</b><small>${esc(venc)}</small>${aviso}</div>`;
    }

    function renderTabela(info, catalog) {
        const esc = ctx.esc;
        const { catalog: meta, plans } = catalog;
        let grupo = null;
        let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;min-width:420px"><thead><tr><th style="text-align:left;padding:6px 8px">Recurso</th>${plans.map(p => `<th style="padding:6px 8px;${p.id === info.plan ? "color:var(--accent)" : ""}">${esc(p.name)}${p.id === info.plan ? " ●" : ""}</th>`).join("")}</tr></thead><tbody>`;
        for (const [key, m] of Object.entries(meta)) {
            if (m.wired === false) continue;
            if (m.group !== grupo) {
                grupo = m.group;
                html += `<tr><td colspan="${plans.length + 1}" style="padding:10px 8px 4px;font-weight:700;color:var(--accent)">${esc(grupo)}</td></tr>`;
            }
            html += `<tr><td style="padding:6px 8px;border-bottom:1px solid var(--line)">${esc(m.label)}</td>${plans.map(p => `<td style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--line)">${valor(m, p.limits[key])}</td>`).join("")}</tr>`;
        }
        $("#plano-tabela-painel").innerHTML = html + "</tbody></table>";
    }

    async function load(context) {
        ctx = context;
        try {
            const info = await ctx.api(`/guilds/${ctx.guildId}/plan`);
            const off = info.enabled === false;
            $("#plano-codigo").closest(".setting").classList.toggle("hidden", off);
            if (off) {
                $("#plano-atual").innerHTML = `<div><b>Planos em breve</b><small>O sistema de planos ainda não foi ativado. Por enquanto, todos os recursos da Nina estão liberados neste servidor.</small></div>`;
                $("#plano-tabela-painel").innerHTML = "";
                return;
            }
            renderAtual(info);
            renderTabela(info, info.catalog);
        } catch (error) {
            $("#plano-atual").innerHTML = `<span>${ctx.esc(error.message)}</span>`;
        }
    }

    $("#btn-plano-ativar").onclick = async () => {
        if (!ctx) return;
        const code = $("#plano-codigo").value.trim();
        if (!code) return ctx.feedback("plano-feedback", "Digite o código.", false);
        try {
            const info = await ctx.api(`/guilds/${ctx.guildId}/plan/redeem`, { method: "POST", body: { code } });
            $("#plano-codigo").value = "";
            ctx.feedback("plano-feedback", "Plano ativado!");
            ctx.toast("Plano ativado!", "ok");
            load(ctx);
        } catch (error) {
            ctx.feedback("plano-feedback", error.message, false);
        }
    };

    window.NinaPlano = { load };
})();
