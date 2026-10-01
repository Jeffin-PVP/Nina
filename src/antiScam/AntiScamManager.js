const { PermissionFlagsBits } = require("discord.js");

const AutomodRepository = require("../database/repositories/AutomodRepository");
const WarningRepository = require("../database/repositories/WarningRepository");
const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const { analisarImagem } = require("./GroqImageClassifier");

const EXECUTOR = { tag: "🤖 Nina Anti-Scam", username: "Nina Anti-Scam" };
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const urlsEmAnalise = new Set();

function obterImagens(message) {
    return [...message.attachments.values()]
        .filter(attachment => {
            if (attachment.contentType?.startsWith("image/")) return true;
            return /\.(png|jpe?g|gif|webp)$/i.test(attachment.name || "");
        })
        .filter(attachment => !attachment.size || attachment.size <= MAX_IMAGE_SIZE)
        .slice(0, 3)
        .map(attachment => attachment.url);
}

function estaIsento(message, config) {
    const member = message.member;
    if (!member) return true;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

    const canais = AutomodRepository.parseLista(config.ignored_channels);
    const cargos = AutomodRepository.parseLista(config.ignored_roles);

    if (canais.includes(message.channel.id)) return true;
    if (cargos.some(id => member.roles.cache.has(id))) return true;

    return false;
}

async function aplicarAcao(message, config, resultado) {
    const acao = config.image_action || "ignore";
    const motivo = `Possível golpe visual (${resultado.category}, ${(resultado.confidence * 100).toFixed(0)}% de confiança)`;

    if (acao === "ignore") return false;

    if (["delete", "warn", "kick", "ban"].includes(acao)) {
        await message.delete().catch(() => {});
    }

    if (acao === "warn") {
        await WarningRepository.create({
            guildId: message.guild.id,
            userId: message.author.id,
            moderatorId: message.client.user.id,
            reason: `[Anti-Scam] ${motivo}`
        }).catch(error => console.error("[Anti-Scam] Falha ao registrar warn:", error));
    }

    if (acao === "kick") {
        if (message.member?.kickable) {
            await message.member.kick(`[Anti-Scam] ${motivo}`).catch(error =>
                console.error("[Anti-Scam] Falha ao expulsar:", error)
            );
        }
    }

    if (acao === "ban") {
        if (message.member?.bannable) {
            await message.member.ban({ reason: `[Anti-Scam] ${motivo}` }).catch(error =>
                console.error("[Anti-Scam] Falha ao banir:", error)
            );
        }
    }

    if (acao === "delete") {
        // Apenas remove a mensagem.
    }

    await LogManager.send({
        type: LogTypes.ANTISCAM_ACTION,
        guild: message.guild,
        executor: EXECUTOR,
        target: {
            id: message.author.id,
            username: message.author.username,
            displayName: message.member?.displayName
        },
        reason: motivo,
        extra: {
            channelId: message.channel.id,
            action: acao,
            category: resultado.category,
            confidence: resultado.confidence,
            reasons: resultado.reasons.join(" | ")
        }
    }).catch(() => {});

    return true;
}

async function checkMessage(message) {
    if (!message.guild || message.author.bot) return false;

    const config = await AutomodRepository.get(message.guild.id);

    if (!config.image_enabled) return false;
    if (estaIsento(message, config)) return false;

    const urls = obterImagens(message);
    if (!urls.length) return false;

    const chave = `${message.guild.id}:${message.id}`;
    if (urlsEmAnalise.has(chave)) return false;
    urlsEmAnalise.add(chave);

    try {
        const resultado = await analisarImagem(urls);

        if (!resultado.is_scam_like) return false;
        if (resultado.confidence < Number(config.image_threshold || 0.85)) return false;

        return await aplicarAcao(message, config, resultado);
    } catch (error) {
        console.error("[Anti-Scam] Erro na análise visual:", error);
        return false;
    } finally {
        urlsEmAnalise.delete(chave);
    }
}

module.exports = {
    checkMessage,
    obterImagens
};
