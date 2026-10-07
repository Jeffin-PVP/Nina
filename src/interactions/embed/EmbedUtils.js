/*
=========================
    UTILITÁRIOS DO /embed
=========================
Validação central: tudo que entra no editor (modais, IA) passa por aqui
antes de virar embed, para nunca estourar um limite do Discord.
*/

const {
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const LIMITS = {
    title: 256,
    description: 4096,
    fieldName: 256,
    fieldValue: 1024,
    fields: 25,
    footer: 2048,
    author: 256,
    total: 6000
};

const DEFAULT_COLOR = "#5865F2";

function str(value) {
    return typeof value === "string" ? value.trim() : "";
}

function clamp(value, max) {
    return str(value).slice(0, max);
}

/** Aceita http/https. Devolve a URL normalizada ou null. */
function parseUrl(value) {

    const raw = str(value);

    if (!raw) return null;

    try {

        const url = new URL(raw);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return null;
        }

        return url.toString();

    } catch {

        return null;

    }

}

/** Aceita "#RRGGBB", "RRGGBB", "#RGB". Devolve "#RRGGBB" ou null. */
function parseColor(value) {

    let raw = str(value).replace(/^#/, "");

    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        raw = raw.split("").map(c => c + c).join("");
    }

    if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
        return null;
    }

    return `#${raw.toUpperCase()}`;

}

/** "sim", "s", "true", "1"... (com ou sem acento) */
function parseBool(value) {

    const raw = str(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    return ["sim", "s", "yes", "y", "true", "1"].includes(raw);

}

/** Soma dos caracteres que o Discord conta no limite de 6000 da embed. */
function totalLength(data) {

    const fields = Array.isArray(data.fields) ? data.fields : [];

    return (
        (data.title?.length || 0) +
        (data.description?.length || 0) +
        (data.footer?.text?.length || 0) +
        (data.author?.name?.length || 0) +
        fields.reduce(
            (sum, f) => sum + (f.name?.length || 0) + (f.value?.length || 0),
            0
        )
    );

}

/** Embed (da mensagem ou builder) -> objeto simples editável. */
function fromEmbed(embed) {

    const json = typeof embed?.toJSON === "function" ? embed.toJSON() : (embed || {});

    return {
        title: json.title || "",
        description: json.description || "",
        color: json.color != null
            ? `#${Number(json.color).toString(16).padStart(6, "0").toUpperCase()}`
            : DEFAULT_COLOR,
        author: {
            name: json.author?.name || "",
            iconURL: json.author?.icon_url || "",
            url: json.author?.url || ""
        },
        footer: {
            text: json.footer?.text || "",
            iconURL: json.footer?.icon_url || ""
        },
        thumbnail: json.thumbnail?.url || "",
        image: json.image?.url || "",
        fields: (json.fields || []).map(f => ({
            name: f.name,
            value: f.value,
            inline: Boolean(f.inline)
        })),
        timestamp: Boolean(json.timestamp)
    };

}

/**
 * Limpa qualquer dado vindo de fora (IA, modal...) e devolve um objeto
 * garantidamente aceito pelo Discord.
 */
function sanitize(input) {

    const data = input && typeof input === "object" ? input : {};

    const out = {
        title: clamp(data.title, LIMITS.title),
        description: clamp(data.description, LIMITS.description),
        color: parseColor(data.color) || DEFAULT_COLOR,
        thumbnail: parseUrl(data.thumbnail) || "",
        image: parseUrl(data.image) || "",
        timestamp: data.timestamp === true || data.timestamp === "true",
        author: { name: "", iconURL: "", url: "" },
        footer: { text: "", iconURL: "" },
        fields: []
    };

    const authorName = clamp(data.author?.name, LIMITS.author);

    if (authorName) {
        out.author = {
            name: authorName,
            iconURL: parseUrl(data.author?.iconURL) || "",
            url: parseUrl(data.author?.url) || ""
        };
    }

    const footerText = clamp(data.footer?.text, LIMITS.footer);

    if (footerText) {
        out.footer = {
            text: footerText,
            iconURL: parseUrl(data.footer?.iconURL) || ""
        };
    }

    if (Array.isArray(data.fields)) {

        for (const field of data.fields) {

            if (out.fields.length >= LIMITS.fields) break;

            const name = clamp(field?.name, LIMITS.fieldName);
            const value = clamp(field?.value, LIMITS.fieldValue);

            // O Discord rejeita field com nome ou valor vazio.
            if (!name || !value) continue;

            out.fields.push({
                name,
                value,
                inline: field.inline === true || field.inline === "true"
            });

        }

    }

    // Limite global de 6000 caracteres: descarta fields do fim e,
    // se ainda passar, corta a descrição.
    while (out.fields.length && totalLength(out) > LIMITS.total) {
        out.fields.pop();
    }

    if (totalLength(out) > LIMITS.total) {

        const excess = totalLength(out) - LIMITS.total;

        out.description = out.description.slice(
            0,
            Math.max(0, out.description.length - excess)
        );

    }

    return out;

}

/** A embed tem algo que o Discord aceite enviar? */
function hasContent(data) {

    return Boolean(
        data.title ||
        data.description ||
        data.image ||
        data.thumbnail ||
        data.author?.name ||
        data.footer?.text ||
        data.fields?.length
    );

}

/**
 * Só quem tem "Gerenciar Mensagens" mexe no editor (o comando já exige isso,
 * mas admins podem liberar o /embed por cargo e os botões ficam clicáveis
 * por qualquer um que veja a mensagem).
 */
async function ensureManager(interaction) {

    if (
        interaction.inGuild() &&
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
    ) {
        return true;
    }

    await interaction.reply({
        content: "❌ Você precisa da permissão **Gerenciar Mensagens** para usar o editor de embeds.",
        flags: MessageFlags.Ephemeral
    });

    return false;

}

module.exports = {
    ensureManager,
    LIMITS,
    DEFAULT_COLOR,
    parseUrl,
    parseColor,
    parseBool,
    totalLength,
    fromEmbed,
    sanitize,
    hasContent
};
