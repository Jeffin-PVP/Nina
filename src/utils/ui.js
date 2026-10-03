/*
=========================
    DESIGN SYSTEM DA NINA
=========================
Tudo que é visual (cores, rodapé, embeds de sucesso/erro, barras...)
fica aqui para os comandos ficarem consistentes e fáceis de ajustar.
*/

const { EmbedBuilder, MessageFlags } = require("discord.js");

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


/** Embed neutro para listas vazias ("nada por aqui"). */
const empty = (description, title = "Nada por aqui", source = null) =>
    titled(COLORS.neutral, "log", title, description, source);

/** Campo de embed com ícone: field("shield", "Moderador", "...") */
const field = (emoji, name, value, inline = true) => ({
    name: `${e(emoji)} ${name}`,
    value: String(value ?? "—").slice(0, 1024) || "—",
    inline
});

/** 🟢 / 🔴 para estados ligado/desligado. */
const toggle = (enabled, on = "Ativado", off = "Desativado") =>
    enabled ? `🟢 ${on}` : `🔴 ${off}`;

/** Bloco de código para destacar comandos/valores. */
const code = text => `\`${String(text ?? "")}\``;

/** Limita um texto ao tamanho máximo, adicionando "…". */
const clip = (text, max = 1024) => {

    const value = String(text ?? "");

    return value.length > max ? `${value.slice(0, max - 1)}…` : value;

};

/** Lista com marcadores padronizados: bullets(["a", "b"]) */
const bullets = (items, marker = "•") => items.map(i => `${marker} ${i}`).join("\n");

/**
 * Painel completo (título + descrição + campos + thumbnail) num só lugar.
 * panel({ color, emoji, title, description, fields, thumbnail, image, footer, source })
 */
function panel({ color = COLORS.brand, emoji = "sparkle", title, description, fields = [], thumbnail, image, footer, source } = {}) {

    const embed = titled(color, emoji, title, description, source);

    if (fields.length) embed.addFields(fields);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);

    if (footer) {

        const current = embed.data.footer ?? {};

        embed.setFooter({ text: footer, ...(current.icon_url ? { iconURL: current.icon_url } : {}) });

    }

    return embed;

}

/**
 * Responde a uma interação do jeito certo, qualquer que seja o estado dela:
 * ainda não respondida (reply), adiada (editReply) ou já respondida (followUp).
 * respond(interaction, embed, { ephemeral: true, components: [...] })
 */
function respond(interaction, embed, { ephemeral = false, ...extra } = {}) {

    const payload = {
        ...(embed ? { embeds: Array.isArray(embed) ? embed : [embed] } : {}),
        ...extra
    };

    if (interaction.deferred && !interaction.replied) {

        return interaction.editReply(payload);

    }

    if (ephemeral) payload.flags = MessageFlags.Ephemeral;

    return interaction.replied
        ? interaction.followUp(payload)
        : interaction.reply(payload);

}

/** Atalhos: ui.ok(interaction, "texto") / ui.fail / ui.caution — sempre efêmeros por padrão. */
const ok = (interaction, description, title, opts = {}) =>
    respond(interaction, success(description, title, interaction), { ephemeral: true, ...opts });

const fail = (interaction, description, title, opts = {}) =>
    respond(interaction, error(description, title, interaction), { ephemeral: true, ...opts });

const caution = (interaction, description, title, opts = {}) =>
    respond(interaction, warn(description, title, interaction), { ephemeral: true, ...opts });

const nothing = (interaction, description, title, opts = {}) =>
    respond(interaction, empty(description, title, interaction), { ephemeral: true, ...opts });

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
    empty,
    field,
    toggle,
    code,
    clip,
    bullets,
    panel,
    respond,
    ok,
    fail,
    caution,
    nothing,
    num,
    money,
    ts,
    bar,
    duration,
    quote,
    modEmbed,
    mood
};
