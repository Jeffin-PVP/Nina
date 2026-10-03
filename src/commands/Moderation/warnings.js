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

                    "getWarnings",

                    fakeMessage,

                    {

                        userId: user.id

                    }

                );

            if (!result.success) {

                return interaction.editReply({

                    embeds: [

                        ui.error(result.error, undefined, interaction)

                    ]

                });

            }

            const embed =
                ui.titled(
                    ui.COLORS.warn,
                    "log",
                    "Advertências",
                    `${user} possui **${result.total}** advertência(s).`,
                    interaction
                ).setThumbnail(user.displayAvatarURL({ size: 256 }));

            if (
                result.warnings &&
                result.warnings.length > 0
            ) {

                embed.addFields({

                    name: `${e("log")} Registros`,

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

                    name: `${e("log")} Registros`,

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

                    ui.error("Ocorreu um erro ao executar o comando.", undefined, interaction)

                ]

            });

        }

    }

};