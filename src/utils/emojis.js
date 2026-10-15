/*
=========================
    EMOJIS DA NINA (UI)
=========================
Prioridade: emojis do iconpack já cadastrados como Application Emojis no
Developer Portal; depois os antigos ui_*; por último Unicode de reserva.
Aceita nomes simples (check), por categoria (symbols_check) e com prefixo
iconpack_ (iconpack_symbols_check).
*/

const FALLBACK = {
    ok: "✅", error: "❌", warn: "⚠️", info: "ℹ️",
    lock: "🔒", unlock: "🔓", ban: "🔨", unban: "♻️", kick: "👢",
    timeout: "⏳", purge: "🧹", clock: "🕒", role: "🏷️", nick: "✏️", shield: "🛡️",
    coin: "🪙", wallet: "👛", bank: "🏦", gift: "🎁", work: "💼", trophy: "🏆",
    pay: "💸", deposit: "📥", withdraw: "📤",
    dice: "🎲", slots: "🎰",
    ping: "📶", help: "❓", user: "👤", server: "🏰", sparkle: "✨", star: "⭐",
    ticket: "🎫", calendar: "📅", heart: "💖", crown: "👑", id: "🆔", ai: "🤖",
    config: "⚙️", log: "📜", channel: "#️⃣", image: "🖼️", mail: "✉️", boost: "🚀"
};

// Chave sem separadores, para tolerar nomes como symbols_check, symbols-check
// ou iconpack_symbols_check.
const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CATEGORY_NAMES = new Set([
    "types", "animated", "discord", "symbols", "economy", "creation",
    "embedbuilder", "brands", "dashboard", "programming", "core"
]);

// Semântica usada pelo código da Nina -> nomes prováveis dos emojis do iconpack.
// Inclui os nomes dos arquivos atuais e sinônimos para os ícones de interface.
const ICON_ALIASES = {
    ok: ["success", "check", "voicecsuccess"], error: ["danger", "cancel", "error"],
    warn: ["warn", "pending"], info: ["info", "question"],
    lock: ["lock"], unlock: ["unlock"], ban: ["block", "report"],
    unban: ["success", "check"], kick: ["user", "account"], timeout: ["timedout", "hourglass"],
    purge: ["trashcan", "remove"], clock: ["clock"], role: ["role"], nick: ["account", "user"],
    shield: ["shield"], coin: ["coin"], wallet: ["wallet"], bank: ["bank"], gift: ["gift"],
    work: ["suitcase", "briefcase"], trophy: ["trophy"], pay: ["transfer"],
    deposit: ["receipt", "bank"], withdraw: ["wallet", "transfer"], dice: ["dice"], slots: ["slots"],
    ping: ["ping", "signal"], help: ["question"], user: ["user"], server: ["server"],
    sparkle: ["sparks"], star: ["star"], ticket: ["ticket"], calendar: ["calendar"],
    heart: ["heart"], crown: ["crown"], id: ["id"], ai: ["bot"], config: ["settings"],
    log: ["logs", "newspaper"], channel: ["textc", "voicec"], image: ["image"],
    mail: ["message", "webhook"], boost: ["boost1", "boost2", "boost3"]
};

const NinaEmojiManager = require("../ai/NinaEmojiManager");
const PREFIX = "ui_";
const cache = new Map();

function addNameVariants(emoji) {
    const original = String(emoji.name ?? "");
    const names = new Set([normalize(original)]);
    let name = original;
    if (/^iconpack_/i.test(name)) name = name.replace(/^iconpack_/i, "");
    names.add(normalize(name));

    // Emojis importados mantendo a categoria no nome: symbols_check -> check.
    const parts = name.split(/[_-]+/).filter(Boolean);
    if (parts.length > 1 && CATEGORY_NAMES.has(parts[0].toLowerCase())) {
        names.add(normalize(parts.slice(1).join("_")));
    }
    return [...names].filter(Boolean);
}

/** Busca e indexa os emojis da aplicação. */
async function sync(client) {
    try {
        const emojis = await client.application.emojis.fetch();
        cache.clear();

        // Primeira passada: indexa os nomes reais e suas variantes.
        for (const emoji of emojis.values()) {
            const item = {
                id: emoji.id,
                name: emoji.name,
                animated: Boolean(emoji.animated),
                text: emoji.toString()
            };
            for (const variant of addNameVariants(emoji)) {
                // Evita que um ui_* antigo sobrescreva um emoji de iconpack.
                const old = cache.get(variant);
                const isLegacyUI = /^ui_/i.test(emoji.name ?? "");
                if (!old || (old.legacyUI && !isLegacyUI)) {
                    cache.set(variant, { ...item, legacyUI: isLegacyUI });
                }
            }
        }

        const missing = Object.keys(FALLBACK).filter(name => !resolve(name));
        console.log(`✨ Emojis da aplicação carregados: ${emojis.size}; ${Object.keys(FALLBACK).length - missing.length}/${Object.keys(FALLBACK).length} funções de UI usando emoji personalizado.`);
        if (missing.length) console.log(`ℹ️ Funções sem emoji personalizado (usando Unicode): ${missing.join(", ")}`);

        const ausentes = NinaEmojiManager.sync(emojis);
        if (ausentes.length) {
            console.warn(`⚠️ Emojis Nina_* não encontrados na aplicação (usando ID de reserva): ${ausentes.join(", ")}`);
        }
    } catch (error) {
        console.warn("⚠️ Não foi possível carregar os emojis da aplicação (usando Unicode):", error.message);
    }
}

function candidateNames(name) {
    const key = String(name ?? "");
    const candidates = [];
    for (const alias of (ICON_ALIASES[key] ?? [key])) {
        candidates.push(alias);
        // Suporta emoji nomeado como category_name ou iconpack_category_name.
        for (const category of CATEGORY_NAMES) {
            candidates.push(`${category}_${alias}`);
            candidates.push(`iconpack_${category}_${alias}`);
        }
        candidates.push(`iconpack_${alias}`);
    }
    // Os ui_* antigos continuam como fallback de compatibilidade.
    candidates.push(`ui_${key}`);
    return [...new Set(candidates.map(normalize))];
}

function resolve(name) {
    for (const candidate of candidateNames(name)) {
        const found = cache.get(candidate);
        if (found) return found;
    }
    return null;
}

/** Texto do emoji para usar em embeds/mensagens. */
function e(name) {
    return resolve(name)?.text ?? FALLBACK[name] ?? "▫️";
}

/** Formato aceito por botões e select menus (.setEmoji / emoji:). */
function component(name) {
    const custom = resolve(name);
    if (custom) return { id: custom.id, name: custom.name, animated: custom.animated };
    return FALLBACK[name] ?? "▫️";
}

module.exports = {
    sync,
    e,
    component,
    names: Object.keys(FALLBACK),
    PREFIX
};
