const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");
const actionSuppression = require("../../utils/actionSuppression");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "unlockChannel",

            description: "Destranca um canal.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.ManageChannels
            ],

            parameters: {

                type: "object",

                properties: {

                    channelId: {

                        type: "string",

                        description: "ID do canal."

                    },

                    channelName: {

                        type: "string",

                        description: "Nome do canal."

                    },

                    reason: {

                        type: "string",

                        description: "Motivo."

                    }

                },

                required: []

            }

        });

    }



    async execute(message, args) {


        let channel = null;



        if (args.channelId) {

            channel =
                message.guild.channels.cache.get(args.channelId);

        }



        if (!channel && args.channelName) {

            channel =
                message.guild.channels.cache.find(c =>
                    c.name.toLowerCase() === args.channelName.toLowerCase()
                );

        }



        if (!channel) {

            channel = message.channel;

        }



        if (!channel.permissionOverwrites) {

            return {

                success: false,

                error: "Este canal não suporta permissões."

            };

        }



        const reason =
            args.reason || "Canal destrancado.";



        const channelData = {

            id: channel.id,

            name: channel.name

        };



        try {


            actionSuppression.suppress(`channel:${channel.id}`);

            await channel.permissionOverwrites.edit(

                message.guild.roles.everyone,

                {

                    SendMessages: null

                },

                {

                    reason

                }

            );



            await LogManager.send({

                type: LogTypes.UNLOCK_CHANNEL,

                guild: message.guild,

                executor: message.member,

                channel: channelData,

                reason

            });



            return {

                success: true,

                action: "channel_unlock",

                channel: channelData,

                reason,

                logged: true,

                message:
                    `Canal #${channel.name} destrancado.`

            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};