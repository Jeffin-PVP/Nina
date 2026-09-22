const {
    ChannelType
} = require("discord.js");

const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getChannels",

            description: "Lista todos os canais do servidor.",

            category: "Server",

            parameters: {

                type: "object",

                properties: {

                    type: {

                        type: "string",

                        description: "text, voice, category, forum, announcement"

                    }

                },

                required: []

            }

        });

    }

    async execute(message, args) {

        const guild = message.guild;

        let channels = guild.channels.cache;

        if (args.type) {

            switch (args.type.toLowerCase()) {

                case "text":

                    channels = channels.filter(c =>
                        c.type === ChannelType.GuildText
                    );

                    break;

                case "voice":

                    channels = channels.filter(c =>
                        c.type === ChannelType.GuildVoice
                    );

                    break;

                case "category":

                    channels = channels.filter(c =>
                        c.type === ChannelType.GuildCategory
                    );

                    break;

                case "forum":

                    channels = channels.filter(c =>
                        c.type === ChannelType.GuildForum
                    );

                    break;

                case "announcement":

                    channels = channels.filter(c =>
                        c.type === ChannelType.GuildAnnouncement
                    );

                    break;

            }

        }

        return channels.map(channel => ({

            id: channel.id,

            name: channel.name,

            type: ChannelType[channel.type],

            parent: channel.parent?.name ?? null,

            position: channel.position,

            nsfw: channel.nsfw ?? false,

            topic: channel.topic ?? null

        }));

    }

};