const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");
const ModerationRepository = require("../../database/repositories/ModerationRepository");
const TemporaryBanManager = require("../../managers/TemporaryBanManager");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "banMember",

            description: "Bane um membro do servidor.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.BanMembers
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

                        description: "Motivo do banimento."

                    },

                    deleteMessageSeconds: {

                        type: "integer",

                        description: "Segundos de mensagens para apagar."

                    },
                    duration: {
                        type: "integer",
                        description: "Duração do banimento temporário em minutos, horas ou dias."
                    },
                    unit: {
                        type: "string",
                        description: "Unidade da duração: minutes, hours, days."
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


        const deleteMessageSeconds =
            Math.max(
                0,
                Math.min(
                    Number(args.deleteMessageSeconds ?? 0),
                    604800
                )
            );

        const durationNumber = Number(args.duration ?? 0);
        const unit = String(args.unit ?? "minutes");
        let durationMs = 0;

        if (durationNumber > 0) {
            const multipliers = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
            durationMs = durationNumber * (multipliers[unit] ?? multipliers.minutes);
        }

        const member =            await message.guild.members
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

                error: "Não posso banir o dono do servidor."

            };

        }



        if (member.id === message.client.user.id) {

            return {

                success: false,

                error: "Não posso banir a mim mesmo."

            };

        }



        if (member.id === message.author.id) {

            return {

                success: false,

                error: "Você não pode banir a si mesmo."

            };

        }



        if (!member.bannable) {

            return {

                success: false,

                error: "Não tenho permissão para banir este membro."

            };

        }



        try {


            await member.ban({

                reason,

                deleteMessageSeconds

            });



            const expiresAt = durationMs > 0 ? Date.now() + durationMs : null;

            if (expiresAt) {
                await ModerationRepository.saveTemporaryBan({
                    guildId: message.guild.id,
                    userId: member.id,
                    moderatorId: message.author.id,
                    reason,
                    expiresAt
                });
                TemporaryBanManager.schedule(message.guild.id, member.id, reason, durationMs);
            }

            await ModerationRepository.createCase({
                guildId: message.guild.id,
                userId: member.id,
                moderatorId: message.author.id,
                type: "ban",
                reason,
                metadata: {
                    deleteMessageSeconds,
                    source: "manual",
                    durationMs,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
                }
            });

            await LogManager.send({

                type: LogTypes.BAN,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason,

                extra: {

                    deleteMessageSeconds

                }

            });


            return {
                success: true,

                action: "ban",

                target: targetData,

                moderator: {

                    id: message.author.id,

                    username: message.author.username

                },

                reason,

                deleteMessageSeconds,
                durationMs,
                expiresAt: durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : null,

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