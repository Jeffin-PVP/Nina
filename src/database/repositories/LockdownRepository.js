const database = require("../database");

const LIST_FIELDS = new Set([
    "channel_ids",
    "category_ids",
    "allowed_role_ids",
    "denied_role_ids"
]);

const BOOLEAN_FIELDS = new Set(["enabled", "active"]);

class LockdownRepository {

    static async get(guildId) {
        const row = await database.get(
            "SELECT * FROM lockdown_settings WHERE guild_id = ?",
            [guildId]
        );

        if (!row) {
            return {
                guild_id: guildId,
                enabled: 0,
                active: 0,
                channel_ids: [],
                category_ids: [],
                allowed_role_ids: [],
                denied_role_ids: []
            };
        }

        return {
            ...row,
            enabled: !!row.enabled,
            active: !!row.active,
            channel_ids: JSON.parse(row.channel_ids),
            category_ids: JSON.parse(row.category_ids),
            allowed_role_ids: JSON.parse(row.allowed_role_ids),
            denied_role_ids: JSON.parse(row.denied_role_ids)
        };
    }

    static async update(guildId, fields) {
        const assignments = [];
        const values = [];

        for (const [field, value] of Object.entries(fields)) {
            if (LIST_FIELDS.has(field)) {
                if (!Array.isArray(value) || value.some(id => typeof id !== "string")) {
                    throw new TypeError(`Invalid lockdown list: ${field}`);
                }
                assignments.push(`${field} = ?`);
                values.push(JSON.stringify([...new Set(value)]));
            } else if (BOOLEAN_FIELDS.has(field)) {
                assignments.push(`${field} = ?`);
                values.push(value ? 1 : 0);
            } else {
                throw new TypeError(`Invalid lockdown setting: ${field}`);
            }
        }

        if (!assignments.length) return this.get(guildId);

        await database.run(
            `INSERT INTO lockdown_settings (guild_id) VALUES (?)
             ON CONFLICT(guild_id) DO NOTHING`,
            [guildId]
        );
        await database.run(
            `UPDATE lockdown_settings SET ${assignments.join(", ")} WHERE guild_id = ?`,
            [...values, guildId]
        );

        return this.get(guildId);
    }

    static async saveSnapshot(guildId, channelId, overwrites) {
        await database.run(
            `INSERT INTO lockdown_snapshots (guild_id, channel_id, overwrites_json)
             VALUES (?, ?, ?)
             ON CONFLICT(guild_id, channel_id) DO UPDATE SET overwrites_json = excluded.overwrites_json`,
            [guildId, channelId, JSON.stringify(overwrites)]
        );
    }

    static async listSnapshots(guildId) {
        const rows = await database.all(
            "SELECT channel_id, overwrites_json FROM lockdown_snapshots WHERE guild_id = ?",
            [guildId]
        );
        return rows.map(row => ({
            channel_id: row.channel_id,
            overwrites: JSON.parse(row.overwrites_json)
        }));
    }

    static async removeSnapshot(guildId, channelId) {
        await database.run(
            "DELETE FROM lockdown_snapshots WHERE guild_id = ? AND channel_id = ?",
            [guildId, channelId]
        );
    }

    static async clearSnapshots(guildId) {
        await database.run(
            "DELETE FROM lockdown_snapshots WHERE guild_id = ?",
            [guildId]
        );
    }

}

module.exports = LockdownRepository;
