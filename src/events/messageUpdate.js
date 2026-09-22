const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");

module.exports = {

    name: Events.MessageUpdate,

    async execute(oldMessage, newMessage) {

        if (!newMessage.guild) return;
        if (oldMessage.partial || newMessage.partial) return;
        if (newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // edição de embed/anexo, ignora

        await LogManager.send({
            type: LogTypes.MESSAGE_EDIT,
            guild: newMessage.guild,
            target: newMessage.author,
            channel: newMessage.channel,
            extra: {
                before: oldMessage.content,
                after: newMessage.content,
                url: newMessage.url
            }
        });

    }

};
