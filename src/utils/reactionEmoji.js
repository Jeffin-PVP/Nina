function normalizeReactionEmoji(value) {
    const emoji = String(value ?? "").trim();
    const custom = emoji.match(/^<a?:[^:>]+:(\d{17,20})>$/);
    if (custom) return `custom:${custom[1]}`;
    if (!emoji || emoji.length > 100) {
        throw new TypeError("Informe um emoji válido.");
    }
    return `unicode:${emoji}`;
}

module.exports = { normalizeReactionEmoji };
