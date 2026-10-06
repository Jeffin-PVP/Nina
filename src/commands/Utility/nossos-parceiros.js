const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const { e } = require("../../utils/emojis");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nossos-parceiros")
        .setDescription("Anuncia parceiros no servidor.")
        .addStringOption(option =>
            option
                .setName("nome")
                .setDescription("Nome do servidor parceiro.")
                .setMaxLength(256)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("descricao")
                .setDescription("Descrição do servidor parceiro.")
                .setMaxLength(1024)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("convite")
                .setDescription("Link de convite do servidor parceiro.")
                .setMaxLength(512)
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

        let conviteUrl;

        try {
            conviteUrl = new URL(convite);
        } catch {
            return interaction.reply({
                content: "❌ O convite informado não é uma URL válida.",
                flags: MessageFlags.Ephemeral
            });
        }

        const host = conviteUrl.hostname.toLowerCase();

        if (
            conviteUrl.protocol !== "https:" ||
            !(
                host === "discord.gg" ||
                host === "discord.com" ||
                host === "www.discord.com"
            ) ||
            !(
                host === "discord.gg" ||
                conviteUrl.pathname.startsWith("/invite/")
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Use um convite oficial do Discord, como `https://discord.gg/xxxx`.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (
            imagem &&
            imagem.contentType &&
            !imagem.contentType.startsWith("image/")
        ) {
            return interaction.reply({
                content: "❌ O arquivo enviado em `imagem` precisa ser uma imagem.",
                flags: MessageFlags.Ephemeral
            });
        }

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
                    value: `[**Entrar no servidor**](${conviteUrl.toString()})`,
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
            embeds: [embed],
            allowedMentions: {
                parse: []
            }
        });
    }
};