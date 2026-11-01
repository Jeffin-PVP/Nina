const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");
const moderationConfirm = require("../../interactions/moderation/confirmAction");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("kick")

        .setDescription(
            "Expulsa um membro do servidor."
        )

        .addUserOption(option =>

            option

                .setName("membro")

                .setDescription(
                    "Membro que será expulso."
                )

                .setRequired(true)

        )

        .addStringOption(option =>

            option

                .setName("motivo")

                .setDescription(
                    "Motivo da expulsão."
                )

                .setRequired(false)

        )

        .setDefaultMemberPermissions(

            PermissionFlagsBits.KickMembers

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const member =
            interaction.options.getMember("membro");

        const user =
            interaction.options.getUser("membro");

        const reason =
            interaction.options.getString("motivo")
            ?? "Nenhum motivo informado.";

        if (!user) {

            return interaction.editReply({

                embeds: [

                    ui.error("Usuário não encontrado.", undefined, interaction)

                ]

            });

        }

        await moderationConfirm.prompt(interaction, {
            title: "Confirmar expulsão",
            description: `Você está prestes a expulsar <@${user.id}>.\n\n**Motivo:** ${reason}`,
            action: "kick",
            payload: {
                userId: user.id,
                reason
            }
        });

        return;

    }

};