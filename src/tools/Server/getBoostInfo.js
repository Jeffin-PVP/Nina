const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getBoostInfo",

            description: "Obtém informações sobre os boosts do servidor.",

            category: "Server"

        });

    }

    async execute(message) {

        const guild = message.guild;

        return {

            tier: guild.premiumTier,

            boosts: guild.premiumSubscriptionCount,

            boosterRole: guild.roles.premiumSubscriberRole?.name ?? null

        };

    }

};