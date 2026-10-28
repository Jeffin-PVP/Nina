const { E } = require("../../config/emojiRegistry");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

class EmbedButtons {

    static build() {

        return [

            /*
            =========================
                LINHA 1
            =========================
            */

            new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                    .setCustomId("embed_edit")
                    .setLabel("Editar")
                    .setEmoji(E("ui_title"))
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("embed_ai")
                    .setLabel("IA")
                    .setEmoji(E("ui_bot"))
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId("embed_images")
                    .setLabel("Imagens")
                    .setEmoji(E("ui_thumbnail"))
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_author")
                    .setLabel("Autor")
                    .setEmoji(E("ui_author"))
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_footer")
                    .setLabel("Rodapé")
                    .setEmoji(E("ui_footer"))
                    .setStyle(ButtonStyle.Secondary)

            ),
            /*
            =========================
                LINHA 2
            =========================
            */

            new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                    .setCustomId("embed_fields")
                    .setLabel("Fields")
                    .setEmoji(E("ui_field"))
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_channel")
                    .setLabel("Canal")
                    .setEmoji(E("ui_textc"))
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_timestamp")
                    .setLabel("Timestamp")
                    .setEmoji(E("clock"))
                    .setStyle(ButtonStyle.Secondary)

            ),
            /*
            =========================
                LINHA 3
            =========================
            */

            new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId("embed_send")

                        .setLabel("Enviar")

                        .setEmoji(E("ui_check"))

                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()

                        .setCustomId("embed_cancel")

                        .setLabel("Cancelar")

                        .setEmoji(E("ui_cancel"))

                        .setStyle(ButtonStyle.Danger)

                )

        ];

    }

}

module.exports = EmbedButtons;