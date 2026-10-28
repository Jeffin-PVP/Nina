/*
=========================
    REGISTRO DE EMOJIS
=========================
ÚNICO lugar que conhece as marcações <:nome:id> dos emojis da Nina.
No resto do código use sempre:

    const { E } = require("../config/emojiRegistry");   // ajuste o caminho
    `${E("warn")} Algo deu errado`

Ordem de busca de E("nome"):
  1. emojis lidos ao vivo do Developer Portal (quando o bot liga)
  2. emojiRegistry.json  (gerado por: node scripts/syncEmojiRegistry.js)
  3. emoji Unicode original (emojiMap.js / FALLBACK_UI)
  4. ▫️ (e avisa uma vez no console qual nome está faltando)

Aceita o nome com ou sem o prefixo "ui_": E("hammer") acha ui_hammer.
Este arquivo não depende de nenhum outro do bot (evita importação circular).
*/
const registry = require("./emojiRegistry.json");
const unicodeMap = require("./emojiMap");

// Emojis de interface usados por nome curto (ui.field("shield", ...), e("ok"), etc.).
const FALLBACK_UI = {
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

// nome → Unicode original (inverso do emojiMap; o primeiro de cada nome vence)
const FALLBACK_MAP = {};
for (const [unicode, name] of Object.entries(unicodeMap)) {
    if (!(name in FALLBACK_MAP)) FALLBACK_MAP[name] = unicode;
}

const live = new Map();     // preenchido por setLive() com os emojis reais do portal
const warned = new Set();

function lookupMarkup(name) {
    return live.get(name) ?? registry[name] ?? null;
}

function resolve(name) {
    return lookupMarkup(name)
        ?? lookupMarkup(`ui_${name}`)
        ?? (name.startsWith("ui_") ? lookupMarkup(name.slice(3)) : null);
}

/** Texto do emoji para embeds, mensagens, .setEmoji() e emoji: de select menus. */
function E(name) {
    const found = resolve(name);
    if (found) return found;
    const fallback = FALLBACK_MAP[name] ?? FALLBACK_MAP[`ui_${name}`] ?? FALLBACK_UI[name];
    if (fallback) return fallback;
    if (!warned.has(name)) {
        warned.add(name);
        console.warn(`⚠️ Emoji "${name}" não existe no registro (usando ▫️). Rode: node scripts/syncEmojiRegistry.js`);
    }
    return "▫️";
}

/** "<:nome:id>" → { id, name, animated } (formato de objeto aceito por botões). */
function parse(markup) {
    const m = /^<(a?):([A-Za-z0-9_]+):(\d+)>$/.exec(markup || "");
    return m ? { id: m[3], name: m[2], animated: m[1] === "a" } : null;
}

/** Igual ao E(), mas no formato de objeto (ou Unicode) para botões/selects. */
function component(name) {
    const text = E(name);
    return parse(text) ?? text;
}

/** Usado pelo utils/emojis.js ao ligar o bot: registra os emojis reais do portal. */
function setLive(emojis) {
    live.clear();
    for (const emoji of emojis) live.set(emoji.name, emoji.toString());
}

const has = name => !!resolve(name);

module.exports = { E, component, parse, has, setLive, registry, FALLBACK_UI, FALLBACK_MAP };
