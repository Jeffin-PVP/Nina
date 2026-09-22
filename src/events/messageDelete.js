const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");

module.exports = {

    name: Events.MessageDelete,

    async execute(message) {

        if (!message.guild) return;
        if (message.partial) return; // conteúdo não estava em cache, nada a mostrar
        if (message.author?.bot) return;

        await LogManager.send({
            type: LogTypes.MESSAGE_DELETE,
            guild: message.guild,
            target: message.author,
            channel: message.channel,
            extra: {
                content: message.content
            }
        });

    }

};
