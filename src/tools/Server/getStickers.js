module.exports = {

    name: "getStickers",

    description: "Lista todas as figurinhas do servidor.",

    category: "Server",

    guildOnly: true,

    ownerOnly: false,

    parameters: {

        type: "object",

        properties: {},

        required: []

    },

    async execute(message) {

        if (!message.guild) {

            return {

                success: false,

                message: "Este comando só pode ser utilizado em servidores."

            };

        }

        return {

            success: true,

            data: message.guild.stickers.cache.map(sticker => ({

                id: sticker.id,

                name: sticker.name,

                description: sticker.description,

                tags: sticker.tags

            }))

        };

    }

};