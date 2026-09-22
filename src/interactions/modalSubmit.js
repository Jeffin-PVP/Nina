const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

module.exports = {

    async execute(interaction) {

        if (!interaction.isModalSubmit())
            return;

        if (interaction.customId !== "embed_modal")
            return;

        const title =
            interaction.fields.getTextInputValue("title");

        const description =
            interaction.fields.getTextInputValue("description");

        const color =
            interaction.fields.getTextInputValue("color");

        const footer =
            interaction.fields.getTextInputValue("footer");

        const embed = new EmbedBuilder()

            .setDescription(description)

            .setTimestamp();

        if (title)
            embed.setTitle(title);

        if (footer)
            embed.setFooter({
                text: footer
            });

        if (color) {

            try {

                embed.setColor(color);

            } catch {

                embed.setColor(0x5865F2);

            }

        } else {

            embed.setColor(0x5865F2);

        }

        const buttons =
            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId("embed_send")

                        .setLabel("Enviar")

                        .setEmoji("📢")

                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()

                        .setCustomId("embed_cancel")

                        .setLabel("Cancelar")

                        .setEmoji("❌")

                        .setStyle(
                            ButtonStyle.Danger
                        )

                );

        await interaction.reply({

            content:
                "## Pré-visualização da Embed",

            embeds: [

                embed

            ],

            components: [

                buttons

            ],

            flags: MessageFlags.Ephemeral

        });

    }

};