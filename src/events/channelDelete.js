const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const AntiNukeManager = require("../managers/AntiNukeManager");

const ServerStatsManager = require("../managers/ServerStatsManager");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");

module.exports = {

    name: Events.ChannelDelete,

    async execute(channel) {

        if (!channel.guild) return;

        const room = await TempVoiceRepository.getRoom(channel.id);
        if (room) {
            await TempVoiceRepository.removeRoom(channel.id).catch(() => {});
        }

        const config = await TempVoiceRepository.get(channel.guild.id);
        if (config.trigger_channel_id === channel.id) {
            await TempVoiceRepository.set(channel.guild.id, {
                enabled: 0,
                trigger_channel_id: null,
                category_id: null
            }).catch(() => {});
        }

        const executor = await fetchExecutor(
            channel.guild,
            AuditLogEvent.ChannelDelete
        );

        await AntiNukeManager.detectChannel(channel.guild, "channel_delete", channel.id, executor).catch(() => {});

        await LogManager.send({
            type: LogTypes.CHANNEL_DELETE,
            guild: channel.guild,
            channel,
            executor
        });

        await ServerStatsManager.updateGuild(channel.guild).catch(() => {});

    }

};
