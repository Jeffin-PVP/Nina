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
        emoji: "<:escudo:1562187519150395393>",
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
        emoji: "<:membros:1562187531246637107>",
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
        emoji: "<:chat:1562187513949454366>",
        defaultEnabled: true,
        types: [
            LogTypes.MESSAGE_DELETE,
            LogTypes.MESSAGE_EDIT,
            LogTypes.MESSAGE_BULK_DELETE
        ]
    },

    canais: {
        label: "Canais",
        emoji: "<:pasta:1562187541585600533>",
        defaultEnabled: true,
        types: [
            LogTypes.CHANNEL_CREATE,
            LogTypes.CHANNEL_DELETE,
            LogTypes.CHANNEL_UPDATE
        ]
    },

    cargos: {
        label: "Cargos",
        emoji: "<:cargo:1562189000544882808>",
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
        emoji: "<:voz:1562187549932388383>",
        defaultEnabled: false,
        types: [
            LogTypes.VOICE_JOIN,
            LogTypes.VOICE_LEAVE,
            LogTypes.VOICE_MOVE
        ]
    },

    economia: {
        label: "Economia",
        emoji: "<:moneybag:1561484846159757513>",
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
        emoji: "<:ui_xbox:1560327208961318966>",
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
        emoji: "<:ticket:1562187545914380319>",
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
        emoji: "<:bot:1562187511848243271>",
        defaultEnabled: false,
        types: [
            LogTypes.AI_COMMAND,
            LogTypes.AI_TOOL,
            LogTypes.AI_ERROR
        ]
    },

    sistema: {
        label: "Sistema",
        emoji: "<:config:1562187516625555496>",
        defaultEnabled: true,
        types: [
            LogTypes.BOT_START,
            LogTypes.BOT_STOP,
            LogTypes.DATABASE_ERROR
        ]
    },

    sorteios: {
        label: "Sorteios",
        emoji: "<a:ui_celebrating:1560326769876140158>",
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
        emoji: "<:escudo:1562187519150395393>",
        defaultEnabled: true,
        types: [
            LogTypes.AUTOMOD_ACTION,
            LogTypes.RAID_DETECTED,
            LogTypes.RAID_LOCKDOWN_LIFT
        ]
    },

    antinuke: {
        label: "Anti-Nuke",
        emoji: "<:nuclear:1562187533721272451>",
        defaultEnabled: true,
        types: [
            LogTypes.ANTINUKE_TRIGGER
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
