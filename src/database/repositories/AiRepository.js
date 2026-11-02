const database = require("../database");

class AiRepository {
    static async getGuildConfig(guildId) {
        let config = await database.get(
            `SELECT * FROM ai_guild_config WHERE guild_id = ?`,
            [guildId]
        );

        if (!config) {
            await database.run(
                `INSERT OR IGNORE INTO ai_guild_config (guild_id, enabled, limit_per_user, limit_per_server)
                 VALUES (?, 1, 15, 200)`,
                [guildId]
            );
            config = await database.get(
                `SELECT * FROM ai_guild_config WHERE guild_id = ?`,
                [guildId]
            );
        }

        return config || { guild_id: guildId, enabled: 1, limit_per_user: 15, limit_per_server: 200 };
    }

    static async setGuildConfig(guildId, values) {
        await this.getGuildConfig(guildId);
        const keys = Object.keys(values);
        if (!keys.length) return;

        await database.run(
            `UPDATE ai_guild_config SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE guild_id = ?`,
            [...keys.map(key => values[key]), guildId]
        );
    }

    static async upsertFaq(guildId, question, answer, createdBy) {
        const normalized = String(question).trim();
        if (!normalized || !answer?.trim()) return null;

        const existing = await database.get(
            `SELECT * FROM ai_faq WHERE guild_id = ? AND LOWER(question) = LOWER(?) LIMIT 1`,
            [guildId, normalized]
        );

        if (existing) {
            await database.run(
                `UPDATE ai_faq SET answer = ?, created_by = ? WHERE id = ?`,
                [String(answer).trim(), createdBy, existing.id]
            );
            return existing.id;
        }

        const result = await database.run(
            `INSERT INTO ai_faq (guild_id, question, answer, created_by) VALUES (?, ?, ?, ?)`,
            [guildId, normalized, String(answer).trim(), createdBy]
        );
        return result.insertId;
    }

    static async countFaq(guildId) {
        const row = await database.get(`SELECT COUNT(*) AS total FROM ai_faq WHERE guild_id = ?`, [guildId]);
        return Number(row?.total || 0);
    }

    static async faqExists(guildId, question) {
        const row = await database.get(
            `SELECT 1 AS ok FROM ai_faq WHERE guild_id = ? AND LOWER(question) = LOWER(?) LIMIT 1`,
            [guildId, String(question).trim()]
        );
        return Boolean(row);
    }

    static async listFaq(guildId) {
        return database.all(
            `SELECT * FROM ai_faq WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200`,
            [guildId]
        );
    }

    static async deleteFaq(guildId, id) {
        await database.run(
            `DELETE FROM ai_faq WHERE guild_id = ? AND id = ?`,
            [guildId, id]
        );
    }

    static async findMatchingFaq(guildId, rawQuestion) {
        const question = String(rawQuestion || "").trim().toLowerCase();
        if (!question) return null;

        const rows = await database.all(
            `SELECT * FROM ai_faq WHERE guild_id = ? ORDER BY id DESC LIMIT 200`,
            [guildId]
        );

        for (const row of rows) {
            const faqText = String(row.question || "").toLowerCase();
            const answer = String(row.answer || "");
            if (!faqText || !answer) continue;

            const direct = faqText.includes(question) || question.includes(faqText);
            const faqWords = faqText.split(/\s+/).filter(Boolean);
            const questionWords = question.split(/\s+/).filter(Boolean);
            const overlap = faqWords.filter(word => questionWords.includes(word)).length;
            const ratio = overlap / Math.max(1, faqWords.length);

            if (direct || ratio >= 0.6) {
                return row;
            }
        }

        return null;
    }

    static async getDailyUsage(guildId, userId, date = new Date().toISOString().slice(0, 10)) {
        const row = await database.get(
            `SELECT count FROM ai_usage WHERE guild_id = ? AND user_id = ? AND date = ?`,
            [guildId, userId, date]
        );
        return row?.count || 0;
    }

    static async consumeUsage(guildId, userId, maxUser = 15, maxServer = 200, date = new Date().toISOString().slice(0, 10)) {
        const current = await this.getDailyUsage(guildId, userId, date);
        const guildCount = await database.get(
            `SELECT SUM(count) AS total FROM ai_usage WHERE guild_id = ? AND date = ?`,
            [guildId, date]
        );
        const totalServer = Number(guildCount?.total || 0);

        if (current >= maxUser || totalServer >= maxServer) {
            return { allowed: false, current, totalServer, limitUser: maxUser, limitServer: maxServer };
        }

        await database.run(
            `INSERT INTO ai_usage (guild_id, user_id, date, count)
             VALUES (?, ?, ?, 1)
             ON CONFLICT(guild_id, user_id, date)
             DO UPDATE SET count = count + 1`,
            [guildId, userId, date]
        );

        return { allowed: true, current: current + 1, totalServer: totalServer + 1, limitUser: maxUser, limitServer: maxServer };
    }

    static async setBirthday(guildId, userId, month, day) {
        await database.run(
            `INSERT INTO guild_birthdays (guild_id, user_id, month, day)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(guild_id, user_id)
             DO UPDATE SET month = excluded.month, day = excluded.day`,
            [guildId, userId, month, day]
        );
    }

    static async getBirthday(guildId, userId) {
        return database.get(
            `SELECT * FROM guild_birthdays WHERE guild_id = ? AND user_id = ?`,
            [guildId, userId]
        );
    }

    static async listBirthdays(guildId) {
        return database.all(
            `SELECT * FROM guild_birthdays WHERE guild_id = ? ORDER BY month, day`,
            [guildId]
        );
    }
}

module.exports = AiRepository;
