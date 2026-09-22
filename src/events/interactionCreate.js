const {
    Events,
    MessageFlags
} = require("discord.js");

const CommandManager =
    require("../managers/CommandManager");

const modalSubmit =
    require("../interactions/modalSubmit");

const embedButtons =
    require("../interactions/embed/buttonHandler");

const embedModals =
    require("../interactions/embed/modalHandler");

const embedChannel =
    require("../interactions/embed/channelHandler");

const ticketButtons =
    require("../interactions/tickets/buttonHandler");

const autoroleButtons =
    require("../interactions/autorole/buttonHandler");

const criarServidorModal =
    require("../interactions/criarServidor/modalHandler");

const criarServidorButtons =
    require("../interactions/criarServidor/buttonHandler");

const giveawayButtons =
    require("../interactions/giveaway/buttonHandler");

module.exports = {

    name: Events.InteractionCreate,

    async execute(interaction) {

        try {

            /*
            =========================
                MODAIS
            =========================
            */

            if (interaction.isModalSubmit()) {

                if (interaction.customId.startsWith("embed_")) {

                    return embedModals.execute(interaction);

                }

                if (interaction.customId === "criarservidor_modal") {

                    return criarServidorModal.execute(interaction);

                }

                return modalSubmit.execute(interaction);

            }

            /*
            =========================
                BOTÕES
            =========================
            */

            if (interaction.isButton()) {

                if (interaction.customId.startsWith("ticket_")) {

                    return ticketButtons.execute(interaction);

                }

                if (interaction.customId.startsWith("selfrole_")) {

                    return autoroleButtons.execute(interaction);

                }

                if (interaction.customId.startsWith("criarservidor_")) {

                    return criarServidorButtons.execute(interaction);

                }

                if (interaction.customId.startsWith("giveaway_")) {

                    return giveawayButtons.execute(interaction);

                }

                return embedButtons.execute(interaction);

            }

            /*
            =========================
                SELECT MENU
            =========================
            */

            if (interaction.isChannelSelectMenu()) {

                return embedChannel.execute(interaction);

            }

            /*
            =========================
                COMANDOS
            =========================
            */

            if (!interaction.isChatInputCommand())
                return;

            return CommandManager.execute(interaction);

        } catch (error) {

            console.error("Erro na interação:", error);

            try {

                if (interaction.replied || interaction.deferred) {

                    await interaction.followUp({

                        content: "❌ Ocorreu um erro ao processar a interação.",

                        flags: MessageFlags.Ephemeral

                    });

                } else {

                    await interaction.reply({

                        content: "❌ Ocorreu um erro ao processar a interação.",

                        flags: MessageFlags.Ephemeral

                    });

                }

            } catch { }

        }

    }

};