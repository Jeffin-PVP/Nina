const { E } = require("../config/emojiRegistry");
const emojis = require("../config/emojis");

module.exports = {

    /*
    =========================
        MODERAÇÃO
    =========================
    */

    BAN: E("ui_hammer"),
    UNBAN: E("ui_hammer"),
    KICK: E("ui_hammer"),
    WARN: E("warn"),
    REMOVE_WARN: E("warn"),
    TIMEOUT: E("ui_timedout"),
    REMOVE_TIMEOUT: E("ui_timedout"),
    PURGE: E("ui_trashcan"),
    LOCK: E("lock"),
    UNLOCK: E("unlock"),
    SLOWMODE: E("clock"),

    /*
    =========================
        MEMBROS
    =========================
    */

    MEMBER_JOIN: E("ui_invite"),
    MEMBER_LEAVE: E("ui_invite"),
    MEMBER_BOOST: E("ui_boost3"),
    MEMBER_UNBOOST: E("ui_boost1"),
    MEMBER_NICKNAME: E("ui_author"),

    /*
    =========================
        MENSAGENS
    =========================
    */

    MESSAGE_DELETE: E("ui_trashcan"),
    MESSAGE_EDIT: E("ui_title"),
    MESSAGE_BULK_DELETE: E("ui_trashcan"),

    /*
    =========================
        CANAIS
    =========================
    */

    CHANNEL_CREATE: E("ui_textc"),
    CHANNEL_DELETE: E("ui_trashcan"),
    CHANNEL_UPDATE: E("ui_title"),

    /*
    =========================
        CARGOS
    =========================
    */

    ROLE_CREATE: E("ui_fav"),
    ROLE_DELETE: E("ui_trashcan"),
    ROLE_UPDATE: E("ui_arrowsr"),
    ROLE_ADD: E("ui_plus"),
    ROLE_REMOVE: E("ui_minus"),

    /*
    =========================
        VOZ
    =========================
    */

    VOICE_JOIN: E("ui_voicecsuccess"),
    VOICE_LEAVE: E("ui_voicecdanger"),
    VOICE_MOVE: E("ui_arrowsr"),

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
    SELL: E("role"),
    MONEY_ADD: `${E("ui_plus")}${E("moneybag")}`,
    MONEY_REMOVE: `${E("ui_minus")}${E("moneybag")}`,

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

    TICKET_CREATE: E("ticket"),
    TICKET_CLOSE: E("lock"),
    TICKET_REOPEN: E("unlock"),
    TICKET_DELETE: E("ui_trashcan"),

    /*
    =========================
        IA
    =========================
    */

    AI_COMMAND: E("bot"),
    AI_TOOL: E("ui_wrench"),
    AI_ERROR: E("ui_cancel"),

    /*
    =========================
        SISTEMA
    =========================
    */

    BOT_START: emojis.status.on,
    BOT_STOP: emojis.status.off,
    DATABASE_ERROR: `💾${E("ui_cancel")}`,

    /*
    =========================
        SORTEIOS
    =========================
    */

    GIVEAWAY: E("ui_celebrating"),

    /*
    =========================
        AUTOMOD
    =========================
    */

    AUTOMOD: `${E("shield")}${E("bot")}`,

    RAID: "🚨",

    ANTINUKE_TRIGGER: "☢️"

};