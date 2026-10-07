const EmbedButtons = require("./EmbedButtons");
const EmbedUtils = require("./EmbedUtils");

/*
Canal escolhido por cada editor. A chave inclui o servidor e o usuário,
e as entradas expiram sozinhas para o Map não crescer para sempre.
*/

const TTL = 30 * 60 * 1000;

const channels = new Map();

function key(interaction) {
    return `${interaction.guildId}:${interaction.user.id}`;
}

function prune() {

    const now = Date.now();

    for (const [k, entry] of channels) {
        if (now - entry.at > TTL) channels.delete(k);
    }

}

function setChannel(interaction, channelId) {

    prune();

    channels.set(key(interaction), {
        id: channelId,
        at: Date.now()
    });

}

function getChannel(interaction) {

    prune();

    return channels.get(key(interaction))?.id ?? null;

}

function clearChannel(interaction) {
    channels.delete(key(interaction));
}

module.exports = {

    setChannel,
    getChannel,
    clearChannel,

    async execute(interaction) {

        if (!interaction.isChannelSelectMenu())
            return;

        if (interaction.customId !== "embed_channel_select")
            return;

        if (!await EmbedUtils.ensureManager(interaction))
            return;

        setChannel(interaction, interaction.values[0]);

        return interaction.update({

            content: `📢 Canal selecionado: <#${interaction.values[0]}>`,

            embeds: interaction.message.embeds,

            components: EmbedButtons.build()

        });

    }

};
