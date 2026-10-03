const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const ui = require("../../utils/ui");
const { e, component } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Mostra o avatar de um membro em tamanho grande.")
        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro a consultar (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("membro") ?? interaction.user;

        const url = user.displayAvatarURL({ size: 1024 });
        const link = ext => user.displayAvatarURL({ size: 1024, extension: ext, forceStatic: true });

        const embed = ui.titled(ui.COLORS.brand, "image", `Avatar de ${user.displayName ?? user.username}`, null, interaction)
            .setImage(url);

        const row = new ActionRowBuilder().addComponents(
            ["png", "jpg", "webp"].map(ext =>
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(ext.toUpperCase())
                    .setEmoji(component("image"))
                    .setURL(link(ext))
            )
        );

        return interaction.reply({ embeds: [embed], components: [row] });

    }

};
