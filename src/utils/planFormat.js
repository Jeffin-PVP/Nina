const { CATALOG, PLANS, PLAN_ORDER } = require("../config/plans");

/*
 Formatação de valores de plano para embeds/textos.
 Infinity e null (vindo do JSON) = ilimitado.
*/

function fmtValue(key, v) {
    const meta = CATALOG[key] || {};
    if (meta.type === "boolean" || typeof v === "boolean") return v ? "✅" : "❌";
    if (v === Infinity || v === null) return "∞";
    if (v === 0) return "❌";
    const n = Number(v).toLocaleString("pt-BR");
    return meta.unit === "×" ? `×${n}` : n;
}

/** Linhas agrupadas: { "IA": ["**Label** — ❌ · 40 · 100", ...], ... } */
function comparisonByGroup() {
    const groups = {};
    for (const [key, meta] of Object.entries(CATALOG)) {
        const cols = PLAN_ORDER.map(id => fmtValue(key, PLANS[id].limits[key]));
        (groups[meta.group] ||= []).push(`**${meta.label}**\n${cols.join(" · ")}`);
    }
    return groups;
}

function fmtPrice(price) {
    if (price === 0) return "Grátis";
    if (price == null) return "Em breve";
    return `R$ ${Number(price).toFixed(2).replace(".", ",")}/mês`;
}

module.exports = { fmtValue, comparisonByGroup, fmtPrice };
