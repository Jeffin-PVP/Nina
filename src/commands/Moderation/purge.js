const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const ToolManager =
    require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("purge")

        .setDescription(
            "Remove mensagens de um canal."
        )

        .addIntegerOption(option =>

            option

                .setName("quantidade")

                .setDescription(
                    "Quantidade de mensagens (1-100)."
                )

                .setRequired(true)

                .setMinValue(1)

                .setMaxValue(100)

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo da limpeza."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.ManageMessages

        ),

    async execute(interaction) {

        await interaction.deferReply({

            flags: MessageFlags.Ephemeral

        });

        const amount =
            interaction.options.getInteger("quantidade");

        const reason =
            interaction.options.getString("motivo")
            ?? "Nenhum motivo informado.";

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

                    "purgeMessages",

                    fakeMessage,

                    {

                        amount,

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

            const embed = ui.modEmbed({
                emoji: "purge",
                title: "Mensagens removidas",
                color: ui.COLORS.success,
                moderator: interaction.user,
                reason,
                fields: [
                    { name: `${e("channel")} Canal`, value: `${interaction.channel}`, inline: true },
                    { name: `${e("purge")} Quantidade`, value: `${amount}`, inline: true }
                ],
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