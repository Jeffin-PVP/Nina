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

        .addAttachmentOption(option =>
            option
                .setName("imagem")
                .setDescription("Imagem ou banner do parceiro.")
                .setRequired(false)
        )

        .addStringOption(option =>
            option
                .setName("convite")
                .setDescription("Link de convite ou site do parceiro.")
                .setRequired(false)
        ),

    async execute(interaction) {

        const nome = interaction.options.getString("nome", true);
        const descricao = interaction.options.getString("descricao", true);
        const imagem = interaction.options.getAttachment("imagem");
        const convite = interaction.options.getString("convite");

        // Aceita somente imagens para evitar anexos que o Discord não consiga renderizar no embed.
        if (imagem && !imagem.contentType?.startsWith("image/")) {
            return ui.fail(
                interaction,
                "O arquivo enviado em **imagem** precisa ser PNG, JPG, JPEG, WEBP ou outro formato de imagem suportado pelo Discord.",
                "Imagem inválida"
            );
        }

        // Validação simples do link, quando informado.
        if (convite) {
            try {
                const url = new URL(convite);
                if (!["http:", "https:"].includes(url.protocol)) throw new Error();
            } catch {
                return ui.fail(
                    interaction,
                    "O link informado em **convite** não é válido. Use uma URL começando com `https://`.",
                    "Link inválido"
                );
            }
        }

        const embed = new EmbedBuilder()
            .setColor(ui.COLORS.brand)
            .setTitle(`${e("sparkle")} Nossos Parceiros`)
            .setDescription(`## ${nome}\n\n${descricao}`)
            .setFooter({
                text: "Obrigado por apoiar a comunidade da Nina! 💜"
            })
            .setTimestamp();

        if (imagem) {
            embed.setImage(imagem.url);
        }

        if (convite) {
            embed.addFields({
                name: `${e("server")} Acesse`,
                value: `[Clique aqui para conhecer **${nome}**](${convite})`,
                inline: false
            });
        }

        return interaction.reply({
            embeds: [embed]
        });

    }

};
