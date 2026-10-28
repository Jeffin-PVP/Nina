/*
=========================
    EMOJIS DA NINA (expressões)
=========================
Os emojis "Nina_*" são Application Emojis (Developer Portal → Emojis).
No ClientReady o bot busca todos eles (Emojis.sync → NinaEmojiManager.sync)
e passa a usar o ID/animação reais. Os IDs abaixo servem só de reserva,
caso o fetch falhe ou o emoji ainda não tenha sido encontrado.
*/

const { E } = require("../config/emojiRegistry");
const PREFIX = "Nina_";

const EMOJIS = {
    uau: E("Nina_uau"),
    triste: E("Nina_triste"),
    travessa: E("Nina_travessa"),
    tchau: E("Nina_tchau"),
    satisfeita: E("Nina_satisfeita"),
    rindo: E("Nina_rindo"),
    piscando: E("Nina_piscando"),
    pensativa: E("Nina_pensativa"),
    oi: E("Nina_oi"),
    nervosa: E("Nina_nervosa"),
    muitoBrava: E("Nina_muitoBrava"),
    medo: E("Nina_medo"),
    hehe: E("Nina_hehe"),
    feliz: E("Nina_feliz"),
    espantada: E("Nina_espantada"),
    escondida: E("Nina_escondida"),
    envergonhada: E("Nina_envergonhada"),
    entediada: E("Nina_entediada"),
    dormindo: E("Nina_dormindo"),
    deBoa: E("Nina_deBoa"),
    confusa: E("Nina_confusa"),
    chorando: E("Nina_chorando"),
    brava: E("Nina_brava"),
    bebendo: E("Nina_bebendo"),
    apaixonada: E("Nina_apaixonada"),
    agradecida: E("Nina_agradecida"),
    engenheira: E("Nina_engenheira")
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
