const { Events } = require("discord.js");
const AntiNukeManager = require("../managers/AntiNukeManager");

module.exports = {
    name: Events.WebhooksUpdate,
    async execute(channel) {
        // O evento não informa se foi criação ou exclusão; registramos a ação
        // mais conservadora: atividade de webhook. O Anti-Nuke só reage se o
        // limite configurado for atingido.
        await AntiNukeManager.detectWebhook(channel.guild).catch(() => {});
    }
};
