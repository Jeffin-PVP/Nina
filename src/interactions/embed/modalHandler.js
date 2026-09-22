const AIManager =
    require("../../ai/AIManager");
const { EmbedBuilder } = require("discord.js");
const EmbedButtons = require("./EmbedButtons");

module.exports = {

    async execute(interaction) {

        if (!interaction.isModalSubmit()) return;

        /*
        =========================
            IA
        =========================
        */

        if (interaction.customId === "embed_ai_modal") {

            const prompt = interaction.fields
                .getTextInputValue("prompt")
                .trim();

            await interaction.deferReply({
                flags: ["Ephemeral"]
            });

            try {

                const data =
                    await AIManager.generateEmbed(prompt);

                const embed =
                    new EmbedBuilder();

                if (data.title)
                    embed.setTitle(data.title);

                if (data.description)
                    embed.setDescription(data.description);

                if (data.color)
                    embed.setColor(data.color);

                if (data.thumbnail)
                    embed.setThumbnail(data.thumbnail);

                if (data.image)
                    embed.setImage(data.image);

                if (data.timestamp)
                    embed.setTimestamp();

                if (data.author?.name) {

                    embed.setAuthor({

                        name: data.author.name,

                        iconURL:
                            data.author.iconURL || undefined,

                        url:
                            data.author.url || undefined

                    });

                }

                if (data.footer?.text) {

                    embed.setFooter({

                        text: data.footer.text,

                        iconURL:
                            data.footer.iconURL || undefined

                    });

                }

                if (
                    Array.isArray(data.fields) &&
                    data.fields.length
                ) {

                    embed.addFields(data.fields);

                }

                return interaction.editReply({

                    embeds: [embed]

                });

            } catch (err) {

                console.error(err);

                return interaction.editReply({

                    content:
                        "❌ Não consegui gerar essa embed."

                });

            }

        }

        const embed = EmbedBuilder.from(
            interaction.message.embeds[0]
        );

        /*
        =========================
            EDITAR
        =========================
        */

        if (interaction.customId === "embed_edit_modal") {

            const title = interaction.fields
                .getTextInputValue("title")
                .trim();

            const description = interaction.fields
                .getTextInputValue("description")
                .trim();

            const color = interaction.fields
                .getTextInputValue("color")
                .trim();

            embed.setTitle(title || null);
            embed.setDescription(description || null);

            if (color) {
                try {
                    embed.setColor(color);
                } catch { }
            }

            return interaction.update({
                embeds: [embed],
                components: EmbedButtons.build()
            });

        }

        /*
        =========================
            IMAGENS
        =========================
        */

        if (interaction.customId === "embed_images_modal") {

            const thumbnail = interaction.fields
                .getTextInputValue("thumbnail")
                .trim();

            const image = interaction.fields
                .getTextInputValue("image")
                .trim();

            embed.setThumbnail(thumbnail || null);
            embed.setImage(image || null);

            return interaction.update({
                embeds: [embed],
                components: EmbedButtons.build()
            });

        }

        /*
        =========================
            AUTOR
        =========================
        */

        if (interaction.customId === "embed_author_modal") {

            const name = interaction.fields
                .getTextInputValue("author_name")
                .trim();

            const icon = interaction.fields
                .getTextInputValue("author_icon")
                .trim();

            const url = interaction.fields
                .getTextInputValue("author_url")
                .trim();

            if (name) {

                embed.setAuthor({

                    name,

                    iconURL: icon || undefined,

                    url: url || undefined

                });

            } else {

                embed.setAuthor(null);

            }

            return interaction.update({

                embeds: [embed],

                components: EmbedButtons.build()

            });

        }

        /*
        =========================
            RODAPÉ
        =========================
        */

        if (interaction.customId === "embed_footer_modal") {

            const text = interaction.fields
                .getTextInputValue("footer_text")
                .trim();

            const icon = interaction.fields
                .getTextInputValue("footer_icon")
                .trim();

            if (text) {

                embed.setFooter({

                    text,

                    iconURL: icon || undefined

                });

            } else {

                embed.setFooter(null);

            }

            return interaction.update({

                embeds: [embed],

                components: EmbedButtons.build()

            });

        }

        /*
        =========================
            FIELDS
        =========================
        */

        if (interaction.customId === "embed_fields_modal") {

            const name = interaction.fields
                .getTextInputValue("field_name")
                .trim();

            const value = interaction.fields
                .getTextInputValue("field_value")
                .trim();

            const inline = interaction.fields
                .getTextInputValue("field_inline")
                .trim()
                .toLowerCase() === "sim";

            if (name && value) {

                embed.addFields({

                    name,

                    value,

                    inline

                });

            }

            return interaction.update({

                embeds: [embed],

                components: EmbedButtons.build()

            });

        }

    }

};