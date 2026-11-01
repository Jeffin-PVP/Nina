const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");
const moderationConfirm = require("../../interactions/moderation/confirmAction");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("ban")

        .setDescription(
            "Bane um membro do servidor."
        )

        .addUserOption(option =>

            option

                .setName("membro")

                .setDescription(
                    "Membro que será banido."
                )

                .setRequired(true)

        )

        .addIntegerOption(option =>
            option
                .setName("duracao")
                .setDescription("Duração do banimento temporário (opcional).")
                .setRequired(false)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option
                .setName("unidade")
                .setDescription("Unidade da duração do banimento temporário.")
                .setRequired(false)
                .addChoices(
                    { name: "Minutos", value: "minutes" },
                    { name: "Horas", value: "hours" },
                    { name: "Dias", value: "days" }
                )
        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo do banimento."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.BanMembers

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const member =
            interaction.options.getMember("membro");

        const user =
            interaction.options.getUser("membro");

        const duration = interaction.options.getInteger("duracao");
        const unit = interaction.options.getString("unidade");
        const reason =
            interaction.options.getString("motivo") ??
            "Nenhum motivo informado.";

        if (!user) {

            return interaction.editReply({

                embeds: [

                    ui.error("Usuário não encontrado.", undefined, interaction)

                ]

            });

        }

        const durationText = duration && unit ? ` por ${duration} ${unit === "days" ? "dias" : unit === "hours" ? "horas" : "minutos"}` : "";

        await moderationConfirm.prompt(interaction, {
            title: "Confirmar banimento",
            description: `Você está prestes a banir <@${user.id}>${durationText}.\n\n**Motivo:** ${reason}`,
            action: "ban",
            payload: {
                userId: user.id,
                reason,
                duration,
                unit,
                deleteMessageSeconds: 0
            }
        });

        return;

    }

};