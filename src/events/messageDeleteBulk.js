const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const actionSuppression = require("../utils/actionSuppression");

module.exports = {

    name: Events.MessageBulkDelete,

    async execute(messages, channel) {

        if (!channel.guild) return;

        // Já logado pela ferramenta de purge (evita log duplicado)
        if (actionSuppression.isSuppressed(channel.id)) return;

        await LogManager.send({
            type: LogTypes.MESSAGE_BULK_DELETE,
            guild: channel.guild,
            channel,
            extra: {
                amount: messages.size
            }
        });

    }

};
