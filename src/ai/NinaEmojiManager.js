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
    agradecida: "<:Nina_agradecida:1552058042185547898>"
};

const ALLOWED = new Set(Object.keys(EMOJIS));
const MARKER = /\[\[NINA_EMOTION:([a-zA-Z]+)\]\]/i;

function get(name) {
    return EMOJIS[name] || null;
}

function apply(content) {
    if (!content) return { content: "", emotion: null, emoji: null };

    const match = content.match(MARKER);
    if (!match) return { content: content.trim(), emotion: null, emoji: null };

    const emotion = match[1].toLowerCase();
    const normalized = Object.keys(EMOJIS).find(key => key.toLowerCase() === emotion);
    const emoji = normalized && ALLOWED.has(normalized) ? EMOJIS[normalized] : null;

    const clean = content.replace(MARKER, "").trim();

    if (!emoji) {
        return { content: clean, emotion: null, emoji: null };
    }

    return {
        content: clean,
        emotion: normalized,
        emoji
    };
}

module.exports = {
    EMOJIS,
    get,
    apply,
    allowedEmotions: [...ALLOWED]
};
