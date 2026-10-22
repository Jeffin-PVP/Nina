const database = require("../database");

const MAX_VOICE_SESSION_MS = 12 * 60 * 60 * 1000;
const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);

class AnalyticsRepository {
    static async recordMessage({ guildId, channelId, channelName, userId }) {
        if (!guildId || !channelId || !userId) return;
        const date = dateKey();
        await database.run(
            `INSERT INTO analytics_daily (guild_id, date, messages)
             VALUES (?, ?, 1)
             ON CONFLICT(guild_id, date) DO UPDATE SET messages = messages + 1`,
            [guildId, date]
        );
        await database.run(
            `INSERT INTO analytics_channel_daily (guild_id, date, channel_id, channel_name, messages)
             VALUES (?, ?, ?, ?, 1)
             ON CONFLICT(guild_id, date, channel_id) DO UPDATE SET
               channel_name = excluded.channel_name,
               messages = messages + 1`,
            [guildId, date, channelId, String(channelName || "Canal removido").slice(0, 100)]
        );
        await database.run(
            `INSERT INTO analytics_user_daily (guild_id, date, user_id, messages, voice_seconds)
             VALUES (?, ?, ?, 1, 0)
             ON CONFLICT(guild_id, date, user_id) DO UPDATE SET messages = messages + 1`,
            [guildId, date, userId]
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

    static async closeVoiceSession(guildId, userId) {
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
    }

    static async getAnalytics(guildId, days = 7, guild = null) {
        days = [7, 14, 30, 90].includes(Number(days)) ? Number(days) : 7;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const startDate = dateKey(start);
        const endDate = dateKey(today);

        const dailyRows = await database.all(
            `SELECT date, messages, joins, leaves, voice_seconds
             FROM analytics_daily WHERE guild_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
            [guildId, startDate, endDate]
        );
        const dailyMap = new Map(dailyRows.map(row => [row.date, row]));
        const series = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(start);
            date.setUTCDate(start.getUTCDate() + i);
            const key = dateKey(date);
            const row = dailyMap.get(key) || {};
            series.push({
                date: key,
                messages: Number(row.messages || 0),
                joins: Number(row.joins || 0),
                leaves: Number(row.leaves || 0),
                voiceSeconds: Number(row.voice_seconds || 0)
            });
        }

        const totals = series.reduce((acc, row) => {
            acc.messages += row.messages;
            acc.joins += row.joins;
            acc.leaves += row.leaves;
            acc.voiceSeconds += row.voiceSeconds;
            return acc;
        }, { messages: 0, joins: 0, leaves: 0, voiceSeconds: 0 });

        const active = await database.get(
            `SELECT COUNT(DISTINCT user_id) AS count FROM analytics_user_daily
             WHERE guild_id = ? AND date >= ? AND date <= ? AND messages > 0`,
            [guildId, startDate, endDate]
        );
        const topChannelRows = await database.all(
            `SELECT channel_id AS channelId, MAX(channel_name) AS name, SUM(messages) AS messages
             FROM analytics_channel_daily WHERE guild_id = ? AND date >= ? AND date <= ?
             GROUP BY channel_id ORDER BY messages DESC LIMIT 8`,
            [guildId, startDate, endDate]
        );
        const topUserRows = await database.all(
            `SELECT user_id AS userId, SUM(messages) AS messages, SUM(voice_seconds) AS voiceSeconds
             FROM analytics_user_daily WHERE guild_id = ? AND date >= ? AND date <= ?
             GROUP BY user_id ORDER BY messages DESC LIMIT 8`,
            [guildId, startDate, endDate]
        );
        const moderation = await database.get(
            `SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND date(created_at) >= ? AND date(created_at) <= ?`,
            [guildId, startDate, endDate]
        );

        const topChannels = topChannelRows.map(row => ({
            channelId: row.channelId,
            name: guild?.channels?.cache?.get(row.channelId)?.name || row.name || "Canal removido",
            messages: Number(row.messages || 0)
        }));
        const topMembers = topUserRows.map(row => {
            const member = guild?.members?.cache?.get(row.userId);
            return {
                userId: row.userId,
                name: member?.displayName || member?.user?.username || `Usuário ${row.userId.slice(-4)}`,
                messages: Number(row.messages || 0),
                voiceSeconds: Number(row.voiceSeconds || 0)
            };
        });

        return {
            period: { days, start: startDate, end: endDate },
            summary: {
                currentMembers: Number(guild?.memberCount || 0),
                messages: totals.messages,
                joins: totals.joins,
                leaves: totals.leaves,
                netGrowth: totals.joins - totals.leaves,
                activeMembers: Number(active?.count || 0),
                voiceMinutes: Math.floor(totals.voiceSeconds / 60),
                warnings: Number(moderation?.count || 0)
            },
            series,
            topChannels,
            topMembers
        };
    }
}

module.exports = AnalyticsRepository;
