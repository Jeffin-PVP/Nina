const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ToolManager =
    require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("warn")

        .setDescription(
            "Aplica uma advertência a um membro."
        )

        .addUserOption(option =>

            option

                .setName("membro")

                .setDescription(
                    "Membro que receberá a advertência."
                )

                .setRequired(true)

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo da advertência."
                )

                .setRequired(true)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.ModerateMembers

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const user =
            interaction.options.getUser("membro");

        const reason =
            interaction.options.getString("motivo");

        if (!user) {

            return interaction.editReply({

                embeds: [

                    new EmbedBuilder()

                        .setColor("Red")

                        .setDescription(
                            "❌ Usuário não encontrado."
                        )

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

                    "warnMember",

                    fakeMessage,

                    {

                        userId: user.id,

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

                    .setColor(0xffcc00)

                    .setTitle("⚠️ Advertência Aplicada")

                    .addFields(

                        {

                            name: "👤 Usuário",

                            value:
                                `${user.tag}\n\`${user.id}\``

                        },

                        {

                            name: "🛡️ Moderador",

                            value:
                                interaction.user.tag

                        },

                        {

                            name: "📝 Motivo",

                            value: reason

                        },

                        {

                            name: "📄 Advertências",

                            value:
                                `${result.warnings}`,

                            inline: true

                        },

                        {

                            name: "📨 DM enviada",

                            value:
                                result.dmSent
                                    ? "✅ Sim"
                                    : "❌ Não",

                            inline: true

                        }

                    )

                    .setTimestamp();

            await interaction.editReply({

                embeds: [embed]

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