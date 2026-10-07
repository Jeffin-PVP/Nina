const { EmbedBuilder } = require("discord.js");

const EmbedUtils = require("./EmbedUtils");

class EmbedPreview {

    /**
     * Converte o objeto de dados em EmbedBuilder.
     * Os dados passam por sanitize(), então nunca lançam erro de validação.
     */
    static build(input = {}) {

        const data = EmbedUtils.sanitize(input);

        const embed = new EmbedBuilder()
            .setColor(data.color);

        if (data.title) embed.setTitle(data.title);

        if (data.description) embed.setDescription(data.description);

        if (data.author.name) {

            // iconURL/url precisam ser URL válida ou undefined (null é rejeitado)
            embed.setAuthor({
                name: data.author.name,
                iconURL: data.author.iconURL || undefined,
                url: data.author.url || undefined
            });

        }

        if (data.thumbnail) embed.setThumbnail(data.thumbnail);

        if (data.image) embed.setImage(data.image);

        if (data.footer.text) {

            embed.setFooter({
                text: data.footer.text,
                iconURL: data.footer.iconURL || undefined
            });

        }

        if (data.fields.length) embed.addFields(data.fields);

        if (data.timestamp) embed.setTimestamp();

        return embed;

    }

}

module.exports = EmbedPreview;
