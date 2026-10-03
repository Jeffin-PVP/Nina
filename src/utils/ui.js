/*
=========================
    DESIGN SYSTEM DA NINA
=========================
Tudo que é visual (cores, rodapé, embeds de sucesso/erro, barras...)
fica aqui para os comandos ficarem consistentes e fáceis de ajustar.
*/

const { EmbedBuilder } = require("discord.js");

const { e } = require("./emojis");

const NinaEmojiManager = require("../ai/NinaEmojiManager");

/** Emoji de expressão da Nina (feliz, triste, uau...). Vazio se não existir. */
const mood = name => NinaEmojiManager.get(name) ?? "";

const COLORS = {
    brand: 0xf569ff,
    success: 0x57f287,
    error: 0xed4245,
    warn: 0xfaa61a,
    info: 0x5865f2,
    economy: 0xf7c948,
    game: 0xa77bff,
    mod: 0xff5470,
    neutral: 0x2b2d31
};

const LINE = "▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

/** Embed base: cor + rodapé com o avatar da Nina + horário. */
function base(color = COLORS.brand, source = null) {

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTimestamp();

    const client = source?.client ?? source;
    const avatar = client?.user?.displayAvatarURL?.();

    embed.setFooter({
        text: "Nina",
        ...(avatar ? { iconURL: avatar } : {})
    });

    return embed;

}

/** Embed com título formatado: `${emoji} Título`. */
function titled(color, emoji, title, description, source) {

    const embed = base(color, source).setTitle(`${e(emoji)}  ${title}`);

    if (description) embed.setDescription(description);

    return embed;

}

const success = (description, title = "Tudo certo!", source = null) =>
    titled(COLORS.success, "ok", title, description, source);

const error = (description, title = "Ops!", source = null) =>
    titled(COLORS.error, "error", title, description, source);

const warn = (description, title = "Atenção", source = null) =>
    titled(COLORS.warn, "warn", title, description, source);

const info = (description, title = "Informação", source = null) =>
    titled(COLORS.info, "info", title, description, source);

/** Formata números no padrão brasileiro. */
const num = n => Number(n ?? 0).toLocaleString("pt-BR");

/** Valor monetário com a moeda personalizada. */
const money = n => `${e("coin")} **${num(n)}**`;

/** Timestamp do Discord (<t:...>). style: R (relativo), f, F, D, d, t, T */
const ts = (ms, style = "R") => `<t:${Math.floor(ms / 1000)}:${style}>`;

/** Barra de progresso: ▰▰▰▱▱▱ */
function bar(value, max, size = 10) {

    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    const filled = Math.round(ratio * size);

    return "▰".repeat(filled) + "▱".repeat(size - filled);

}

/** Formata uma duração em ms como "1h 20min 5s". */
function duration(ms) {

    const total = Math.max(0, Math.floor(ms / 1000));

    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    return [d && `${d}d`, h && `${h}h`, m && `${m}min`, (s || !(d || h || m)) && `${s}s`]
        .filter(Boolean)
        .join(" ");

}

/** Quote em bloco para destacar motivos/mensagens. */
const quote = text => String(text ?? "").split("\n").map(l => `> ${l}`).join("\n");

/**
 * Embed padrão de ação de moderação.
 * modEmbed({ emoji, title, color, user, moderator, reason, fields, source })
 */
function modEmbed({ emoji, title, color = COLORS.mod, user, moderator, reason, fields = [], source }) {

    const embed = titled(color, emoji, title, null, source);

    if (user) {

        embed.setThumbnail(user.displayAvatarURL?.({ size: 256 }) ?? null);

        embed.addFields({
            name: `${e("user")} Usuário`,
            value: `${user}\n\`${user.id}\``,
            inline: true
        });

    }

    if (moderator) {

        embed.addFields({
            name: `${e("shield")} Moderador`,
            value: `${moderator}`,
            inline: true
        });

    }

    for (const field of fields) embed.addFields(field);

    if (reason !== undefined) {

        embed.addFields({
            name: `${e("log")} Motivo`,
            value: quote(reason || "Nenhum motivo informado.")
        });

    }

    return embed;

}

module.exports = {
    COLORS,
    LINE,
    base,
    titled,
    success,
    error,
    warn,
    info,
    num,
    money,
    ts,
    bar,
    duration,
    quote,
    modEmbed,
    mood
};
