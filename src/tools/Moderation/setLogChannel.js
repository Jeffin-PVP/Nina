const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const GuildRepository =
    require("../../database/repositories/GuildRepository");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "setLogChannel",

            description: "Define o canal de logs do servidor.",

            category: "Configuration",

            guildOnly: true,

            permissions: [

                PermissionFlagsBits.Administrator

            ],

            parameters: {

                type: "object",

                properties: {

                    channelId: {

                        type: "string",

                        description: "ID do canal."

                    }

                },

                required: [

                    "channelId"

                ]

            }

        });

    }

    async execute(message, args) {

        const channel =
            message.guild.channels.cache.get(
                args.channelId
            );

        if (!channel) {

            return {

                success: false,

                error: "Canal não encontrado."

            };

        }

        try {

            await GuildRepository.setLogChannel({

                guildId: message.guild.id,

                channelId: channel.id

            });

            return {

                success: true,

                channelId: channel.id,

                channelName: channel.name,

                message: `Canal de logs definido para #${channel.name}.`

            };

        } catch (error) {

            return {

                success: false,

                error: error.message

            };

        }

    }

};