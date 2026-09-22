const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {

    name: "createCategory",

    description: "Cria uma categoria no servidor.",

    parameters: {

        type: "object",

        properties: {

            name: {
                type: "string",
                description: "Nome da categoria."
            }

        },

        required: ["name"]

    },

    guildOnly: true,

    ownerOnly: false,

    async execute(message, args) {

        const guild = message.guild;

        if (!guild) {

            return {

                success: false,

                message: "Este comando só funciona em servidores."

            };

        }

        const existing = guild.channels.cache.find(c =>

            c.type === ChannelType.GuildCategory &&
            c.name.toLowerCase() === args.name.toLowerCase()

        );

        if (existing) {

            return {

                success: false,

                message: "Já existe uma categoria com esse nome."

            };

        }

        const category = await guild.channels.create({

            name: args.name,

            type: ChannelType.GuildCategory,

            reason: `Criada pela IA (${message.author.tag})`

        });

        return {

            success: true,

            id: category.id,

            name: category.name,

            message: `Categoria "${category.name}" criada.`

        };

    }

};