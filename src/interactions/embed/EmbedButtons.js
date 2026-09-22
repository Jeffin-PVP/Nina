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
                    .setEmoji("📝")
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId("embed_ai")
                    .setLabel("IA")
                    .setEmoji("🤖")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId("embed_images")
                    .setLabel("Imagens")
                    .setEmoji("🖼️")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_author")
                    .setLabel("Autor")
                    .setEmoji("👤")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_footer")
                    .setLabel("Rodapé")
                    .setEmoji("🦶")
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
                    .setEmoji("➕")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_channel")
                    .setLabel("Canal")
                    .setEmoji("📢")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("embed_timestamp")
                    .setLabel("Timestamp")
                    .setEmoji("⏰")
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

                        .setEmoji("✅")

                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()

                        .setCustomId("embed_cancel")

                        .setLabel("Cancelar")

                        .setEmoji("❌")

                        .setStyle(ButtonStyle.Danger)

                )

        ];

    }

}

module.exports = EmbedButtons;