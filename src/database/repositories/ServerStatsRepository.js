const database = require("../database");

const DEFAULTS = {
    enabled: 0,
    members_enabled: 1,
    bots_enabled: 1,
    online_enabled: 1,
    offline_enabled: 1,
    voice_enabled: 1,
    channels_enabled: 1,
    categories_enabled: 1,
    roles_enabled: 1,
    servers_enabled: 1,
    category_id: null,
    channel_ids: "{}"
};

class ServerStatsRepository {
    static async get(guildId) {
        let row = await database.get(
            `SELECT * FROM server_stats WHERE guild_id = ?`,
            [guildId]
        );

        if (!row) {
            await database.run(
                `INSERT OR IGNORE INTO server_stats (guild_id) VALUES (?)`,
                [guildId]
            );
            row = await database.get(
                `SELECT * FROM server_stats WHERE guild_id = ?`,
                [guildId]
            );
        }

        return { ...DEFAULTS, ...row };
    }

    static async update(guildId, values) {
        await this.get(guildId);
        const keys = Object.keys(values);
        if (!keys.length) return;

        const fields = keys.map(key => `${key} = ?`).join(", ");
        await database.run(
            `UPDATE server_stats SET ${fields} WHERE guild_id = ?`,
            [...keys.map(key => values[key]), guildId]
        );
    }

    static async setEnabled(guildId, enabled) {
        await this.update(guildId, { enabled: enabled ? 1 : 0 });
    }

    static async setCounter(guildId, counter, enabled) {
        const allowed = [
            "members", "bots", "online", "offline", "voice",
            "channels", "categories", "roles", "servers"
        ];
        if (!allowed.includes(counter)) throw new Error("Contador inválido.");
        await this.update(guildId, { [`${counter}_enabled`]: enabled ? 1 : 0 });
    }

    static parseChannelIds(value) {
        try {
            const parsed = JSON.parse(value || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    static async getChannelIds(guildId) {
        const row = await this.get(guildId);
        return this.parseChannelIds(row.channel_ids);
    }

    static async setChannelIds(guildId, ids) {
        await this.update(guildId, { channel_ids: JSON.stringify(ids || {}) });
    }

    static async reset(guildId) {
        await database.run(`DELETE FROM server_stats WHERE guild_id = ?`, [guildId]);
    }
}

module.exports = ServerStatsRepository;
