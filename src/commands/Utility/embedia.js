const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("embedia")

        .setDescription("Criar uma embed usando IA.")

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {

        const modal = new ModalBuilder()

            .setCustomId("embed_ai_modal")

            .setTitle("Criar Embed com IA");

        const prompt = new TextInputBuilder()

            .setCustomId("prompt")

            .setLabel("Descreva a embed")

            .setStyle(TextInputStyle.Paragraph)

            .setPlaceholder(
                "Ex: Crie uma embed anunciando um evento de Minecraft às 20h..."
            )

            .setRequired(true)

            .setMaxLength(2000);

        modal.addComponents(

            new ActionRowBuilder()

                .addComponents(prompt)

        );

        return interaction.showModal(modal);

    }

};