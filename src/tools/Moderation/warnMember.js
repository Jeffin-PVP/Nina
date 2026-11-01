const { E } = require("../../config/emojiRegistry");
const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const WarningRepository = require("../../database/repositories/WarningRepository");
const ModerationRepository = require("../../database/repositories/ModerationRepository");

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


            const warningId = await WarningRepository.create({

                guildId: message.guild.id,

                userId: member.id,

                moderatorId: message.author.id,

                reason

            });

            await ModerationRepository.createCase({
                guildId: message.guild.id,
                userId: member.id,
                moderatorId: message.author.id,
                type: "warn",
                reason,
                metadata: {
                    warning_id: warningId,
                    auto_action: false
                }
            });

            const totalWarnings =
                await WarningRepository.count({

                    guildId: message.guild.id,

                    userId: member.id

                });

            const progression = await ModerationRepository.getGuildSettings(message.guild.id);
            let autoAction = null;

            if (totalWarnings >= Number(progression.warns_to_ban || 8)) {
                const banReason = `Auto-punição por ${totalWarnings} advertências no servidor.`;
                await member.ban({ reason: banReason, deleteMessageSeconds: 0 });
                await ModerationRepository.createCase({
                    guildId: message.guild.id,
                    userId: member.id,
                    moderatorId: message.author.id,
                    type: "ban",
                    reason: banReason,
                    metadata: {
                        auto: true,
                        total_warnings: totalWarnings,
                        trigger: "progressive_warns"
                    }
                });
                autoAction = "ban";
            } else if (totalWarnings >= Number(progression.warns_to_kick || 5)) {
                const kickReason = `Auto-punição por ${totalWarnings} advertências no servidor.`;
                await member.kick(kickReason);
                await ModerationRepository.createCase({
                    guildId: message.guild.id,
                    userId: member.id,
                    moderatorId: message.author.id,
                    type: "kick",
                    reason: kickReason,
                    metadata: {
                        auto: true,
                        total_warnings: totalWarnings,
                        trigger: "progressive_warns"
                    }
                });
                autoAction = "kick";
            } else if (totalWarnings >= Number(progression.warns_to_timeout || 3)) {
                const timeoutReason = `Auto-punição por ${totalWarnings} advertências no servidor.`;
                await member.timeout(10 * 60 * 1000, timeoutReason);
                await ModerationRepository.createCase({
                    guildId: message.guild.id,
                    userId: member.id,
                    moderatorId: message.author.id,
                    type: "timeout",
                    reason: timeoutReason,
                    metadata: {
                        auto: true,
                        duration: "10 minutos",
                        total_warnings: totalWarnings,
                        trigger: "progressive_warns"
                    }
                });
                autoAction = "timeout";
            }

            let dmSent = true;


            try {


                await member.send({

                    embeds: [

                        {

                            color: 0xffcc00,

                            title:
                                `${E("warn")} Você recebeu uma advertência`,

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

                autoAction,

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