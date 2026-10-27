const { EmbedBuilder } = require("discord.js");
const Repo = require("../database/repositories/ServerToolsRepository");
const AnalyticsRepository = require("../database/repositories/AnalyticsRepository");
const database = require("../database/database");

const TABLE = "weekly_report_config";
const REPORT_HOUR = 9; // horário de Brasília
const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function brasiliaNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short"
    }).formatToParts(new Date()).map(p => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, weekday: WEEKDAY_INDEX[parts.weekday] };
}

const arrow = pct => (pct === null || pct === undefined ? "" : pct > 0 ? ` ▲ +${pct}%` : pct < 0 ? ` ▼ ${pct}%` : " • 0%");
const n = v => Number(v || 0).toLocaleString("pt-BR");
const dur = min => { const h = Math.floor(min / 60); return h ? `${h}h ${min % 60}min` : `${min}min`; };

async function buildReport(guild) {
    const data = await AnalyticsRepository.getAnalytics(guild.id, 7, guild);
    const s = data.summary;
    const since = `-7 days`;
    const [warns, opened, closed] = await Promise.all([
        database.get("SELECT COUNT(*) AS c FROM warnings WHERE guild_id = ? AND created_at >= datetime('now', ?)", [guild.id, since]).catch(() => ({ c: 0 })),
        database.get("SELECT COUNT(*) AS c FROM tickets WHERE guild_id = ? AND created_at >= datetime('now', ?)", [guild.id, since]).catch(() => ({ c: 0 })),
        database.get("SELECT COUNT(*) AS c FROM tickets WHERE guild_id = ? AND closed_at >= datetime('now', ?)", [guild.id, since]).catch(() => ({ c: 0 }))
    ]);

    const embed = new EmbedBuilder()
        .setColor(0xf569ff)
        .setTitle(`<:stats:1562187543653388391> Relatório semanal · ${guild.name}`)
        .setDescription(`Período: **${data.period.start}** até **${data.period.end}** (comparado à semana anterior).`)
        .setThumbnail(guild.iconURL({ size: 128 }))
        .addFields(
            { name: "<:ui_users:1560327175826313336> Membros", value: `**${n(s.currentMembers)}** atuais\n+${n(s.joins)} / -${n(s.leaves)} (saldo **${s.netGrowth >= 0 ? "+" : ""}${n(s.netGrowth)}**)`, inline: true },
            { name: "<:chat:1562187513949454366> Mensagens", value: `**${n(s.messages)}**${arrow(data.changes.messages)}\nMédia de ${n(s.avgMessagesPerDay)}/dia`, inline: true },
            { name: "<:ui_green:1560326914483159081> Membros ativos", value: `**${n(s.activeMembers)}**${arrow(data.changes.activeMembers)}\nEngajamento ${s.engagementRate}%`, inline: true },
            { name: "<:ui_mic:1560326973673316403> Tempo em voz", value: `**${dur(s.voiceMinutes)}**${arrow(data.changes.voiceMinutes)}`, inline: true },
            { name: "<:shield:1561427396719284334> Moderação", value: `${n(warns?.c)} advertência(s)`, inline: true },
            { name: "<:ticket:1562187545914380319> Tickets", value: `${n(opened?.c)} aberto(s) · ${n(closed?.c)} fechado(s)`, inline: true }
        )
        .setTimestamp();

    const extras = [];
    if (data.peakHour !== null) extras.push(`🕒 Horário de pico: **${String(data.peakHour).padStart(2, "0")}h**`);
    if (data.topChannels[0]) extras.push(`🏆 Canal mais ativo: <#${data.topChannels[0].channelId}> (${n(data.topChannels[0].messages)} msgs)`);
    if (data.topMembers[0]) extras.push(`⭐ Membro mais ativo: <@${data.topMembers[0].userId}> (${n(data.topMembers[0].messages)} msgs)`);
    if (extras.length) embed.addFields({ name: "Destaques", value: extras.join("\n") });
    const icon = { good: "🟢", warn: "🟠", info: "🔹" };
    if (data.insights.length) embed.addFields({ name: "💡 Insights", value: data.insights.slice(0, 4).map(i => `${icon[i.type] || "🔹"} ${i.text}`).join("\n").slice(0, 1024) });
    return embed;
}

async function sendReport(guild, channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased?.()) throw new Error("channel_missing");
    const embed = await buildReport(guild);
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function tick(client) {
    const now = brasiliaNow();
    const configs = await Repo.listEnabled(TABLE);
    for (const config of configs) {
        if (!config.channel_id || now.weekday !== Number(config.day) || now.hour < REPORT_HOUR || config.last_sent === now.date) continue;
        const guild = client.guilds.cache.get(config.guild_id);
        if (!guild) continue;
        // Marca antes de enviar para nunca duplicar, mesmo se o envio falhar.
        await Repo.setConfig(TABLE, guild.id, { last_sent: now.date });
        await sendReport(guild, config.channel_id).catch(error => console.error(`[Relatório] Falha em ${guild.id}:`, error.message));
    }
}

function start(client) {
    const run = () => tick(client).catch(error => console.error("[Relatório] Erro no agendador:", error));
    setTimeout(run, 60 * 1000).unref?.();
    setInterval(run, 30 * 60 * 1000).unref?.();
}

module.exports = { TABLE, DAYS, buildReport, sendReport, start };
