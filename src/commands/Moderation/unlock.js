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

        .setName("unlock")

        .setDescription(
            "Desbloqueia um canal."
        )

        .addChannelOption(option =>

            option

                .setName("canal")

                .setDescription(
                    "Canal que será desbloqueado."
                )

                .addChannelTypes(

                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement

                )

                .setRequired(true)

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo do desbloqueio."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.ManageChannels

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const channel =
            interaction.options.getChannel("canal");

        const reason =
            interaction.options.getString("motivo")
            ?? "Canal desbloqueado.";

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

                    "unlockChannel",

                    fakeMessage,

                    {

                        channelId: channel.id,

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
                emoji: "unlock",
                title: "Canal desbloqueado",
                color: ui.COLORS.success,
                moderator: interaction.user,
                reason,
                fields: [{ name: `${e("channel")} Canal`, value: `${channel}`, inline: true }],
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