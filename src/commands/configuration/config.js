const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ui = require("../../utils/ui");
const ConfigPanelManager = require("../../managers/ConfigPanelManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("config")

        .setDescription("Abre o painel interativo de configuração do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {

        const payload = await ConfigPanelManager.buildHome(interaction);

        return ui.respond(
            interaction,
            payload.embeds[0],
            { ephemeral: true, components: payload.components }
        );

    }

};
