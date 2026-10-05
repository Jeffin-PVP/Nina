const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("nossos-parceiros")
        .setDescription("Anuncia um dos parceiros da Nina.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addStringOption(option =>
            option
                .setName("nome")
                .setDescription("Nome do parceiro.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("descricao")
                .setDescription("Descrição do parceiro.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("imagem")
                .setDescription("URL da imagem do parceiro.")
                .setRequired(false)
        )

        .addStringOption(option =>
            option
                .setName("convite")
                .setDescription("Link de convite/site do parceiro.")
                .setRequired(false)
        ),

    async execute(interaction) {

        const nome = interaction.options.getString("nome");
        const descricao = interaction.options.getString("descricao");
        const imagem = interaction.options.getString("imagem");
        const convite = interaction.options.getString("convite");

        const embed = new EmbedBuilder()
            .setColor(ui.COLORS.primary || "#7C3AED")
            .setTitle(`${e("sparkle")} Nossos Parceiros`)
            .setDescription(
                `## ${nome}\n\n${descricao}`
            )
            .setFooter({
                text: "Obrigado por apoiar a comunidade da Nina! 💜"
            })
            .setTimestamp();

        if (imagem) {
            embed.setImage(imagem);
        }

        if (convite) {
            embed.addFields({
                name: `${e("link")} Acesse`,
                value: `[Clique aqui para conhecer o parceiro](${convite})`
            });
        }

        await interaction.reply({
            embeds: [embed]
        });

    }

};