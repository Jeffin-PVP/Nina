const database = require("../database");

class GlobalBanRepository {

    static async ban(userId, userTag, reason, bannedBy) {

        await database.run(
            `
            INSERT INTO global_bans (user_id, user_tag, reason, banned_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                user_tag = excluded.user_tag,
                reason = excluded.reason,
                banned_by = excluded.banned_by,
                banned_at = CURRENT_TIMESTAMP
            `,
            [userId, userTag || null, reason || null, bannedBy || null]
        );

    }

    static async unban(userId) {

        await database.run(
            `
            DELETE FROM global_bans
            WHERE user_id = ?
            `,
            [userId]
        );

    }

    static async isBanned(userId) {

        const row = await database.get(
            `
            SELECT 1
            FROM global_bans
            WHERE user_id = ?
            `,
            [userId]
        );

        return !!row;

    }

    static async list() {

        return database.all(
            `
            SELECT *
            FROM global_bans
            ORDER BY banned_at DESC
            `
        );

    }

}

module.exports = GlobalBanRepository;
