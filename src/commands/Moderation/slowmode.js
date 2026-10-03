const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const ToolManager =
    require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("slowmode")

        .setDescription(
            "Altera o slowmode de um canal."
        )

        .addIntegerOption(option =>

            option

                .setName("tempo")

                .setDescription(
                    "Tempo do slowmode."
                )

                .setRequired(true)

                .setMinValue(0)

        )

        .addStringOption(option =>

            option

                .setName("unidade")

                .setDescription(
                    "Unidade do tempo."
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
                    }

                )

        )

        .addChannelOption(option =>

            option

                .setName("canal")

                .setDescription(
                    "Canal que receberá o slowmode."
                )

                .addChannelTypes(

                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement

                )

                .setRequired(false)

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo da alteração."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.ManageChannels

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const tempo =
            interaction.options.getInteger("tempo");

        const unidade =
            interaction.options.getString("unidade");

        const canal =
            interaction.options.getChannel("canal");

        const motivo =
            interaction.options.getString("motivo")
            ?? "Slowmode alterado.";

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

                    "slowmodeChannel",

                    fakeMessage,

                    {

                        time: tempo,

                        unit: unidade,

                        channelId: canal?.id,

                        reason: motivo

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
                emoji: "clock",
                title: "Slowmode alterado",
                color: ui.COLORS.info,
                moderator: interaction.user,
                reason: motivo,
                fields: [
                    { name: `${e("channel")} Canal`, value: canal ? `${canal}` : `${interaction.channel}`, inline: true },
                    { name: `${e("clock")} Tempo`, value: result.seconds ? ui.duration(result.seconds * 1000) : "Desativado", inline: true }
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