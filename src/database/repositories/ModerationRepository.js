const database = require("../database");

class ModerationRepository {

    static async ensureGuildSettings(guildId) {
        const existing = await database.get(
            `SELECT * FROM moderation_settings WHERE guild_id = ?`,
            [guildId]
        );

        if (existing) return existing;

        await database.run(
            `INSERT INTO moderation_settings (
                guild_id,
                warns_to_timeout,
                warns_to_kick,
                warns_to_ban
            ) VALUES (?, ?, ?, ?)`,
            [guildId, 3, 5, 8]
        );

        return {
            guild_id: guildId,
            warns_to_timeout: 3,
            warns_to_kick: 5,
            warns_to_ban: 8
        };
    }

    static async getGuildSettings(guildId) {
        const row = await database.get(
            `SELECT * FROM moderation_settings WHERE guild_id = ?`,
            [guildId]
        );

        if (row) {
            return row;
        }

        return this.ensureGuildSettings(guildId);
    }

    static async nextCaseNumber(guildId) {
        const row = await database.get(
            `SELECT COALESCE(MAX(case_number), 0) + 1 AS next_number
             FROM moderation_cases
             WHERE guild_id = ?`,
            [guildId]
        );

        return Number(row?.next_number || 1);
    }

    static async createCase({
        guildId,
        userId,
        moderatorId,
        type,
        reason,
        metadata = {}
    }) {
        const caseNumber = await this.nextCaseNumber(guildId);

        const result = await database.run(
            `INSERT INTO moderation_cases (
                guild_id,
                user_id,
                moderator_id,
                case_number,
                type,
                reason,
                metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                guildId,
                userId,
                moderatorId,
                caseNumber,
                type,
                reason,
                JSON.stringify(metadata)
            ]
        );

        return {
            id: Number(result.lastID),
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            case_number: caseNumber,
            type,
            reason,
            metadata,
            created_at: new Date().toISOString()
        };
    }

    static async getUserCases({ guildId, userId }) {
        return database.all(
            `SELECT *
             FROM moderation_cases
             WHERE guild_id = ? AND user_id = ?
             ORDER BY created_at DESC, case_number DESC`,
            [guildId, userId]
        );
    }

    static async getGuildCases({ guildId, limit = 20 }) {
        return database.all(
            `SELECT *
             FROM moderation_cases
             WHERE guild_id = ?
             ORDER BY created_at DESC, case_number DESC
             LIMIT ?`,
            [guildId, limit]
        );
    }

    static async getCaseByNumber({ guildId, caseNumber }) {
        return database.get(
            `SELECT *
             FROM moderation_cases
             WHERE guild_id = ? AND case_number = ?`,
            [guildId, caseNumber]
        );
    }

    static async addNote({ guildId, userId, moderatorId, note }) {
        const result = await database.run(
            `INSERT INTO staff_notes (
                guild_id,
                user_id,
                moderator_id,
                note
            ) VALUES (?, ?, ?, ?)`,
            [guildId, userId, moderatorId, note]
        );

        return {
            id: Number(result.lastID),
            guild_id: guildId,
            user_id: userId,
            moderator_id: moderatorId,
            note,
            created_at: new Date().toISOString()
        };
    }

    static async getUserNotes({ guildId, userId }) {
        return database.all(
            `SELECT *
             FROM staff_notes
             WHERE guild_id = ? AND user_id = ?
             ORDER BY created_at DESC`,
            [guildId, userId]
        );
    }

    static async saveTemporaryBan({ guildId, userId, moderatorId, reason, expiresAt }) {
        await database.run(
            `INSERT INTO temporary_bans (
                guild_id,
                user_id,
                moderator_id,
                reason,
                expires_at
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                moderator_id = excluded.moderator_id,
                reason = excluded.reason,
                expires_at = excluded.expires_at,
                created_at = CURRENT_TIMESTAMP`,
            [guildId, userId, moderatorId, reason, expiresAt]
        );
    }

    static async removeTemporaryBan({ guildId, userId }) {
        await database.run(
            `DELETE FROM temporary_bans WHERE guild_id = ? AND user_id = ?`,
            [guildId, userId]
        );
    }

    static async getExpiredTemporaryBans(now = Date.now()) {
        return database.all(
            `SELECT * FROM temporary_bans WHERE expires_at <= ?`,
            [now]
        );
    }

    static async getModeratorSummary({ guildId, days = 7 }) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        return database.all(
            `SELECT moderator_id,
                    COUNT(*) AS total_actions,
                    SUM(CASE WHEN type = 'warn' THEN 1 ELSE 0 END) AS warns,
                    SUM(CASE WHEN type = 'timeout' THEN 1 ELSE 0 END) AS timeouts,
                    SUM(CASE WHEN type = 'kick' THEN 1 ELSE 0 END) AS kicks,
                    SUM(CASE WHEN type = 'ban' THEN 1 ELSE 0 END) AS bans
             FROM moderation_cases
             WHERE guild_id = ? AND created_at >= ?
             GROUP BY moderator_id
             ORDER BY total_actions DESC`,
            [guildId, new Date(since).toISOString()]
        );
    }
}

module.exports = ModerationRepository;
