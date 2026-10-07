const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const AntiNukeManager = require("../managers/AntiNukeManager");

const ServerStatsManager = require("../managers/ServerStatsManager");

module.exports = {

    name: Events.ChannelCreate,

    async execute(channel) {

        if (!channel.guild) return;

        const executor = await fetchExecutor(
            channel.guild,
            AuditLogEvent.ChannelCreate,
            channel.id
        );

        await AntiNukeManager.detectChannel(channel.guild, "channel_create", channel.id, executor).catch(() => {});

        await LogManager.send({
            type: LogTypes.CHANNEL_CREATE,
            guild: channel.guild,
            channel,
            executor
        });

        await ServerStatsManager.updateGuild(channel.guild).catch(() => {});

    }

};
