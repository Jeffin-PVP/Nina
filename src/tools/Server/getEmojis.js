const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getEmojis",

            description: "Lista todos os emojis do servidor.",

            category: "Server"

        });

    }

    async execute(message) {

        return message.guild.emojis.cache.map(emoji => ({

            id: emoji.id,

            name: emoji.name,

            animated: emoji.animated,

            available: emoji.available,

            url: emoji.imageURL()

        }));

    }

};