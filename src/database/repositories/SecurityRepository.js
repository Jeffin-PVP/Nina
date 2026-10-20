const database = require("../database");

const DEFAULTS = {
    topic_enabled: 0,
    contextual_enabled: 0,
    topic_warn_enabled: 0,
    topic_timeout_enabled: 0,
    topic_timeout_minutes: 5,
    honeypot_enabled: 0,
    honeypot_channel_id: null,
    behavior_enabled: 0,
    alert_channel_id: null,
    ignored_roles: "[]"
};

const VALID_SETTINGS = new Set(Object.keys(DEFAULTS));
const CACHE_TTL_MS = 15000;
const configCache = new Map();
const rulesCache = new Map();

class SecurityRepository {
    static async get(guildId) {
        const cached = configCache.get(guildId);
        if (cached && cached.expiresAt > Date.now()) return { ...cached.value };
        const row = await database.get(
            "SELECT * FROM security_settings WHERE guild_id = ?",
            [guildId]
        );
        const value = { guild_id: guildId, ...DEFAULTS, ...(row || {}) };
        configCache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return { ...value };
    }

    static async update(guildId, fields) {
        const safe = Object.fromEntries(
            Object.entries(fields || {}).filter(([key]) => VALID_SETTINGS.has(key))
        );
        if (!Object.keys(safe).length) return this.get(guildId);

        const current = await this.get(guildId);
        const next = { ...current, ...safe };
        await database.run(
            `INSERT INTO security_settings (
                guild_id, topic_enabled, contextual_enabled, topic_warn_enabled,
                topic_timeout_enabled, topic_timeout_minutes, honeypot_enabled,
                honeypot_channel_id, behavior_enabled, alert_channel_id, ignored_roles
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                topic_enabled = excluded.topic_enabled,
                contextual_enabled = excluded.contextual_enabled,
                topic_warn_enabled = excluded.topic_warn_enabled,
                topic_timeout_enabled = excluded.topic_timeout_enabled,
                topic_timeout_minutes = excluded.topic_timeout_minutes,
                honeypot_enabled = excluded.honeypot_enabled,
                honeypot_channel_id = excluded.honeypot_channel_id,
                behavior_enabled = excluded.behavior_enabled,
                alert_channel_id = excluded.alert_channel_id,
                ignored_roles = excluded.ignored_roles`,
            [guildId, next.topic_enabled ? 1 : 0, next.contextual_enabled ? 1 : 0,
                next.topic_warn_enabled ? 1 : 0, next.topic_timeout_enabled ? 1 : 0,
                Math.max(1, Math.min(60, Number(next.topic_timeout_minutes) || 5)),
                next.honeypot_enabled ? 1 : 0, next.honeypot_channel_id || null,
                next.behavior_enabled ? 1 : 0, next.alert_channel_id || null,
                typeof next.ignored_roles === "string" ? next.ignored_roles : JSON.stringify(next.ignored_roles || [])]
        );
        configCache.delete(guildId);
        return this.get(guildId);
    }

    static async listRules(guildId) {
        const cached = rulesCache.get(guildId);
        if (cached && cached.expiresAt > Date.now()) return cached.value.map(rule => ({ ...rule, keywords: [...rule.keywords] }));
        const rows = await database.all(
            "SELECT * FROM security_topic_rules WHERE guild_id = ? ORDER BY id DESC LIMIT 50",
            [guildId]
        );
        const value = rows.map(row => ({
            ...row,
            keywords: safeJson(row.keywords_json, [])
        }));
        rulesCache.set(guildId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value.map(rule => ({ ...rule, keywords: [...rule.keywords] }));
    }

    static async addRule({ guildId, channelId, topic, keywords }) {
        const result = await database.run(
            `INSERT INTO security_topic_rules (guild_id, channel_id, topic, keywords_json, enabled)
             VALUES (?, ?, ?, ?, 1)`,
            [guildId, channelId, topic, JSON.stringify(keywords)]
        );
        rulesCache.delete(guildId);
        return result.lastID;
    }

    static async removeRule(guildId, ruleId) {
        const result = await database.run(
            "DELETE FROM security_topic_rules WHERE guild_id = ? AND id = ?",
            [guildId, ruleId]
        );
        rulesCache.delete(guildId);
        return result;
    }

    static async logEvent({ guildId, channelId = null, userId = null, eventType, reason, details = null }) {
        await database.run(
            `INSERT INTO security_events (guild_id, channel_id, user_id, event_type, reason, details_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [guildId, channelId, userId, eventType, String(reason || "Evento de segurança").slice(0, 300),
                details ? JSON.stringify(details).slice(0, 2000) : null]
        );
    }
}

function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = SecurityRepository;
