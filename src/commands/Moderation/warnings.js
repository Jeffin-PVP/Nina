const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ToolManager =
    require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("warnings")

        .setDescription(
            "Mostra as advertências de um membro."
        )

        .addUserOption(option =>

            option

                .setName("membro")

                .setDescription(
                    "Membro que será consultado."
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

                    "getWarnings",

                    fakeMessage,

                    {

                        userId: user.id

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

                    .setTitle("📄 Advertências")

                    .setDescription(

                        `Advertências de ${user.tag}`

                    )

                    .setTimestamp();

            embed.addFields({

                name: "Total",

                value: `${result.total}`,

                inline: true

            });

            if (
                result.warnings &&
                result.warnings.length > 0
            ) {

                embed.addFields({

                    name: "Lista",

                    value:

                        result.warnings

                            .slice(0, 10)

                            .map((warning, index) =>

                                `**${index + 1}.** \`ID ${warning.id}\` — ${warning.reason}`

                            )

                            .join("\n")

                });

            } else {

                embed.addFields({

                    name: "Lista",

                    value: "Nenhuma advertência."

                });

            }

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