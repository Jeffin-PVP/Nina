const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const ui = require("../../utils/ui");
const { component } = require("../../utils/emojis");

const PANEL_URL = "https://nina.injectcloud.space/panel";

module.exports = {

    data: new SlashCommandBuilder()

        .setName("painel")

        .setDescription("Acesso ao painel de controle de gerenciamento do servidor."),

    async execute(interaction) {

        const embed = ui.panel({
            color: ui.COLORS.info,
            emoji: "config",
            title: "Painel de controle",
            description:
                "Gerencie a Nina e o seu servidor pelo navegador.\n\n" +
                `${ui.bullets([
                    "Entre com a sua conta do Discord",
                    "Disponível **somente** nos servidores em que você é dono ou administrador"
                ])}`,
            thumbnail: interaction.client.user.displayAvatarURL({ size: 256 }),
            footer: "Nina • Desenvolvida por JeffinPVP",
            source: interaction
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Abrir painel")
                .setEmoji(component("config"))
                .setStyle(ButtonStyle.Link)
                .setURL(PANEL_URL)
        );

        return ui.respond(interaction, embed, { ephemeral: true, components: [row] });

    }

};
