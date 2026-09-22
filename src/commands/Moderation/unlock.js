const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

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

                        new EmbedBuilder()

                            .setColor("Red")

                            .setDescription(
                                `❌ ${result.error}`
                            )

                    ]

                });

            }

            const embed =
                new EmbedBuilder()

                    .setColor(0x57F287)

                    .setTitle("🔓 Canal Desbloqueado")

                    .addFields(

                        {

                            name: "📺 Canal",

                            value: `${channel}`

                        },

                        {

                            name: "🛡️ Moderador",

                            value: interaction.user.tag

                        },

                        {

                            name: "📝 Motivo",

                            value: reason

                        }

                    )

                    .setTimestamp();

            await interaction.editReply({

                embeds: [

                    embed

                ]

            });

        } catch (error) {

            console.error(error);

            await interaction.editReply({

                embeds: [

                    new EmbedBuilder()

                        .setColor("Red")

                        .setDescription(
                            "❌ Ocorreu um erro ao executar o comando."
                        )

                ]

            });

        }

    }

};