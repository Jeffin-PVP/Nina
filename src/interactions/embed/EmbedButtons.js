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
                    .setEmoji("<:ui_title:1560327153088860200>")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("embed_ai")
                    .setLabel("IA")
                    .setEmoji("<:ui_bot:1560326748313493546>")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId("embed_images")
                    .setLabel("Imagens")
                    .setEmoji("<:ui_thumbnail:1560327143806730240>")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_author")
                    .setLabel("Autor")
                    .setEmoji("<:ui_author:1560326714595479693>")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_footer")
                    .setLabel("Rodapé")
                    .setEmoji("<:ui_footer:1560326886046040154>")
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
                    .setEmoji("<:ui_field:1560326871864975390>")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_channel")
                    .setLabel("Canal")
                    .setEmoji("<:ui_textc:1560327137024544808>")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_timestamp")
                    .setLabel("Timestamp")
                    .setEmoji("<:clock:1561426917717053530>")
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

                        .setEmoji("<:ui_check:1560326782610047098>")

                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()

                        .setCustomId("embed_cancel")

                        .setLabel("Cancelar")

                        .setEmoji("<:ui_cancel:1560326759059030188>")

                        .setStyle(ButtonStyle.Danger)

                )

        ];

    }

}

module.exports = EmbedButtons;