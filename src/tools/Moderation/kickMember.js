const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "kickMember",

            description: "Expulsa um membro do servidor.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.KickMembers
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

                        description: "Motivo da expulsão."

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
            args.reason ?? "Nenhum motivo informado.";



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

                error: "Não posso expulsar o dono do servidor."

            };

        }



        if (member.id === message.client.user.id) {

            return {

                success: false,

                error: "Não posso expulsar a mim mesmo."

            };

        }



        if (member.id === message.author.id) {

            return {

                success: false,

                error: "Você não pode expulsar a si mesmo."

            };

        }



        if (!member.kickable) {

            return {

                success: false,

                error: "Não tenho permissão para expulsar este membro."

            };

        }



        try {


            await member.kick(reason);



            await LogManager.send({

                type: LogTypes.KICK,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason

            });



            return {

                success: true,

                action: "kick",

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