const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "timeoutMember",

            description: "Aplica timeout em um membro do servidor.",

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

                    duration: {

                        type: "integer",

                        description: "Duração do timeout em minutos."

                    },

                    reason: {

                        type: "string",

                        description: "Motivo do timeout."

                    }

                },

                required: [
                    "userId",
                    "duration"
                ]

            }

        });

    }



    async execute(message, args) {


        const reason =
            args.reason ?? "Nenhum motivo informado.";



        const duration =
            Number(args.duration);



        if (Number.isNaN(duration) || duration <= 0) {

            return {

                success: false,

                error: "A duração deve ser um número maior que zero."

            };

        }



        const MAX_MINUTES =
            28 * 24 * 60;



        if (duration > MAX_MINUTES) {

            return {

                success: false,

                error: "O timeout máximo permitido é de 28 dias."

            };

        }



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

                error: "Não posso aplicar timeout no dono do servidor."

            };

        }



        if (member.id === message.client.user.id) {

            return {

                success: false,

                error: "Não posso aplicar timeout em mim."

            };

        }



        if (member.id === message.author.id) {

            return {

                success: false,

                error: "Você não pode aplicar timeout em si mesmo."

            };

        }



        if (!member.moderatable) {

            return {

                success: false,

                error: "Não tenho permissão para aplicar timeout neste membro."

            };

        }



        if (member.communicationDisabledUntil) {

            return {

                success: false,

                error: "Este membro já está em timeout."

            };

        }



        try {


            await member.timeout(

                duration * 60 * 1000,

                reason

            );



            await LogManager.send({

                type: LogTypes.TIMEOUT,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason,

                extra: {

                    duration: `${duration} minuto(s)`,

                    timeoutUntil:
                        member.communicationDisabledUntil

                }

            });



            return {

                success: true,

                action: "timeout",

                target: targetData,

                moderator: {

                    id: message.author.id,

                    username: message.author.username

                },

                duration,

                durationText:
                    `${duration} minuto(s)`,

                reason,

                timeoutUntil:
                    member.communicationDisabledUntil,

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