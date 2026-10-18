const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { createLinkButtons } = require("../../utils/linkButtons");
const LINKS = require("../../config/links");
const emojis = require("../../config/emojis");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Mostra a latência da Nina."),

    async execute(interaction) {
        const ping = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setColor("#7C3AED")
            .setTitle("🏓 Pong!")
            .setDescription(
                `<:ui_wifi:1560327197942874132> Estou online! \n\n**<:ping:1561491471071322222> Latência:** \`${ping}ms\``
            )
            .setImage(
                "https://cdn.discordapp.com/attachments/1529246810265358416/1556808606589132840/injectCloud.png?backend=b2&ex=6ac5827f&is=6ac430ff&hm=5ea5a7ff9e55b9a3a0468103040aeb227f57f4d3767926bdcd33971e543a9981&"
            );

        const buttons = createLinkButtons([
            {
                label: "Painel Web",
                emoji: "<:ui_settings:1560327092078645258>",
                url: LINKS.painel
            },
            {
                label: "Inject Cloud",
                emoji: "<:ui_rocket:1560327081345155082>",
                url: LINKS.hospedagem
            }
        ]);

        return interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    }
};