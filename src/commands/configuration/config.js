const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ConfigPanelManager = require("../../managers/ConfigPanelManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("config")

        .setDescription("Abre o painel interativo de configuração do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {

        // Painel em Container (Components V2), visível só para quem abriu.
        return ConfigPanelManager.show(interaction);

    }

};
