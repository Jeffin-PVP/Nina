const { MessageFlags } = require("discord.js");
module.exports = {

    async execute(interaction) {

        if (interaction.customId !== "embed_send")
            return false;

        const channelSelect =

            interaction.message.components
                .flatMap(row => row.components)
                .find(component =>
                    component.customId ===
                    "embed_channel_select"
                );

        if (!channelSelect) {

            return interaction.reply({

                content:
                    "❌ Escolha um canal primeiro.",

                flags: MessageFlags.Ephemeral

            });

        }

        return true;

    }

};