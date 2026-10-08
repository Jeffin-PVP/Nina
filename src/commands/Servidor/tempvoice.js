const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ConfigPanelManager = require("../../managers/ConfigPanelManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tempvoice")
        .setDescription("Abre a configuração do TempVoice dentro do painel /config.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        return ConfigPanelManager.show(interaction, "tempvoice");
    }
};
