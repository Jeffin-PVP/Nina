/*
=========================
    EMOJIS DA NINA (UI)
=========================
Os ícones "ui_*" ficam no Developer Portal (Application Emojis).
No ClientReady o bot busca todos eles e passa a usá-los automaticamente.
Se algum não existir (ou o fetch falhar), cai no emoji Unicode padrão,
então nenhum comando quebra por falta de emoji.
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

const PREFIX = "ui_";

const cache = new Map();

/** Busca os emojis da aplicação e guarda em cache. */
async function sync(client) {

    try {

        const emojis = await client.application.emojis.fetch();

        cache.clear();

        for (const emoji of emojis.values()) {

            if (!emoji.name?.startsWith(PREFIX)) continue;

            cache.set(emoji.name.slice(PREFIX.length), {
                id: emoji.id,
                name: emoji.name,
                animated: Boolean(emoji.animated),
                text: emoji.toString()
            });

        }

        console.log(`✨ Emojis personalizados carregados: ${cache.size}/${Object.keys(FALLBACK).length}`);

    } catch (error) {

        console.warn("⚠️ Não foi possível carregar os emojis da aplicação (usando Unicode):", error.message);

    }

}

/** Texto do emoji para usar em embeds/mensagens. */
function e(name) {

    return cache.get(name)?.text ?? FALLBACK[name] ?? "▫️";

}

/** Formato aceito por botões e select menus (.setEmoji / emoji:). */
function component(name) {

    const custom = cache.get(name);

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
