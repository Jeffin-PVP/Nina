const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    InteractionContextType,
    MessageFlags
} = require("discord.js");

const EmbedPreview =
    require("../../interactions/embed/EmbedPreview");

const EmbedButtons =
    require("../../interactions/embed/EmbedButtons");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("embed")

        .setDescription("Abre o editor de embeds.")

        .setContexts(InteractionContextType.Guild)

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {

        // Embed inicial do editor
        const data = {
            color: "#5865F2",
            title: "Nova Embed",
            description:
                "Clique em **📝 Editar** para começar a montar sua embed.",
            author: {},
            footer: {},
            fields: [],
            thumbnail: "",
            image: "",
            timestamp: false
        };

        // Efêmero: só quem abriu vê e controla o painel.
        await interaction.reply({
            embeds: [EmbedPreview.build(data)],
            components: EmbedButtons.build(),
            flags: MessageFlags.Ephemeral
        });

    }

};
