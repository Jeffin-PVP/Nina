const {
    ChannelType
} = require("discord.js");

const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getCategories",

            description: "Lista todas as categorias do servidor.",

            category: "Server"

        });

    }

    async execute(message) {

        return message.guild.channels.cache

            .filter(c => c.type === ChannelType.GuildCategory)

            .sort((a, b) => a.position - b.position)

            .map(category => ({

                id: category.id,

                name: category.name,

                position: category.position,

                channels:

                    category.children.cache.map(channel => ({

                        id: channel.id,

                        name: channel.name,

                        type: ChannelType[channel.type]

                    }))

            }));

    }

};