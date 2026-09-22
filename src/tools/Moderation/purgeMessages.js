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

            name: "purgeMessages",

            description: "Limpa mensagens de um canal.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.ManageMessages
            ],

            parameters: {

                type: "object",

                properties: {

                    amount: {

                        type: "integer",

                        description: "Quantidade de mensagens.",

                        minimum: 1,

                        maximum: 100

                    }

                },

                required: [
                    "amount"
                ]

            }

        });

    }



    async execute(message, args) {


        const amount =
            Number(args.amount);



        if (Number.isNaN(amount)) {

            return {

                success: false,

                error: "Quantidade inválida."

            };

        }



        if (amount < 1 || amount > 100) {

            return {

                success: false,

                error: "A quantidade deve estar entre 1 e 100."

            };

        }



        if (!message.channel.bulkDelete) {

            return {

                success: false,

                error: "Este canal não suporta limpeza de mensagens."

            };

        }



        const channelData = {

            id: message.channel.id,

            name: message.channel.name

        };



        try {


            actionSuppression.suppress(message.channel.id);

            const deleted =
                await message.channel.bulkDelete(

                    amount,

                    true

                );



            await LogManager.send({

                type: LogTypes.PURGE_MESSAGES,

                guild: message.guild,

                executor: message.member,

                channel: channelData,

                extra: {

                    deleted: deleted.size

                }

            });



            return {

                success: true,

                action: "purge",

                channel: channelData,

                deleted: deleted.size,

                logged: true,

                message:
                    `${deleted.size} mensagens removidas.`

            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};