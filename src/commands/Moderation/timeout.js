const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const ToolManager =
    require("../../ai/ToolManager");

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

        try {

            const fakeMessage = {

                guild: interaction.guild,

                member: interaction.member,

                author: interaction.user,

                client: interaction.client,

                channel: interaction.channel

            };

            const result =
                await ToolManager.execute(

                    "timeoutMember",

                    fakeMessage,

                    {

                        userId: user.id,

                        time,

                        unit,

                        reason

                    }

                );

            if (!result.success) {

                return interaction.editReply({

                    embeds: [

                        ui.error(result.error, undefined, interaction)

                    ]

                });

            }

            const UNITS = { seconds: "segundo(s)", minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };

            const embed = ui.modEmbed({
                emoji: "timeout",
                title: "Timeout aplicado",
                color: ui.COLORS.info,
                user,
                moderator: interaction.user,
                reason,
                fields: [{ name: `${e("clock")} Duração`, value: `${time} ${UNITS[unit] ?? unit}`, inline: true }],
                source: interaction
            });

            await interaction.editReply({

                embeds: [

                    embed

                ]

            });

        } catch (error) {

            console.error(error);

            await interaction.editReply({

                embeds: [

                    ui.error("Ocorreu um erro ao executar o comando.", undefined, interaction)

                ]

            });

        }

    }

};