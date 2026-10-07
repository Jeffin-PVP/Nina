const { Events } = require("discord.js");
const ServerStatsManager = require("../managers/ServerStatsManager");

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        const guild = newPresence?.guild || oldPresence?.guild;
        if (!guild) return;
        await ServerStatsManager.updateGuild(guild).catch(() => {});
    }
};
