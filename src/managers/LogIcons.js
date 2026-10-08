const emojis = require("../config/emojis");

module.exports = {

    /*
    =========================
        MODERAÇÃO
    =========================
    */

    BAN: "🔨",
    UNBAN: "♻️",
    KICK: "👢",
    WARN: "⚠️",
    REMOVE_WARN: "🗑️",
    TIMEOUT: "🔇",
    REMOVE_TIMEOUT: "🔊",
    PURGE: "🧹",
    LOCK: "🔒",
    UNLOCK: "🔓",
    SLOWMODE: "🐢",

    /*
    =========================
        MEMBROS
    =========================
    */

    MEMBER_JOIN: "📥",
    MEMBER_LEAVE: "📤",
    MEMBER_BOOST: "🚀",
    MEMBER_UNBOOST: "📉",
    MEMBER_NICKNAME: "📝",

    /*
    =========================
        MENSAGENS
    =========================
    */

    MESSAGE_DELETE: "🗑️",
    MESSAGE_EDIT: "✏️",
    MESSAGE_BULK_DELETE: "🧹",

    /*
    =========================
        CANAIS
    =========================
    */

    CHANNEL_CREATE: "📁",
    CHANNEL_DELETE: "🗑️",
    CHANNEL_UPDATE: "✏️",

    /*
    =========================
        CARGOS
    =========================
    */

    ROLE_CREATE: "🎭",
    ROLE_DELETE: "🗑️",
    ROLE_UPDATE: "✏️",
    ROLE_ADD: "➕",
    ROLE_REMOVE: "➖",

    /*
    =========================
        VOZ
    =========================
    */

    VOICE_JOIN: "🎙️",
    VOICE_LEAVE: "🚪",
    VOICE_MOVE: "🔄",

    /*
    =========================
        ECONOMIA
    =========================
    */

    DAILY: "📅",
    WORK: "💼",
    CRIME: "🦹",
    ROB: "🥷",
    DEPOSIT: "🏦",
    WITHDRAW: "💸",
    TRANSFER: "💳",
    BUY: "🛒",
    SELL: "🏷️",
    MONEY_ADD: "➕💰",
    MONEY_REMOVE: "➖💰",

    /*
    =========================
        JOGOS
    =========================
    */

    SLOTS: "🎰",
    BLACKJACK: "🃏",
    COINFLIP: "🪙",
    ROULETTE: "🎡",

    /*
    =========================
        TICKETS
    =========================
    */

    TICKET_CREATE: "🎫",
    TICKET_CLOSE: "🔒",
    TICKET_REOPEN: "🔓",
    TICKET_DELETE: "🗑️",

    /*
    =========================
        IA
    =========================
    */

    AI_COMMAND: "🤖",
    AI_TOOL: "🛠️",
    AI_ERROR: "❌",

    /*
    =========================
        SISTEMA
    =========================
    */

    BOT_START: emojis.status.on,
    BOT_STOP: emojis.status.off,
    DATABASE_ERROR: "💾❌",

    /*
    =========================
        SORTEIOS
    =========================
    */

    GIVEAWAY: "🎉",

    /*
    =========================
        AUTOMOD
    =========================
    */

    AUTOMOD: "🛡️🤖",

    RAID: "🚨",

    ANTINUKE_TRIGGER: "☢️"

};