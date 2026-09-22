const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "removeTimeout",

            description: "Remove o timeout de um membro.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.ModerateMembers
            ],

            parameters: {

                type: "object",

                properties: {

                    userId: {

                        type: "string",

                        description: "ID do membro."

                    },

                    reason: {

                        type: "string",

                        description: "Motivo da remoção do timeout."

                    }

                },

                required: [
                    "userId"
                ]

            }

        });

    }



    async execute(message, args) {


        const reason =
            args.reason ?? "Timeout removido.";



        const member =
            await message.guild.members
                .fetch(args.userId)
                .catch(() => null);



        if (!member) {

            return {

                success: false,

                error: "Membro não encontrado."

            };

        }



        const targetData = {

            id: member.id,

            username: member.user.username,

            displayName: member.displayName

        };



        if (member.id === message.guild.ownerId) {

            return {

                success: false,

                error: "Não posso remover timeout do dono do servidor."

            };

        }



        if (member.id === message.client.user.id) {

            return {

                success: false,

                error: "Não posso remover meu próprio timeout."

            };

        }



        if (!member.moderatable) {

            return {

                success: false,

                error: "Não tenho permissão para modificar este membro."

            };

        }



        if (!member.communicationDisabledUntil) {

            return {

                success: false,

                error: "Este membro não está em timeout."

            };

        }



        try {


            await member.timeout(

                null,

                reason

            );



            await LogManager.send({

                type: LogTypes.REMOVE_TIMEOUT,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason

            });



            return {

                success: true,

                action: "removeTimeout",

                target: targetData,

                moderator: {

                    id: message.author.id,

                    username: message.author.username

                },

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