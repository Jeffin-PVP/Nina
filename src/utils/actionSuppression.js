/**
 * Várias ferramentas de moderação (purgeMessages, lockChannel,
 * unlockChannel, slowmodeChannel...) já criam seu próprio log (com
 * moderador e motivo) e por baixo dos panos fazem a alteração direto
 * na API, o que também dispara o evento nativo correspondente
 * (messageDeleteBulk, channelUpdate...).
 *
 * Este módulo evita que a mesma ação seja logada duas vezes: a
 * ferramenta marca uma chave antes de agir, e o listener do evento
 * nativo ignora a chave se ela foi marcada há pouco tempo.
 */

const suppressed = new Map();

function suppress(key, ttlMs = 5000) {
    suppressed.set(key, Date.now() + ttlMs);
}

function isSuppressed(key) {

    const expiresAt = suppressed.get(key);

    if (!expiresAt) return false;

    if (Date.now() > expiresAt) {
        suppressed.delete(key);
        return false;
    }

    return true;

}

module.exports = {
    suppress,
    isSuppressed
};
