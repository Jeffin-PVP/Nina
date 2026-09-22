const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");

module.exports = {

    name: Events.ChannelDelete,

    async execute(channel) {

        if (!channel.guild) return;

        const executor = await fetchExecutor(
            channel.guild,
            AuditLogEvent.ChannelDelete
        );

        await LogManager.send({
            type: LogTypes.CHANNEL_DELETE,
            guild: channel.guild,
            channel,
            executor
        });

    }

};
