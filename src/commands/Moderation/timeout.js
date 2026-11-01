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

        .setName("timeout")

        .setDescription(
            "Aplica um timeout em um membro."
        )

        .addUserOption(option =>

            option

                .setName("membro")

                .setDescription(
                    "Membro que receberá o timeout."
                )

                .setRequired(true)

        )

        .addIntegerOption(option =>

            option

                .setName("tempo")

                .setDescription(
                    "Tempo do timeout."
                )

                .setRequired(true)

                .setMinValue(1)

        )

        .addStringOption(option =>

            option

                .setName("unidade")

                .setDescription(
                    "Unidade de tempo."
                )

                .setRequired(true)

                .addChoices(

                    {
                        name: "Segundos",
                        value: "seconds"
                    },

                    {
                        name: "Minutos",
                        value: "minutes"
                    },

                    {
                        name: "Horas",
                        value: "hours"
                    },

                    {
                        name: "Dias",
                        value: "days"
                    }

                )

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo do timeout."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.ModerateMembers

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const user =
            interaction.options.getUser("membro");

        const time =
            interaction.options.getInteger("tempo");

        const unit =
            interaction.options.getString("unidade");

        const reason =
            interaction.options.getString("motivo")
            ?? "Nenhum motivo informado.";

        if (!user) {

            return interaction.editReply({

                embeds: [

                    ui.error("Usuário não encontrado.", undefined, interaction)

                ]

            });

        }

        const UNITS = { seconds: "segundo(s)", minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };

        await moderationConfirm.prompt(interaction, {
            title: "Confirmar timeout",
            description: `Você está prestes a aplicar timeout em <@${user.id}> por **${time} ${UNITS[unit] ?? unit}**.\n\n**Motivo:** ${reason}`,
            action: "timeout",
            payload: {
                userId: user.id,
                duration: time,
                unit,
                reason
            }
        });

        return;

    }

};