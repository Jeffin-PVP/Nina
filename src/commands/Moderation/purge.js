const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

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

                    .setTitle("🧹 Mensagens Removidas")

                    .addFields(

                        {

                            name: "📺 Canal",

                            value: interaction.channel.name,

                            inline: true

                        },

                        {

                            name: "🧹 Quantidade",

                            value: `${amount}`,

                            inline: true

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