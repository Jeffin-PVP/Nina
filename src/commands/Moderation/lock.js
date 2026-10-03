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

        .setName("lock")

        .setDescription(
            "Bloqueia um canal."
        )

        .addChannelOption(option =>

            option

                .setName("canal")

                .setDescription(
                    "Canal que será bloqueado."
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
                    "Motivo do bloqueio."
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
            ?? "Canal bloqueado.";

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

                    "lockChannel",

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
                emoji: "lock",
                title: "Canal bloqueado",
                color: ui.COLORS.error,
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