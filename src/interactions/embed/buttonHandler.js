const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const channelHandler =
    require("./channelHandler");

const EmbedButtons =
    require("./EmbedButtons");

module.exports = {

    async execute(interaction) {

        if (!interaction.isButton())
            return;

        /*
        =========================
            EDITAR
        =========================
        */

        if (interaction.customId === "embed_edit") {

            const embed =
                interaction.message.embeds[0];

            const modal = new ModalBuilder()

                .setCustomId("embed_edit_modal")

                .setTitle("Editar Embed");

            const title =
                new TextInputBuilder()

                    .setCustomId("title")

                    .setLabel("Título")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.title ?? ""
                    );

            const description =
                new TextInputBuilder()

                    .setCustomId("description")

                    .setLabel("Descrição")

                    .setStyle(TextInputStyle.Paragraph)

                    .setRequired(false)

                    .setValue(
                        embed.description ?? ""
                    );

            const color =
                new TextInputBuilder()

                    .setCustomId("color")

                    .setLabel("Cor (#5865F2)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.hexColor ??
                        "#5865F2"
                    );

            modal.addComponents(

                new ActionRowBuilder()

                    .addComponents(title),

                new ActionRowBuilder()

                    .addComponents(description),

                new ActionRowBuilder()

                    .addComponents(color)

            );

            return interaction.showModal(
                modal
            );

        }

        /*
        =========================
            IA
        =========================
        */

        if (interaction.customId === "embed_ai") {

            const {
                ModalBuilder,
                TextInputBuilder,
                TextInputStyle,
                ActionRowBuilder
            } = require("discord.js");

            const modal = new ModalBuilder()
                .setCustomId("embed_ai_modal")
                .setTitle("Criar Embed com IA");

            const prompt = new TextInputBuilder()
                .setCustomId("prompt")
                .setLabel("Descreva a embed")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Ex: Crie uma embed azul anunciando uma manutenção do servidor.")
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(prompt)
            );

            return interaction.showModal(modal);
        }

        /*
        =========================
            IMAGENS
        =========================
        */

        if (interaction.customId === "embed_images") {

            const embed =
                interaction.message.embeds[0];

            const modal = new ModalBuilder()

                .setCustomId("embed_images_modal")

                .setTitle("Imagens da Embed");

            const thumbnail =
                new TextInputBuilder()

                    .setCustomId("thumbnail")

                    .setLabel("Thumbnail (URL)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.thumbnail?.url ?? ""
                    );

            const image =
                new TextInputBuilder()

                    .setCustomId("image")

                    .setLabel("Imagem (URL)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.image?.url ?? ""
                    );

            modal.addComponents(

                new ActionRowBuilder()

                    .addComponents(thumbnail),

                new ActionRowBuilder()

                    .addComponents(image)

            );

            return interaction.showModal(modal);

        }

        /*
        =========================
            AUTOR
        =========================
        */

        if (interaction.customId === "embed_author") {

            const embed =
                interaction.message.embeds[0];

            const modal = new ModalBuilder()

                .setCustomId("embed_author_modal")

                .setTitle("Autor da Embed");

            const name =
                new TextInputBuilder()

                    .setCustomId("author_name")

                    .setLabel("Nome")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.author?.name ?? ""
                    );

            const icon =
                new TextInputBuilder()

                    .setCustomId("author_icon")

                    .setLabel("Ícone (URL)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.author?.iconURL ??
                        embed.author?.icon_url ??
                        ""
                    );

            const url =
                new TextInputBuilder()

                    .setCustomId("author_url")

                    .setLabel("Link (Opcional)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.author?.url ?? ""
                    );

            modal.addComponents(

                new ActionRowBuilder()

                    .addComponents(name),

                new ActionRowBuilder()

                    .addComponents(icon),

                new ActionRowBuilder()

                    .addComponents(url)

            );

            return interaction.showModal(modal);

        }

        /*
        =========================
            RODAPÉ
        =========================
        */

        if (interaction.customId === "embed_footer") {

            const embed =
                interaction.message.embeds[0];

            const modal = new ModalBuilder()

                .setCustomId("embed_footer_modal")

                .setTitle("Rodapé da Embed");

            const text =
                new TextInputBuilder()

                    .setCustomId("footer_text")

                    .setLabel("Texto")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.footer?.text ?? ""
                    );

            const icon =
                new TextInputBuilder()

                    .setCustomId("footer_icon")

                    .setLabel("Ícone (URL)")

                    .setStyle(TextInputStyle.Short)

                    .setRequired(false)

                    .setValue(
                        embed.footer?.iconURL ??
                        embed.footer?.icon_url ??
                        ""
                    );

            modal.addComponents(

                new ActionRowBuilder()

                    .addComponents(text),

                new ActionRowBuilder()

                    .addComponents(icon)

            );

            return interaction.showModal(modal);

        }

        /*
        =========================
            TIMESTAMP
        =========================
        */

        if (interaction.customId === "embed_timestamp") {

            const {
                EmbedBuilder
            } = require("discord.js");

            const EmbedButtons =
                require("./EmbedButtons");

            const embed =
                EmbedBuilder.from(
                    interaction.message.embeds[0]
                );

            if (embed.data.timestamp) {

                embed.setTimestamp(null);

            } else {

                embed.setTimestamp(new Date());

            }

            return interaction.update({

                embeds: [

                    embed

                ],

                components:

                    EmbedButtons.build()

            });

        }

        /*
        =========================
            CANAL
        =========================
        */

        if (interaction.customId === "embed_channel") {

            const {
                ActionRowBuilder,
                ChannelSelectMenuBuilder,
                ChannelType
            } = require("discord.js");

            const menu = new ChannelSelectMenuBuilder()

                .setCustomId("embed_channel_select")

                .setPlaceholder("Escolha um canal")

                .addChannelTypes(
                    ChannelType.GuildText
                );

            return interaction.update({

                embeds: interaction.message.embeds,

                components: [

                    ...EmbedButtons.build(),

                    new ActionRowBuilder()

                        .addComponents(menu)

                ]

            });

        }

        /*
        =========================
            FIELDS
        =========================
        */

        if (interaction.customId === "embed_fields") {

            const modal = new ModalBuilder()
                .setCustomId("embed_fields_modal")
                .setTitle("Adicionar Field");

            const name = new TextInputBuilder()
                .setCustomId("field_name")
                .setLabel("Nome")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const value = new TextInputBuilder()
                .setCustomId("field_value")
                .setLabel("Valor")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const inline = new TextInputBuilder()
                .setCustomId("field_inline")
                .setLabel("Inline? (sim/não)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(name),
                new ActionRowBuilder().addComponents(value),
                new ActionRowBuilder().addComponents(inline)
            );

            return interaction.showModal(modal);

        }


        /*
        =========================
            ENVIAR
        =========================
        */

        if (interaction.customId === "embed_send") {

            const channelId =
                channelHandler.channels.get(
                    interaction.user.id
                );

            if (!channelId) {

                return interaction.reply({

                    content:
                        "❌ Escolha um canal primeiro.",

                    flags: ["Ephemeral"]

                });

            }

            const channel =
                interaction.guild.channels.cache.get(
                    channelId
                );

            if (!channel) {

                return interaction.reply({

                    content:
                        "❌ Canal não encontrado.",

                    flags: ["Ephemeral"]

                });

            }

            await channel.send({

                embeds: [

                    interaction.message.embeds[0]

                ]

            });

            channelHandler.channels.delete(
                interaction.user.id
            );

            return interaction.update({

                content:
                    "✅ Embed enviada com sucesso!",

                embeds: [],

                components: []

            });

        }

        /*
        =========================
            CANCELAR
        =========================
        */

        if (interaction.customId === "embed_cancel") {

            return interaction.update({

                content:
                    "❌ Editor fechado.",

                embeds: [],

                components: []

            });

        }

    }

};