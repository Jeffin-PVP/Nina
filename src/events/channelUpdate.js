const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const actionSuppression = require("../utils/actionSuppression");

module.exports = {

    name: Events.ChannelUpdate,

    async execute(oldChannel, newChannel) {

        if (!newChannel.guild) return;

        // Já logado por lockChannel/unlockChannel/slowmodeChannel
        if (actionSuppression.isSuppressed(`channel:${newChannel.id}`)) return;

        const changes = [];

        if (oldChannel.name !== newChannel.name) {
            changes.push(`Nome: \`${oldChannel.name}\` → \`${newChannel.name}\``);
        }

        if (oldChannel.topic !== newChannel.topic) {
            changes.push(`Tópico alterado`);
        }

        if (oldChannel.nsfw !== newChannel.nsfw) {
            changes.push(`NSFW: \`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\``);
        }

        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            changes.push(`Slowmode: \`${oldChannel.rateLimitPerUser ?? 0}s\` → \`${newChannel.rateLimitPerUser ?? 0}s\``);
        }

        if (!changes.length) return; // mudança irrelevante (ex: posição), ignora

        const executor = await fetchExecutor(
            newChannel.guild,
            AuditLogEvent.ChannelUpdate,
            newChannel.id
        );

        await LogManager.send({
            type: LogTypes.CHANNEL_UPDATE,
            guild: newChannel.guild,
            channel: newChannel,
            executor,
            extra: { changes }
        });

    }

};
