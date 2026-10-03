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

                        ui.error(result.error, undefined, interaction)

                    ]

                });

            }

            const embed = ui.modEmbed({
                emoji: "ban",
                title: "Membro banido",
                color: ui.COLORS.error,
                user,
                moderator: interaction.user,
                reason,
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