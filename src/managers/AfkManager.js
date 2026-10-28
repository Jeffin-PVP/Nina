const { E } = require("../config/emojiRegistry");
const Repo = require("../database/repositories/ServerToolsRepository");

const NOTICE_COOLDOWN_MS = 60 * 1000;
const lastNotice = new Map(); // "channel:afkUser" -> timestamp

// Remove menções e links do motivo, para o AFK não virar forma de spam/ping.
function cleanReason(text) {
    return String(text || "")
        .replace(/<(@[!&]?|#)\d+>/g, "")
        .replace(/@(everyone|here)/gi, "")
        .replace(/https?:\/\/\S+|discord\.gg\/\S+/gi, "[link]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
}

const fmtDuration = ms => {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
};

async function handleMessage(message) {
    const { guild, author } = message;

    // 1) Quem estava AFK voltou a falar.
    const mine = await Repo.getAfk(guild.id, author.id);
    if (mine && Date.now() - Number(mine.since) > 15000) {
        await Repo.removeAfk(guild.id, author.id);
        const reply = await message.reply({
            content: `${E("aceno")} Bem-vindo de volta, **${author.displayName ?? author.username}**! Você ficou AFK por **${fmtDuration(Date.now() - Number(mine.since))}**.`,
            allowedMentions: { parse: [], repliedUser: false }
        }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => null), 10000).unref?.();
    }

    // 2) Alguém mencionou um usuário AFK.
    const mentioned = [...message.mentions.users.values()].filter(u => !u.bot && u.id !== author.id).slice(0, 5);
    if (!mentioned.length) return;
    const afkRows = await Repo.getAfkMany(guild.id, mentioned.map(u => u.id));
    const lines = [];
    for (const row of afkRows) {
        const k = `${message.channelId}:${row.user_id}`;
        if (Date.now() - (lastNotice.get(k) || 0) < NOTICE_COOLDOWN_MS) continue;
        lastNotice.set(k, Date.now());
        const user = mentioned.find(u => u.id === row.user_id);
        lines.push(`💤 **${user?.displayName ?? user?.username ?? "Usuário"}** está AFK${row.reason ? `: ${row.reason}` : ""} — desde <t:${Math.floor(Number(row.since) / 1000)}:R>`);
    }
    if (lines.length) {
        await message.reply({ content: lines.join("\n"), allowedMentions: { parse: [], repliedUser: false } }).catch(() => null);
    }
}

setInterval(() => {
    const limit = Date.now() - NOTICE_COOLDOWN_MS;
    for (const [k, v] of lastNotice) if (v < limit) lastNotice.delete(k);
}, 5 * 60 * 1000).unref?.();

module.exports = { cleanReason, handleMessage };
