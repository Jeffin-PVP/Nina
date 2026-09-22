const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const WarningRepository = require("../../database/repositories/WarningRepository");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "warnMember",

            description: "Aplica uma advertência a um membro.",

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

                        description: "Motivo da advertência."

                    }

                },

                required: [
                    "userId",
                    "reason"
                ]

            }

        });

    }



    async execute(message, args) {


        const reason =
            args.reason || "Nenhum motivo informado.";



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

                error: "Não posso advertir o dono do servidor."

            };

        }



        if (member.id === message.client.user.id) {

            return {

                success: false,

                error: "Não posso advertir a mim mesmo."

            };

        }



        if (member.id === message.author.id) {

            return {

                success: false,

                error: "Você não pode advertir a si mesmo."

            };

        }



        if (!member.moderatable) {

            return {

                success: false,

                error: "Não tenho permissão para moderar este membro."

            };

        }



        try {


            await WarningRepository.create({

                guildId: message.guild.id,

                userId: member.id,

                moderatorId: message.author.id,

                reason

            });



            const totalWarnings =
                await WarningRepository.count({

                    guildId: message.guild.id,

                    userId: member.id

                });



            let dmSent = true;



            try {


                await member.send({

                    embeds: [

                        {

                            color: 0xffcc00,

                            title:
                                "⚠️ Você recebeu uma advertência",

                            description:

                                `Você recebeu uma advertência no servidor **${message.guild.name}**.\n\n` +

                                `**Motivo:** ${reason}\n` +

                                `**Aplicado por:** ${message.author.username}\n` +

                                `**Total de advertências:** ${totalWarnings}`

                        }

                    ]

                });


            } catch {


                dmSent = false;


            }



            await LogManager.send({

                type: LogTypes.WARN,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason,

                extra: {

                    warnings: totalWarnings,

                    dmSent

                }

            });



            return {

                success: true,

                action: "warn",

                target: targetData,

                moderator: {

                    id: message.author.id,

                    username: message.author.username

                },

                reason,

                warnings: totalWarnings,

                dmSent,

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