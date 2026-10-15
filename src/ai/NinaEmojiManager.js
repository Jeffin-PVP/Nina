/*
=========================
    EMOJIS DA NINA (expressões)
=========================
Os emojis "Nina_*" são Application Emojis (Developer Portal → Emojis).
No ClientReady o bot busca todos eles (Emojis.sync → NinaEmojiManager.sync)
e passa a usar o ID/animação reais. Os IDs abaixo servem só de reserva,
caso o fetch falhe ou o emoji ainda não tenha sido encontrado.
*/

const PREFIX = "Nina_";

const EMOJIS = {
    uau: "<:Nina_uau:1552058129108181022>",
    triste: "<:Nina_triste:1552058125341958324>",
    travessa: "<:Nina_travessa:1552058121671942215>",
    tchau: "<:Nina_tchau:1552058110452170862>",
    satisfeita: "<:Nina_satisfeita:1552058106735886448>",
    rindo: "<:Nina_rindo:1552058102788915311>",
    piscando: "<:Nina_piscando:1552058099504783430>",
    pensativa: "<:Nina_pensativa:1552058095465922641>",
    oi: "<:Nina_oi:1552058092097634364>",
    nervosa: "<:Nina_nervosa:1552058088784138312>",
    muitoBrava: "<:Nina_muitoBrava:1552058085743399014>",
    medo: "<:Nina_medo:1552058083147259954>",
    hehe: "<:Nina_hehe:1552058080425148476>",
    feliz: "<:Nina_feliz:1552058076993953973>",
    espantada: "<:Nina_espantada:1552058073663803544>",
    escondida: "<:Nina_escondida:1552058070811676833>",
    envergonhada: "<:Nina_envergonhada:1552058068223918120>",
    entediada: "<:Nina_entediada:1552058065547825263>",
    dormindo: "<:Nina_dormindo:1552058062657945710>",
    deBoa: "<:Nina_deBoa:1552058059549839511>",
    confusa: "<:Nina_confusa:1552058056073019462>",
    chorando: "<:Nina_chorando:1552058053531009045>",
    brava: "<:Nina_brava:1552058051073282100>",
    bebendo: "<:Nina_bebendo:1552058048082874428>",
    apaixonada: "<:Nina_apaixonada:1552058044978831400>",
    agradecida: "<:Nina_agradecida:1552058042185547898>",
    engenheira: "<:Nina_engenheira:1552064823976529951>"
};

// Emojis encontrados na aplicação (chave em minúsculas → texto do emoji).
const live = new Map();

// Nomes sem diferenciar maiúsculas e sem "_"/espaços: "muito_brava" → "muitobrava".
const normalize = value => String(value).toLowerCase().replace(/[^a-z]/g, "");

// Chave normalizada → nome canônico (ex.: "muitobrava" → "muitoBrava").
const canonical = new Map(Object.keys(EMOJIS).map(key => [normalize(key), key]));

// Aceita [[NINA_EMOTION:oi]], [[ NINA_EMOTION: oi ]], [NINA_EMOTION:oi], muito_brava...
const MARKER = /\[{1,2}\s*NINA_EMOTION\s*:\s*([a-zA-Z_ ]+?)\s*\]{1,2}/gi;

/** Atualiza o cache com os Application Emojis "Nina_*". Retorna os nomes que faltam. */
function sync(emojis) {

    live.clear();

    for (const emoji of emojis.values()) {

        if (!emoji.name?.startsWith(PREFIX)) continue;

        const name = emoji.name.slice(PREFIX.length);

        live.set(normalize(name), emoji.toString());

        // Emoji novo (não previsto no mapa de reserva) também vira emoção válida.
        if (!canonical.has(normalize(name))) canonical.set(normalize(name), name);

    }

    return Object.keys(EMOJIS).filter(key => !live.has(normalize(key)));

}

function get(name) {

    if (!name) return null;

    const key = normalize(name);
    const fallbackName = canonical.get(key);

    return live.get(key) ?? (fallbackName ? EMOJIS[fallbackName] : null) ?? null;

}

function apply(content) {
    if (!content) return { content: "", emotion: null, emoji: null };

    const matches = [...content.matchAll(MARKER)];
    if (!matches.length) return { content: content.trim(), emotion: null, emoji: null };

    // Remove todos os marcadores técnicos; usa o primeiro que for válido.
    const clean = content.replace(MARKER, "").trim();

    for (const match of matches) {

        const emotion = canonical.get(normalize(match[1]));
        const emoji = emotion ? get(emotion) : null;

        if (emoji) return { content: clean, emotion, emoji };

    }

    return { content: clean, emotion: null, emoji: null };
}

module.exports = {
    EMOJIS,
    PREFIX,
    sync,
    get,
    apply,
    get allowedEmotions() {
        return [...canonical.values()];
    }
};
