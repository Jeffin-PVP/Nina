// Página de planos: lê o catálogo real do bot (/api/plans), então os limites
// mostrados aqui são sempre os mesmos que o bot aplica.
(() => {
    const SUPPORT = "https://discord.com/invite/Kk4AbujYTF";
    const INVITE = "https://discord.com/oauth2/authorize?client_id=1551732753047879860&permissions=8&integration_type=0&scope=bot";

    // Mesma origem primeiro (site servido pelo próprio bot); depois o endereço público.
    const ENDPOINTS = ["/api/plans", "https://nina.injectcloud.space/api/plans"];

    // Destaques de cada card (ordem de importância).
    const HIGHLIGHTS = [
        "ai_user_daily", "ai_guild_daily", "transcription_minutes_month",
        "backups_max", "server_builder_month", "anti_scam_images", "analytics_days"
    ];

    const el = id => document.getElementById(id);
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    function fmt(meta, v) {
        if (meta.type === "boolean" || typeof v === "boolean") return v ? "Incluso" : null;
        if (v === null || v === undefined) return "Ilimitado";
        if (v === 0) return null;
        return Number(v).toLocaleString("pt-BR");
    }

    function cell(meta, v) {
        if (meta.type === "boolean" || typeof v === "boolean") return v ? `<td class="yes">✓</td>` : `<td class="no">—</td>`;
        if (v === null || v === undefined) return `<td class="yes">∞</td>`;
        if (v === 0) return `<td class="no">—</td>`;
        return `<td>${Number(v).toLocaleString("pt-BR")}${meta.unit === "×" ? "×" : ""}</td>`;
    }

    function price(p) {
        if (p.price === 0) return `Grátis`;
        if (p.price == null) return `Em breve`;
        return `R$ ${Number(p.price).toFixed(2).replace(".", ",")}<small>/mês</small>`;
    }

    function highlight(meta, key, v) {
        const label = meta.label;
        if (meta.type === "boolean") return v ? { on: true, text: label } : { on: false, text: label };
        if (v === 0) return { on: false, text: label };
        const shown = v === null ? "Ilimitado" : Number(v).toLocaleString("pt-BR");
        return { on: true, text: `${label}: <b>${shown}</b>` };
    }

    function render({ catalog, plans }) {
        el("plans-grid").innerHTML = plans.map(p => {
            const items = HIGHLIGHTS.filter(k => catalog[k]).map(k => highlight(catalog[k], k, p.limits[k]));
            const cta = p.id === "free"
                ? `<a class="button button-secondary" href="${INVITE}">Adicionar ao Discord</a>`
                : `<a class="button ${p.id === "pro" ? "button-primary" : "button-secondary"}" href="${SUPPORT}">Assinar ${esc(p.name)}</a>`;
            return `
                <article class="plan-card ${p.id === "pro" ? "featured" : ""}">
                    ${p.id === "pro" ? `<span class="plan-tag">MAIS COMPLETO</span>` : ""}
                    <div class="plan-name">${esc(p.emoji)} ${esc(p.name)}</div>
                    <p class="plan-tagline">${esc(p.tagline)}</p>
                    <div class="plan-price">${price(p)}</div>
                    <ul class="plan-list">${items.map(i => `<li class="${i.on ? "" : "off"}">${i.text}</li>`).join("")}</ul>
                    ${cta}
                </article>`;
        }).join("");

        let group = null;
        let rows = "";
        for (const [key, meta] of Object.entries(catalog)) {
            if (meta.wired === false) continue; // só mostra o que o bot realmente aplica
            if (meta.group !== group) {
                group = meta.group;
                rows += `<tr class="group"><td colspan="${plans.length + 1}">${esc(group)}</td></tr>`;
            }
            rows += `<tr><td>${esc(meta.label)}</td>${plans.map(p => cell(meta, p.limits[key])).join("")}</tr>`;
        }
        el("compare-table").innerHTML =
            `<thead><tr><th>Recurso</th>${plans.map(p => `<th>${esc(p.name)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;
    }

    // Sistema ainda desligado: avisa e esconde preços/comparativo.
    function soon() {
        el("plans-grid").innerHTML = `<p class="plans-error"><b>Os planos chegam em breve.</b><br>Por enquanto, todos os recursos da Nina estão liberados para todos os servidores.</p>`;
        document.querySelectorAll(".plans-compare, .plans-how, .plans-note").forEach(n => n.classList.add("hidden"));
    }

    async function load() {
        for (const url of ENDPOINTS) {
            try {
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) continue;
                const data = await res.json();
                if (data.enabled === false) return soon();
                return render(data);
            } catch { /* tenta o próximo endereço */ }
        }
        el("plans-grid").innerHTML = `<p class="plans-error">Não foi possível carregar os planos agora. Tente novamente em instantes.</p>`;
        el("compare-table").closest(".plans-compare")?.classList.add("hidden");
    }

    const year = el("currentYear");
    if (year) year.textContent = new Date().getFullYear();

    load();
})();
