const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ToolManager =
    require("../../ai/ToolManager");

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

        const reason =
            interaction.options.getString("motivo") ??
            "Nenhum motivo informado.";

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

                    "banMember",

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

                    .setColor(0xff0000)

                    .setTitle("🔨 Membro Banido")

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