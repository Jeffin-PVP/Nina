const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nossos-parceiros")
        .setDescription("Anuncia parceiros no servidor.")
        .addStringOption(option =>
            option
                .setName("nome")
                .setDescription("Nome do servidor parceiro.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("descricao")
                .setDescription("Descrição do servidor parceiro.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("convite")
                .setDescription("Link de convite do servidor.")
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName("imagem")
                .setDescription("Imagem do servidor parceiro.")
                .setRequired(false)
        ),

    async execute(interaction) {
        const nome = interaction.options.getString("nome");
        const descricao = interaction.options.getString("descricao");
        const convite = interaction.options.getString("convite");
        const imagem = interaction.options.getAttachment("imagem");

        const embed = new EmbedBuilder()
            .setColor("#7C3AED")
            .setTitle(`${e("sparkle")} Servidor Parceiro`)
            .setDescription(
                `Conheça nosso parceiro e dê uma passada por lá! 💜`
            )
            .addFields(
                {
                    name: `${e("sparkle")} Nome`,
                    value: `**${nome}**`,
                    inline: false
                },
                {
                    name: `${e("sparkle")} Descrição`,
                    value: descricao,
                    inline: false
                },
                {
                    name: `${e("link")} Convite`,
                    value: `[**Entrar no servidor**](${convite})`,
                    inline: false
                }
            )
            .setFooter({
                text: `Parceria • ${interaction.guild.name}`
            })
            .setTimestamp();

        if (imagem) {
            embed.setImage(imagem.url);
        }

        await interaction.reply({
            embeds: [embed]
        });
    }
};