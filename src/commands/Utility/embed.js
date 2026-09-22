const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const EmbedPreview =
    require("../../interactions/embed/EmbedPreview");

const EmbedButtons =
    require("../../interactions/embed/EmbedButtons");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("embed")

        .setDescription(
            "Abre o editor de embeds."
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {

        /*
        =========================
            EMBED PADRÃO
        =========================
        */

        const data = {

            color: "#5865F2",

            title: "Nova Embed",

            description:
                "Clique em **📝 Editar** para começar a montar sua embed.",

            author: {},

            footer: {},

            fields: [],

            thumbnail: null,

            image: null,

            timestamp: false

        };

        /*
        =========================
            PAINEL
        =========================
        */

        await interaction.reply({

            embeds: [

                EmbedPreview.build(data)

            ],

            components:

                EmbedButtons.build()

        });

    }

};