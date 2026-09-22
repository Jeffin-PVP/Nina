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

            name: "lockChannel",

            description: "Tranca um canal do servidor.",

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

                    reason: {

                        type: "string",

                        description: "Motivo."

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
            message.guild.channels.cache.get(args.channelId);



        if (!channel) {

            return {

                success: false,

                error: "Canal não encontrado."

            };

        }



        if (!channel.permissionOverwrites) {

            return {

                success: false,

                error: "Este canal não suporta permissões."

            };

        }



        const reason =
            args.reason || "Canal trancado.";



        const channelData = {

            id: channel.id,

            name: channel.name

        };



        try {


            actionSuppression.suppress(`channel:${channel.id}`);

            await channel.permissionOverwrites.edit(

                message.guild.roles.everyone,

                {

                    SendMessages: false

                },

                {

                    reason

                }

            );



            await LogManager.send({

                type: LogTypes.LOCK_CHANNEL,

                guild: message.guild,

                executor: message.member,

                channel: channelData,

                reason

            });



            return {

                success: true,

                action: "channel_lock",

                channel: channelData,

                reason,

                logged: true

            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};