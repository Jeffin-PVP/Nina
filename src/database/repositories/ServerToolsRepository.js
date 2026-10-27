const database = require("../database");

// Colunas permitidas por tabela de configuração (evita SQL dinâmico com nomes arbitrários).
const CONFIG_COLUMNS = {
    verification_config: ["enabled", "mode", "role_id", "unverified_role_id", "channel_id", "message_id"],
    account_filter_config: ["enabled", "min_age_days", "action", "alert_channel_id"],
    weekly_report_config: ["enabled", "channel_id", "day", "last_sent"]
};

const MAX_BACKUPS_PER_GUILD = 10;

class ServerToolsRepository {
    static async getConfig(table, guildId) {
        if (!CONFIG_COLUMNS[table]) throw new Error(`Tabela inválida: ${table}`);
        let row = await database.get(`SELECT * FROM ${table} WHERE guild_id = ?`, [guildId]);
        if (!row) {
            await database.run(`INSERT OR IGNORE INTO ${table} (guild_id) VALUES (?)`, [guildId]);
            row = await database.get(`SELECT * FROM ${table} WHERE guild_id = ?`, [guildId]);
        }
        return row;
    }

    static async setConfig(table, guildId, values) {
        if (!CONFIG_COLUMNS[table]) throw new Error(`Tabela inválida: ${table}`);
        await this.getConfig(table, guildId);
        const keys = Object.keys(values).filter(key => CONFIG_COLUMNS[table].includes(key));
        if (!keys.length) return;
        await database.run(
            `UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE guild_id = ?`,
            [...keys.map(key => values[key]), guildId]
        );
    }

    static async listEnabled(table) {
        if (!CONFIG_COLUMNS[table]) throw new Error(`Tabela inválida: ${table}`);
        return database.all(`SELECT * FROM ${table} WHERE enabled = 1`);
    }

    /* AFK */
    static async setAfk(guildId, userId, reason) {
        await database.run(
            `INSERT INTO afk_users (guild_id, user_id, reason, since) VALUES (?, ?, ?, ?)
             ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = excluded.reason, since = excluded.since`,
            [guildId, userId, reason, Date.now()]
        );
    }

    static async getAfk(guildId, userId) {
        return database.get("SELECT * FROM afk_users WHERE guild_id = ? AND user_id = ?", [guildId, userId]);
    }

    static async getAfkMany(guildId, userIds) {
        if (!userIds.length) return [];
        const marks = userIds.map(() => "?").join(",");
        return database.all(`SELECT * FROM afk_users WHERE guild_id = ? AND user_id IN (${marks})`, [guildId, ...userIds]);
    }

    static async removeAfk(guildId, userId) {
        await database.run("DELETE FROM afk_users WHERE guild_id = ? AND user_id = ?", [guildId, userId]);
    }

    /* BACKUPS */
    static async createBackup(guildId, name, data, createdBy) {
        const result = await database.run(
            "INSERT INTO guild_backups (guild_id, name, data, created_by) VALUES (?, ?, ?, ?)",
            [guildId, name, JSON.stringify(data), createdBy]
        );
        // Mantém só os mais recentes.
        await database.run(
            `DELETE FROM guild_backups WHERE guild_id = ? AND id NOT IN
             (SELECT id FROM guild_backups WHERE guild_id = ? ORDER BY id DESC LIMIT ?)`,
            [guildId, guildId, MAX_BACKUPS_PER_GUILD]
        );
        return result?.lastID ?? result?.lastInsertRowid ?? null;
    }

    static async listBackups(guildId) {
        return database.all(
            "SELECT id, name, created_by, created_at, length(data) AS size FROM guild_backups WHERE guild_id = ? ORDER BY id DESC",
            [guildId]
        );
    }

    static async getBackup(guildId, id) {
        const row = await database.get("SELECT * FROM guild_backups WHERE guild_id = ? AND id = ?", [guildId, id]);
        if (!row) return null;
        return { ...row, data: JSON.parse(row.data) };
    }

    static async deleteBackup(guildId, id) {
        await database.run("DELETE FROM guild_backups WHERE guild_id = ? AND id = ?", [guildId, id]);
    }
}

ServerToolsRepository.MAX_BACKUPS_PER_GUILD = MAX_BACKUPS_PER_GUILD;
module.exports = ServerToolsRepository;
