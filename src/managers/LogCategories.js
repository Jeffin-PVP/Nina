const LogTypes = require("./LogTypes");

/*
=========================================
    CATEGORIAS DE LOG

    Cada categoria pode ser ativada/desativada
    individualmente por servidor (/logs categoria).
=========================================
*/

const CATEGORIES = {

    moderacao: {
        label: "Moderação",
        emoji: "🛡️",
        defaultEnabled: true,
        types: [
            LogTypes.BAN,
            LogTypes.UNBAN_MEMBER,
            LogTypes.KICK,
            LogTypes.WARN,
            LogTypes.REMOVE_WARN,
            LogTypes.TIMEOUT,
            LogTypes.REMOVE_TIMEOUT,
            LogTypes.PURGE_MESSAGES,
            LogTypes.LOCK_CHANNEL,
            LogTypes.UNLOCK_CHANNEL,
            LogTypes.SLOWMODE_CHANNEL
        ]
    },

    membros: {
        label: "Membros",
        emoji: "👥",
        defaultEnabled: true,
        types: [
            LogTypes.MEMBER_JOIN,
            LogTypes.MEMBER_LEAVE,
            LogTypes.MEMBER_BOOST,
            LogTypes.MEMBER_UNBOOST,
            LogTypes.MEMBER_NICKNAME
        ]
    },

    mensagens: {
        label: "Mensagens",
        emoji: "💬",
        defaultEnabled: true,
        types: [
            LogTypes.MESSAGE_DELETE,
            LogTypes.MESSAGE_EDIT,
            LogTypes.MESSAGE_BULK_DELETE
        ]
    },

    canais: {
        label: "Canais",
        emoji: "📁",
        defaultEnabled: true,
        types: [
            LogTypes.CHANNEL_CREATE,
            LogTypes.CHANNEL_DELETE,
            LogTypes.CHANNEL_UPDATE
        ]
    },

    cargos: {
        label: "Cargos",
        emoji: "🎭",
        defaultEnabled: true,
        types: [
            LogTypes.ROLE_CREATE,
            LogTypes.ROLE_DELETE,
            LogTypes.ROLE_UPDATE,
            LogTypes.ROLE_ADD,
            LogTypes.ROLE_REMOVE
        ]
    },

    voz: {
        label: "Voz",
        emoji: "🎙️",
        defaultEnabled: false,
        types: [
            LogTypes.VOICE_JOIN,
            LogTypes.VOICE_LEAVE,
            LogTypes.VOICE_MOVE
        ]
    },

    economia: {
        label: "Economia",
        emoji: "💰",
        defaultEnabled: false,
        types: [
            LogTypes.DAILY,
            LogTypes.WORK,
            LogTypes.CRIME,
            LogTypes.ROB,
            LogTypes.DEPOSIT,
            LogTypes.WITHDRAW,
            LogTypes.TRANSFER,
            LogTypes.BUY,
            LogTypes.SELL,
            LogTypes.MONEY_ADD,
            LogTypes.MONEY_REMOVE
        ]
    },

    jogos: {
        label: "Jogos",
        emoji: "🎮",
        defaultEnabled: false,
        types: [
            LogTypes.SLOTS,
            LogTypes.BLACKJACK,
            LogTypes.COINFLIP,
            LogTypes.ROULETTE
        ]
    },

    tickets: {
        label: "Tickets",
        emoji: "🎫",
        defaultEnabled: true,
        types: [
            LogTypes.TICKET_CREATE,
            LogTypes.TICKET_CLOSE,
            LogTypes.TICKET_REOPEN,
            LogTypes.TICKET_DELETE
        ]
    },

    ia: {
        label: "Inteligência Artificial",
        emoji: "🤖",
        defaultEnabled: false,
        types: [
            LogTypes.AI_COMMAND,
            LogTypes.AI_TOOL,
            LogTypes.AI_ERROR
        ]
    },

    sistema: {
        label: "Sistema",
        emoji: "⚙️",
        defaultEnabled: true,
        types: [
            LogTypes.BOT_START,
            LogTypes.BOT_STOP,
            LogTypes.DATABASE_ERROR
        ]
    },

    sorteios: {
        label: "Sorteios",
        emoji: "🎉",
        defaultEnabled: true,
        types: [
            LogTypes.GIVEAWAY_CREATE,
            LogTypes.GIVEAWAY_END,
            LogTypes.GIVEAWAY_CANCEL,
            LogTypes.GIVEAWAY_REROLL,
            LogTypes.GIVEAWAY_EDIT
        ]
    },

    automod: {
        label: "AutoMod",
        emoji: "🛡️",
        defaultEnabled: true,
        types: [
            LogTypes.AUTOMOD_ACTION,
            LogTypes.RAID_DETECTED,
            LogTypes.RAID_LOCKDOWN_LIFT
        ]
    }

};

// Mapa reverso: tipo de log -> chave da categoria
const CATEGORY_OF = {};

for (const [key, category] of Object.entries(CATEGORIES)) {
    for (const type of category.types) {
        CATEGORY_OF[type] = key;
    }
}

const DEFAULT_DISABLED = Object.entries(CATEGORIES)
    .filter(([, category]) => !category.defaultEnabled)
    .map(([key]) => key);

module.exports = {
    CATEGORIES,
    CATEGORY_OF,
    DEFAULT_DISABLED
};
