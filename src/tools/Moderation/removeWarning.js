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

            name: "removeWarning",

            description: "Remove uma advertência específica de um membro, pelo ID da advertência (obtido com getWarnings).",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.ModerateMembers
            ],

            parameters: {

                type: "object",

                properties: {

                    warningId: {

                        type: "number",

                        description: "ID da advertência a remover (número mostrado por getWarnings/warnings)."

                    }

                },

                required: [
                    "warningId"
                ]

            }

        });

    }


    async execute(message, args) {

        const warningId = Number(args.warningId);

        if (!warningId || Number.isNaN(warningId)) {

            return {
                success: false,
                error: "ID de advertência inválido."
            };

        }

        const warning = await WarningRepository.getById(warningId);

        if (!warning || warning.guild_id !== message.guild.id) {

            return {
                success: false,
                error: "Advertência não encontrada neste servidor."
            };

        }

        await WarningRepository.delete(warningId);

        const remaining = await WarningRepository.count({
            guildId: message.guild.id,
            userId: warning.user_id
        });

        await LogManager.send({
            type: LogTypes.REMOVE_WARN,
            guild: message.guild,
            executor: message.member,
            target: {
                id: warning.user_id,
                tag: `<@${warning.user_id}>`,
                username: `<@${warning.user_id}>`
            },
            reason: `Advertência #${warningId} removida.`,
            extra: {
                warningId,
                remaining
            }
        });

        return {
            success: true,
            action: "removeWarning",
            warningId,
            userId: warning.user_id,
            remaining
        };

    }


};
