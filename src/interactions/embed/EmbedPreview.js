const {
    EmbedBuilder
} = require("discord.js");

class EmbedPreview {

    static build(data = {}) {

        const embed =
            new EmbedBuilder();

        /*
        =========================
            BÁSICO
        =========================
        */

        embed.setColor(
            data.color || "#5865F2"
        );

        if (data.title)
            embed.setTitle(data.title);

        if (data.description)
            embed.setDescription(
                data.description
            );

        /*
        =========================
            AUTOR
        =========================
        */

        if (data.author?.name) {

            embed.setAuthor({

                name:
                    data.author.name,

                iconURL:
                    data.author.iconURL || null,

                url:
                    data.author.url || null

            });

        }

        /*
        =========================
            THUMBNAIL
        =========================
        */

        if (data.thumbnail)
            embed.setThumbnail(
                data.thumbnail
            );

        /*
        =========================
            IMAGEM
        =========================
        */

        if (data.image)
            embed.setImage(
                data.image
            );

        /*
        =========================
            RODAPÉ
        =========================
        */

        if (data.footer?.text) {

            embed.setFooter({

                text:
                    data.footer.text,

                iconURL:
                    data.footer.iconURL || null

            });

        }

        /*
        =========================
            CAMPOS
        =========================
        */

        if (

            Array.isArray(data.fields) &&

            data.fields.length > 0

        ) {

            embed.addFields(
                data.fields
            );

        }

        /*
        =========================
            TIMESTAMP
        =========================
        */

        if (data.timestamp) {

            embed.setTimestamp();

        }

        return embed;

    }

}

module.exports =
    EmbedPreview;