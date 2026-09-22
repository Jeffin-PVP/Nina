const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const actionSuppression = require("../../utils/actionSuppression");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "slowmodeChannel",

            description: "Altera o slowmode de um canal.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.ManageChannels
            ],

            parameters: {

                type: "object",

                properties: {

                    time: {

                        type: "integer",

                        description: "Tempo do slowmode.",

                        minimum: 0

                    },

                    unit: {

                        type: "string",

                        description: "Unidade do tempo.",

                        enum: [
                            "seconds",
                            "minutes",
                            "hours"
                        ]

                    },

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

                required: [
                    "time"
                ]

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



        if (!channel.setRateLimitPerUser) {

            return {

                success: false,

                error: "Este canal não suporta slowmode."

            };

        }



        const time =
            Number(args.time);



        if (Number.isNaN(time) || time < 0) {

            return {

                success: false,

                error: "Tempo inválido."

            };

        }



        let seconds = time;



        switch (args.unit) {


            case "hours":

                seconds = time * 3600;

                break;



            case "minutes":

                seconds = time * 60;

                break;



            case "seconds":

            default:

                seconds = time;

        }



        if (seconds > 21600) {

            return {

                success: false,

                error: "O Discord permite no máximo 6 horas."

            };

        }



        const reason =
            args.reason || "Slowmode alterado.";



        const channelData = {

            id: channel.id,

            name: channel.name

        };



        try {


            actionSuppression.suppress(`channel:${channel.id}`);

            await channel.setRateLimitPerUser(

                seconds,

                reason

            );



            await LogManager.send({

                type: LogTypes.SLOWMODE_CHANNEL,

                guild: message.guild,

                executor: message.member,

                channel: channelData,

                reason,

                extra: {

                    seconds,

                    status:
                        seconds === 0
                            ? "removido"
                            : "alterado"

                }

            });



            return {

                success: true,

                action: "slowmode",

                channel: channelData,

                seconds,

                reason,

                logged: true,

                message:

                    seconds === 0

                        ? `Slowmode removido de #${channel.name}.`

                        : `Slowmode alterado para ${seconds} segundos em #${channel.name}.`

            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};