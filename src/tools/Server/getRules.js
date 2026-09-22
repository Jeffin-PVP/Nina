module.exports = {

    name: "getRules",

    description:
        "Obtém os canais relacionados às regras e sistema do servidor.",

    category: "Server",

    guildOnly: true,

    ownerOnly: false,

    parameters: {

        type: "object",

        properties: {},

        required: []

    },

    async execute(message) {

        const guild = message.guild;

        if (!guild) {

            return {

                success: false,

                message: "Esta ferramenta só pode ser usada em um servidor."

            };

        }

        return {

            success: true,

            message: "Informações dos canais de regras obtidas.",

            data: {

                rulesChannel: guild.rulesChannel
                    ? {
                        id: guild.rulesChannel.id,
                        name: guild.rulesChannel.name
                    }
                    : null,

                systemChannel: guild.systemChannel
                    ? {
                        id: guild.systemChannel.id,
                        name: guild.systemChannel.name
                    }
                    : null,

                publicUpdatesChannel: guild.publicUpdatesChannel
                    ? {
                        id: guild.publicUpdatesChannel.id,
                        name: guild.publicUpdatesChannel.name
                    }
                    : null

            }

        };

    }

};