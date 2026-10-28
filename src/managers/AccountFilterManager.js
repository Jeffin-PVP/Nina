const { E } = require("../config/emojiRegistry");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Repo = require("../database/repositories/ServerToolsRepository");

const TABLE = "account_filter_config";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 28 * DAY_MS;
const ACTIONS = { alert: "Apenas alertar a equipe", timeout: "Castigo até a conta atingir a idade mínima", kick: "Expulsar automaticamente" };

// Retorna true se o membro foi removido (kick) e o restante do fluxo de entrada deve parar.
async function handle(member) {
    if (member.user.bot) return false;
    const config = await Repo.getConfig(TABLE, member.guild.id);
    if (!config.enabled) return false;

    const ageMs = Date.now() - member.user.createdTimestamp;
    const minMs = Number(config.min_age_days) * DAY_MS;
    if (ageMs >= minMs) return false;

    const ageDays = Math.floor(ageMs / DAY_MS);
    const me = member.guild.members.me;
    let result = "Alerta enviado";
    let removed = false;

    if (config.action === "timeout" && me?.permissions.has(PermissionFlagsBits.ModerateMembers) && member.moderatable) {
        const duration = Math.min(minMs - ageMs, MAX_TIMEOUT_MS);
        const ok = await member.timeout(duration, `Conta nova (${ageDays}d < ${config.min_age_days}d)`).then(() => true).catch(() => false);
        result = ok ? `Castigado até a conta completar ${config.min_age_days} dias` : "Falha ao aplicar castigo (verifique minhas permissões)";
    } else if (config.action === "kick" && me?.permissions.has(PermissionFlagsBits.KickMembers) && member.kickable) {
        await member.send(`Sua conta é muito recente para entrar em **${member.guild.name}** (mínimo de ${config.min_age_days} dias). Você poderá tentar novamente quando ela atingir essa idade.`).catch(() => null);
        const ok = await member.kick(`Conta nova (${ageDays}d < ${config.min_age_days}d)`).then(() => true).catch(() => false);
        removed = ok;
        result = ok ? "Expulso automaticamente" : "Falha ao expulsar (verifique minhas permissões)";
    } else if (config.action !== "alert") {
        result = "Ação não executada por falta de permissão — apenas alerta";
    }

    const channel = config.alert_channel_id ? member.guild.channels.cache.get(config.alert_channel_id) : null;
    if (channel?.isTextBased?.()) {
        const embed = new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle(`${E("warn")} Conta nova detectada`)
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: "Usuário", value: `${member.user.tag}\n<@${member.id}> (\`${member.id}\`)`, inline: true },
                { name: "Idade da conta", value: `${ageDays} dia(s) — criada <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Mínimo exigido", value: `${config.min_age_days} dia(s)`, inline: true },
                { name: "Resultado", value: result }
            )
            .setTimestamp();
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
    }
    return removed;
}

module.exports = { TABLE, ACTIONS, handle };
