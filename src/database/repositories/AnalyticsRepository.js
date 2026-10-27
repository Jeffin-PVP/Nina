const database = require("../database");

const MAX_VOICE_SESSION_MS = 12 * 60 * 60 * 1000;
const RETENTION_DAYS = 400;
const VALID_PERIODS = [7, 14, 30, 90];
const TIMEZONE = "America/Sao_Paulo";

// Datas e horas no fuso do Brasil, para que "hoje" e "horário de pico" façam sentido para a comunidade.
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hour12: false });
const dateKey = (date = new Date()) => dateFmt.format(date);
const hourKey = (date = new Date()) => Number(hourFmt.format(date)) % 24;
const addDays = (key, n) => {
    const d = new Date(`${key}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

class AnalyticsRepository {
    static async recordMessage({ guildId, channelId, channelName, userId }) {
        if (!guildId || !channelId || !userId) return;
        const now = new Date();
        const date = dateKey(now);
        const hour = hourKey(now);
        await database.run(
            `INSERT INTO analytics_daily (guild_id, date, messages) VALUES (?, ?, 1)
             ON CONFLICT(guild_id, date) DO UPDATE SET messages = messages + 1`,
            [guildId, date]
        );
        await database.run(
            `INSERT INTO analytics_channel_daily (guild_id, date, channel_id, channel_name, messages)
             VALUES (?, ?, ?, ?, 1)
             ON CONFLICT(guild_id, date, channel_id) DO UPDATE SET
               channel_name = excluded.channel_name, messages = messages + 1`,
            [guildId, date, channelId, String(channelName || "Canal removido").slice(0, 100)]
        );
        await database.run(
            `INSERT INTO analytics_user_daily (guild_id, date, user_id, messages, voice_seconds)
             VALUES (?, ?, ?, 1, 0)
             ON CONFLICT(guild_id, date, user_id) DO UPDATE SET messages = messages + 1`,
            [guildId, date, userId]
        );
        await database.run(
            `INSERT INTO analytics_hourly (guild_id, date, hour, messages) VALUES (?, ?, ?, 1)
             ON CONFLICT(guild_id, date, hour) DO UPDATE SET messages = messages + 1`,
            [guildId, date, hour]
        );
    }

    static async recordMember(guildId, type) {
        if (!guildId || !["joins", "leaves"].includes(type)) return;
        await database.run(
            `INSERT INTO analytics_daily (guild_id, date, ${type}) VALUES (?, ?, 1)
             ON CONFLICT(guild_id, date) DO UPDATE SET ${type} = ${type} + 1`,
            [guildId, dateKey()]
        );
    }

    static async openVoiceSession(guildId, userId, channelId) {
        if (!guildId || !userId || !channelId) return;
        await database.run(
            `INSERT INTO analytics_voice_sessions (guild_id, user_id, channel_id, started_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(guild_id, user_id) DO UPDATE SET
               channel_id = excluded.channel_id, started_at = excluded.started_at`,
            [guildId, userId, channelId, Date.now()]
        );
    }

    static async ensureVoiceSession(guildId, userId, channelId) {
        if (!guildId || !userId || !channelId) return;
        await database.run(
            `INSERT OR IGNORE INTO analytics_voice_sessions (guild_id, user_id, channel_id, started_at)
             VALUES (?, ?, ?, ?)`,
            [guildId, userId, channelId, Date.now()]
        );
    }

    static async syncActiveVoiceSessions(client) {
        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isVoiceBased?.()) continue;
                for (const member of channel.members.values()) {
                    if (member.user.bot) continue;
                    await this.ensureVoiceSession(guild.id, member.id, channel.id).catch(error => {
                        console.error(`[Analytics] Falha ao sincronizar voz (${guild.id}/${member.id}):`, error);
                    });
                }
            }
        }
    }

    static async closeVoiceSession(guildId, userId, channelName = "") {
        if (!guildId || !userId) return;
        const session = await database.get(
            "SELECT * FROM analytics_voice_sessions WHERE guild_id = ? AND user_id = ?",
            [guildId, userId]
        );
        if (!session) return;
        await database.run(
            "DELETE FROM analytics_voice_sessions WHERE guild_id = ? AND user_id = ?",
            [guildId, userId]
        );
        const durationMs = Math.max(0, Math.min(Date.now() - Number(session.started_at), MAX_VOICE_SESSION_MS));
        const seconds = Math.floor(durationMs / 1000);
        if (!seconds) return;
        const date = dateKey();
        await database.run(
            `INSERT INTO analytics_daily (guild_id, date, voice_seconds) VALUES (?, ?, ?)
             ON CONFLICT(guild_id, date) DO UPDATE SET voice_seconds = voice_seconds + excluded.voice_seconds`,
            [guildId, date, seconds]
        );
        await database.run(
            `INSERT INTO analytics_user_daily (guild_id, date, user_id, messages, voice_seconds)
             VALUES (?, ?, ?, 0, ?)
             ON CONFLICT(guild_id, date, user_id) DO UPDATE SET voice_seconds = voice_seconds + excluded.voice_seconds`,
            [guildId, date, userId, seconds]
        );
        await database.run(
            `INSERT INTO analytics_voice_channel_daily (guild_id, date, channel_id, channel_name, voice_seconds)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(guild_id, date, channel_id) DO UPDATE SET
               channel_name = CASE WHEN excluded.channel_name <> '' THEN excluded.channel_name ELSE channel_name END,
               voice_seconds = voice_seconds + excluded.voice_seconds`,
            [guildId, date, session.channel_id, String(channelName || "").slice(0, 100), seconds]
        );
    }

    // Remove dados antigos para o banco não crescer indefinidamente.
    static async prune(days = RETENTION_DAYS) {
        const cutoff = addDays(dateKey(), -days);
        for (const table of ["analytics_daily", "analytics_channel_daily", "analytics_user_daily", "analytics_hourly", "analytics_voice_channel_daily"]) {
            await database.run(`DELETE FROM ${table} WHERE date < ?`, [cutoff]);
        }
        await database.run("DELETE FROM analytics_voice_sessions WHERE started_at < ?", [Date.now() - MAX_VOICE_SESSION_MS * 2]);
    }

    static async _totals(guildId, start, end) {
        const t = await database.get(
            `SELECT COALESCE(SUM(messages),0) AS messages, COALESCE(SUM(joins),0) AS joins,
                    COALESCE(SUM(leaves),0) AS leaves, COALESCE(SUM(voice_seconds),0) AS voiceSeconds
             FROM analytics_daily WHERE guild_id = ? AND date >= ? AND date <= ?`,
            [guildId, start, end]
        );
        const a = await database.get(
            `SELECT COUNT(DISTINCT user_id) AS count FROM analytics_user_daily
             WHERE guild_id = ? AND date >= ? AND date <= ? AND messages > 0`,
            [guildId, start, end]
        );
        return {
            messages: Number(t?.messages || 0), joins: Number(t?.joins || 0), leaves: Number(t?.leaves || 0),
            voiceSeconds: Number(t?.voiceSeconds || 0), activeMembers: Number(a?.count || 0)
        };
    }

    static async getAnalytics(guildId, days = 7, guild = null) {
        days = VALID_PERIODS.includes(Number(days)) ? Number(days) : 7;
        const endDate = dateKey();
        const startDate = addDays(endDate, -(days - 1));
        const prevEnd = addDays(startDate, -1);
        const prevStart = addDays(prevEnd, -(days - 1));

        const dailyRows = await database.all(
            `SELECT date, messages, joins, leaves, voice_seconds FROM analytics_daily
             WHERE guild_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
            [guildId, startDate, endDate]
        );
        const dailyMap = new Map(dailyRows.map(row => [row.date, row]));
        const series = [];
        for (let i = 0; i < days; i++) {
            const key = addDays(startDate, i);
            const row = dailyMap.get(key) || {};
            series.push({
                date: key,
                messages: Number(row.messages || 0), joins: Number(row.joins || 0),
                leaves: Number(row.leaves || 0), voiceSeconds: Number(row.voice_seconds || 0)
            });
        }

        const cur = await this._totals(guildId, startDate, endDate);
        const prev = await this._totals(guildId, prevStart, prevEnd);

        const [topChannelRows, topUserRows, topVoiceUserRows, topVoiceChannelRows, hourRows, moderation] = await Promise.all([
            database.all(
                `SELECT channel_id AS channelId, MAX(channel_name) AS name, SUM(messages) AS messages
                 FROM analytics_channel_daily WHERE guild_id = ? AND date >= ? AND date <= ?
                 GROUP BY channel_id ORDER BY messages DESC LIMIT 8`, [guildId, startDate, endDate]),
            database.all(
                `SELECT user_id AS userId, SUM(messages) AS messages, SUM(voice_seconds) AS voiceSeconds
                 FROM analytics_user_daily WHERE guild_id = ? AND date >= ? AND date <= ?
                 GROUP BY user_id HAVING messages > 0 ORDER BY messages DESC LIMIT 8`, [guildId, startDate, endDate]),
            database.all(
                `SELECT user_id AS userId, SUM(messages) AS messages, SUM(voice_seconds) AS voiceSeconds
                 FROM analytics_user_daily WHERE guild_id = ? AND date >= ? AND date <= ?
                 GROUP BY user_id HAVING voiceSeconds > 0 ORDER BY voiceSeconds DESC LIMIT 8`, [guildId, startDate, endDate]),
            database.all(
                `SELECT channel_id AS channelId, MAX(channel_name) AS name, SUM(voice_seconds) AS voiceSeconds
                 FROM analytics_voice_channel_daily WHERE guild_id = ? AND date >= ? AND date <= ?
                 GROUP BY channel_id ORDER BY voiceSeconds DESC LIMIT 8`, [guildId, startDate, endDate]),
            database.all(
                `SELECT hour, SUM(messages) AS messages FROM analytics_hourly
                 WHERE guild_id = ? AND date >= ? AND date <= ? GROUP BY hour`, [guildId, startDate, endDate]),
            database.get(
                `SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND date(created_at) >= ? AND date(created_at) <= ?`,
                [guildId, startDate, endDate]).catch(() => ({ count: 0 }))
        ]);

        const memberName = id => {
            const m = guild?.members?.cache?.get(id);
            return m?.displayName || m?.user?.username || `Usuário ${String(id).slice(-4)}`;
        };
        const mapMembers = rows => rows.map(r => ({
            userId: r.userId, name: memberName(r.userId),
            messages: Number(r.messages || 0), voiceSeconds: Number(r.voiceSeconds || 0)
        }));
        const topChannels = topChannelRows.map(r => ({
            channelId: r.channelId,
            name: guild?.channels?.cache?.get(r.channelId)?.name || r.name || "Canal removido",
            messages: Number(r.messages || 0)
        }));
        const topVoiceChannels = topVoiceChannelRows.map(r => ({
            channelId: r.channelId,
            name: guild?.channels?.cache?.get(r.channelId)?.name || r.name || "Canal removido",
            voiceSeconds: Number(r.voiceSeconds || 0)
        }));

        // Distribuição por hora do dia (0-23, horário de Brasília).
        const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, messages: 0 }));
        for (const r of hourRows) hours[Number(r.hour)] && (hours[Number(r.hour)].messages = Number(r.messages || 0));
        const peakHour = hours.reduce((a, b) => (b.messages > a.messages ? b : a), hours[0]);

        // Média por dia da semana.
        const wk = WEEKDAYS.map(name => ({ name, messages: 0, days: 0 }));
        for (const day of series) {
            const idx = new Date(`${day.date}T12:00:00Z`).getUTCDay();
            wk[idx].messages += day.messages;
            wk[idx].days += 1;
        }
        const weekdays = wk.map(w => ({ name: w.name, avgMessages: w.days ? Math.round(w.messages / w.days) : 0 }));
        const bestWeekday = weekdays.reduce((a, b) => (b.avgMessages > a.avgMessages ? b : a), weekdays[0]);
        const bestDay = series.reduce((a, b) => (b.messages > a.messages ? b : a), series[0]);

        const currentMembers = Number(guild?.memberCount || 0);
        const netGrowth = cur.joins - cur.leaves;
        const summary = {
            currentMembers,
            messages: cur.messages, joins: cur.joins, leaves: cur.leaves, netGrowth,
            activeMembers: cur.activeMembers,
            voiceMinutes: Math.floor(cur.voiceSeconds / 60),
            warnings: Number(moderation?.count || 0),
            avgMessagesPerDay: Math.round(cur.messages / days),
            messagesPerActiveMember: cur.activeMembers ? Math.round(cur.messages / cur.activeMembers) : 0,
            engagementRate: currentMembers ? Math.round((cur.activeMembers / currentMembers) * 1000) / 10 : 0,
            retentionRate: cur.joins ? Math.max(0, Math.round((1 - cur.leaves / cur.joins) * 100)) : null
        };
        const previous = {
            messages: prev.messages, joins: prev.joins, leaves: prev.leaves,
            netGrowth: prev.joins - prev.leaves, activeMembers: prev.activeMembers,
            voiceMinutes: Math.floor(prev.voiceSeconds / 60)
        };
        const changes = {
            messages: pctChange(cur.messages, prev.messages),
            joins: pctChange(cur.joins, prev.joins),
            leaves: pctChange(cur.leaves, prev.leaves),
            activeMembers: pctChange(cur.activeMembers, prev.activeMembers),
            voiceMinutes: pctChange(summary.voiceMinutes, previous.voiceMinutes)
        };

        const insights = [];
        const hh = h => `${String(h).padStart(2, "0")}h`;
        if (!cur.messages && !cur.joins) {
            insights.push({ type: "info", text: "Ainda não há dados suficientes neste período. Volte depois que a comunidade tiver atividade." });
        } else {
            if (changes.messages !== null) {
                insights.push(changes.messages >= 0
                    ? { type: "good", text: `As mensagens ${changes.messages === 0 ? "ficaram estáveis" : `subiram ${changes.messages}%`} em relação ao período anterior.` }
                    : { type: "warn", text: `As mensagens caíram ${Math.abs(changes.messages)}% em relação ao período anterior. Considere eventos ou conteúdos para reativar a conversa.` });
            }
            if (peakHour.messages > 0) insights.push({ type: "info", text: `O horário de maior atividade é ${hh(peakHour.hour)}–${hh((peakHour.hour + 1) % 24)}. Bom momento para anúncios e eventos.` });
            if (bestWeekday.avgMessages > 0) insights.push({ type: "info", text: `${bestWeekday.name} é o dia mais movimentado, com média de ${bestWeekday.avgMessages} mensagens.` });
            if (netGrowth < 0) insights.push({ type: "warn", text: `O servidor perdeu ${Math.abs(netGrowth)} membros líquidos. Revise boas-vindas e o primeiro contato com novos membros.` });
            else if (netGrowth > 0) insights.push({ type: "good", text: `Crescimento líquido de +${netGrowth} membros no período.` });
            if (summary.retentionRate !== null && cur.joins >= 5 && summary.retentionRate < 60) insights.push({ type: "warn", text: `Apenas ${summary.retentionRate}% dos que entraram permaneceram (saídas versus entradas). Vale melhorar a recepção.` });
            if (currentMembers >= 20 && summary.engagementRate < 5) insights.push({ type: "warn", text: `Só ${summary.engagementRate}% dos membros enviaram mensagens. Canais temáticos e sorteios podem aumentar o engajamento.` });
            else if (summary.engagementRate >= 15) insights.push({ type: "good", text: `Ótimo engajamento: ${summary.engagementRate}% dos membros participaram por mensagem.` });
            const top3 = topUserRows.slice(0, 3).reduce((s, r) => s + Number(r.messages || 0), 0);
            if (cur.messages >= 100 && top3 / cur.messages > 0.5) insights.push({ type: "warn", text: `Os 3 membros mais ativos geram ${Math.round((top3 / cur.messages) * 100)}% das mensagens. A atividade está concentrada em poucas pessoas.` });
        }

        return {
            period: { days, start: startDate, end: endDate, previousStart: prevStart, previousEnd: prevEnd, timezone: TIMEZONE },
            summary, previous, changes, series,
            topChannels, topMembers: mapMembers(topUserRows),
            topVoiceMembers: mapMembers(topVoiceUserRows), topVoiceChannels,
            hours, peakHour: peakHour.messages ? peakHour.hour : null,
            weekdays, bestDay: bestDay?.messages ? { date: bestDay.date, messages: bestDay.messages } : null,
            insights
        };
    }

    static async exportCsv(guildId, days = 30) {
        const data = await this.getAnalytics(guildId, days);
        const lines = ["data,mensagens,entradas,saidas,saldo,minutos_voz"];
        for (const r of data.series) {
            lines.push([r.date, r.messages, r.joins, r.leaves, r.joins - r.leaves, Math.floor(r.voiceSeconds / 60)].join(","));
        }
        return lines.join("\n");
    }
}

module.exports = AnalyticsRepository;
