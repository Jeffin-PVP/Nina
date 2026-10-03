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

                        ui.error(result.error, undefined, interaction)

                    ]

                });

            }

            const embed = ui.modEmbed({
                emoji: "warn",
                title: "Advertência aplicada",
                color: ui.COLORS.warn,
                user,
                moderator: interaction.user,
                reason,
                fields: [
                    { name: `${e("log")} Advertências`, value: `${result.warnings}`, inline: true },
                    { name: `${e("mail")} DM enviada`, value: result.dmSent ? `${e("ok")} Sim` : `${e("error")} Não`, inline: true }
                ],
                source: interaction
            });

            await interaction.editReply({

                embeds: [embed]

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