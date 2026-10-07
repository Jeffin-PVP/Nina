const database = require("../database");

const DEFAULTS = {
    enabled: 0,
    action: "ban",
    window_seconds: 10,
    channel_limit: 3,
    role_limit: 3,
    member_limit: 3,
    bot_limit: 1,
    webhook_limit: 3
};

class AntiNukeRepository {
    static async get(guildId) {
        let row = await database.get(
            `SELECT * FROM antinuke_settings WHERE guild_id = ?`,
            [guildId]
        );
        if (!row) {
            await database.run(`INSERT OR IGNORE INTO antinuke_settings (guild_id) VALUES (?)`, [guildId]);
            row = await database.get(`SELECT * FROM antinuke_settings WHERE guild_id = ?`, [guildId]);
        }
        return { ...DEFAULTS, ...row };
    }

    static async update(guildId, values) {
        await this.get(guildId);
        const keys = Object.keys(values);
        if (!keys.length) return;
        const fields = keys.map(key => `${key} = ?`).join(", ");
        await database.run(`UPDATE antinuke_settings SET ${fields} WHERE guild_id = ?`, [
            ...keys.map(key => values[key]),
            guildId
        ]);
    }

    static async setEnabled(guildId, enabled) {
        await this.update(guildId, { enabled: enabled ? 1 : 0 });
    }
}

module.exports = AntiNukeRepository;
