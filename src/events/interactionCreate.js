const {
    Events
} = require("discord.js");

const ui = require("../utils/ui");
const GlobalBanManager = require("../managers/GlobalBanManager");

const CommandManager =
    require("../managers/CommandManager");

const modalSubmit =
    require("../interactions/modalSubmit");

const ContainerManager =
    require("../managers/ContainerManager");

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

const configPanel =
    require("../interactions/config/panelHandler");

module.exports = {

    name: Events.InteractionCreate,

    async execute(interaction) {

        try {

            // Usuário banido globalmente não pode usar comandos nem interações da Nina.
            if (interaction.user && await GlobalBanManager.isBanned(interaction.user.id)) {

                if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
                    return ui.respond(
                        interaction,
                        ui.error(
                            "Sua conta está bloqueada de usar a Nina globalmente.",
                            "Acesso bloqueado",
                            interaction
                        ),
                        { ephemeral: true }
                    );
                }

                return;
            }

            /*
            =========================
                MODAIS
            =========================
            */

            if (interaction.isModalSubmit()) {

                if (interaction.customId.startsWith("config_submit:")) {
                    return configPanel.modal(interaction);
                }

                if (interaction.customId.startsWith("container_modal:")) {

                    return ContainerManager.handleModal(interaction);

                }

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

                if (interaction.customId.startsWith("config_")) {
                    return configPanel.execute(interaction);
                }

                if (interaction.customId.startsWith("container:")) {

                    return ContainerManager.handleButton(interaction);

                }

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

                if (interaction.customId.startsWith("config_channel:")) {
                    return configPanel.execute(interaction);
                }

                return embedChannel.execute(interaction);

            }

            if (interaction.isRoleSelectMenu()) {

                if (interaction.customId.startsWith("config_role:")) {
                    return configPanel.execute(interaction);
                }

                return;

            }

            if (interaction.isStringSelectMenu()) {

                if (interaction.customId === "config_category" || interaction.customId === "config_log_category") {
                    return configPanel.execute(interaction);
                }

                return;

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

                // ui.respond escolhe reply / editReply / followUp conforme o estado da interação
                await ui.respond(
                    interaction,
                    ui.error(
                        "Algo deu errado ao processar isso. Tente de novo em instantes; se continuar, avise um administrador.",
                        "Ocorreu um erro",
                        interaction
                    ),
                    { ephemeral: true }
                );

            } catch { }

        }

    }

};