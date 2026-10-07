const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

/**
 * Cria uma linha de botões com links.
 *
 * @param {Array} buttons
 * @returns {ActionRowBuilder}
 */
function createLinkButtons(buttons) {
    const row = new ActionRowBuilder();

    for (const button of buttons) {
        if (!button.label || !button.url) continue;

        const btn = new ButtonBuilder()
            .setLabel(button.label)
            .setURL(button.url)
            .setStyle(ButtonStyle.Link);

        if (button.emoji) {
            btn.setEmoji(button.emoji);
        }

        row.addComponents(btn);
    }

    return row;
}

module.exports = {
    createLinkButtons
};