const EmbedButtons =
    require("./EmbedButtons");

const channels =
    new Map();

module.exports = {

    channels,

    async execute(interaction) {

        if (!interaction.isChannelSelectMenu())
            return;

        if (interaction.customId !== "embed_channel_select")
            return;

        channels.set(

            interaction.user.id,

            interaction.values[0]

        );

        return interaction.update({

            content:
                `📢 Canal selecionado: <#${interaction.values[0]}>`,

            embeds:
                interaction.message.embeds,

            components:
                EmbedButtons.build()

        });

    }

};