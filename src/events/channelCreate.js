const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");

module.exports = {

    name: Events.ChannelCreate,

    async execute(channel) {

        if (!channel.guild) return;

        const executor = await fetchExecutor(
            channel.guild,
            AuditLogEvent.ChannelCreate,
            channel.id
        );

        await LogManager.send({
            type: LogTypes.CHANNEL_CREATE,
            guild: channel.guild,
            channel,
            executor
        });

    }

};
