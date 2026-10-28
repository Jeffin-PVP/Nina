/*
=========================
    MAPA UNICODE → NINA
=========================
Liga um emoji normal (Unicode) ao NOME de um emoji da Nina que existe em
src/config/emojiRegistry.json (gerado do Developer Portal).

É usado pelo script `node scripts/applyEmojis.js`, que troca os emojis normais
do código por E("nome"). Se um nome ficar sem emoji no portal, o bot volta
sozinho para o emoji Unicode original (nada quebra).

Para trocar mais emojis: adicione a linha aqui e rode
    node scripts/applyEmojis.js          (mostra o que mudaria)
    node scripts/applyEmojis.js --write  (aplica)
*/
module.exports = {
    // Status
    "✅": "ui_check", "✔️": "ui_check", "✔": "ui_check",
    "❌": "ui_cancel",
    "⚠️": "warn", "⚠": "warn",
    "ℹ️": "info", "ℹ": "info",
    "🚫": "ui_block",
    "❓": "ajuda",

    // Segurança e moderação
    "🛡️": "shield", "🛡": "shield",
    "🔒": "lock", "🔓": "unlock",
    "🔨": "ui_hammer",
    "⏳": "ui_timedout",
    "🔑": "ui_key",

    // Pessoas e cargos
    "👤": "user", "👥": "membros",
    "🏷️": "role", "🏷": "role",
    "👑": "crown", "🎭": "mascaras",
    "🤖": "bot", "👋": "aceno",

    // Servidor e canais
    "🏰": "server",
    "💬": "chat",
    "🔊": "ui_voicec",
    "🎙️": "voz", "🎙": "voz", "🎤": "ui_mic",
    "📁": "pasta", "📂": "pasta",
    "📜": "logs",
    "🎫": "ticket",
    "📡": "ui_wifi", "📶": "ping",
    "🌐": "ui_world",
    "🔗": "ui_url",

    // Utilidades
    "⚙️": "config", "⚙": "config",
    "🔧": "ui_wrench", "🛠️": "ui_wrench", "🛠": "ui_wrench",
    "🕒": "clock",
    "📊": "stats", "📈": "ui_chart",
    "✉️": "ui_send", "✉": "ui_send",
    "🗑️": "ui_trashcan", "🗑": "ui_trashcan",
    "🔄": "ui_torefresh", "♻️": "ui_torefresh", "♻": "ui_torefresh",
    "🧪": "ui_flask",

    // Destaques
    "🏆": "trophy",
    "💰": "moneybag",
    "⭐": "ui_fav", "🌟": "ui_fav",
    "✨": "ui_sparks",
    "🎉": "ui_celebrating",
    "🚀": "ui_rocket",
    "📌": "ui_pin",

    // Setas e controles
    "➕": "ui_plus", "➖": "ui_minus",
    "⬆️": "ui_up", "⬆": "ui_up",
    "⬅️": "ui_arrowl", "⬅": "ui_arrowl",
    "➡️": "ui_arrowsr", "➡": "ui_arrowsr"
};
