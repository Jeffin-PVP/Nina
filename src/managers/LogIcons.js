const emojis = require("../config/emojis");

module.exports = {

    /*
    =========================
        MODERAÇÃO
    =========================
    */

    BAN: "<:ui_hammer:1560326916345700407>",
    UNBAN: "<:ui_hammer:1560326916345700407>",
    KICK: "<:ui_hammer:1560326916345700407>",
    WARN: "<:warn:1561487772307431435>",
    REMOVE_WARN: "<:warn:1561487772307431435>",
    TIMEOUT: "<:ui_timedout:1560327148315615234>",
    REMOVE_TIMEOUT: "<:ui_timedout:1560327148315615234>",
    PURGE: "<:ui_trashcan:1560327162979029023>",
    LOCK: "<:lock:1561418439879565404>",
    UNLOCK: "<:unlock:1561421260372582490>",
    SLOWMODE: "<:clock:1561426917717053530>",

    /*
    =========================
        MEMBROS
    =========================
    */

    MEMBER_JOIN: "<:ui_invite:1560326931075833916>",
    MEMBER_LEAVE: "<:ui_invite:1560326931075833916>",
    MEMBER_BOOST: "<:ui_boost3:1560326745582731264>",
    MEMBER_UNBOOST: "<:ui_boost1:1560326740985913444>",
    MEMBER_NICKNAME: "<:ui_author:1560326714595479693>",

    /*
    =========================
        MENSAGENS
    =========================
    */

    MESSAGE_DELETE: "<:ui_trashcan:1560327162979029023>",
    MESSAGE_EDIT: "<:ui_title:1560327153088860200>",
    MESSAGE_BULK_DELETE: "<:ui_trashcan:1560327162979029023>",

    /*
    =========================
        CANAIS
    =========================
    */

    CHANNEL_CREATE: "<:ui_textc:1560327137024544808>",
    CHANNEL_DELETE: "<:ui_trashcan:1560327162979029023>",
    CHANNEL_UPDATE: "<:ui_title:1560327153088860200>",

    /*
    =========================
        CARGOS
    =========================
    */

    ROLE_CREATE: "<:ui_fav:1560326869184937996>",
    ROLE_DELETE: "<:ui_trashcan:1560327162979029023>",
    ROLE_UPDATE: "<:ui_arrowsr:1560326708182130828>",
    ROLE_ADD: "<:ui_plus:1560327041839009854>",
    ROLE_REMOVE: "<:ui_minus:1560326977838383134>",

    /*
    =========================
        VOZ
    =========================
    */

    VOICE_JOIN: "<:ui_voicecsuccess:1560327184806322338>",
    VOICE_LEAVE: "<:ui_voicecdanger:1560327182851641446>",
    VOICE_MOVE: "<:ui_arrowsr:1560326708182130828>",

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

    GIVEAWAY: "<a:ui_celebrating:1560326769876140158>",

    /*
    =========================
        AUTOMOD
    =========================
    */

    AUTOMOD: "🛡️🤖",

    RAID: "🚨",

    ANTINUKE_TRIGGER: "☢️"

};