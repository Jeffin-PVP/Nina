const database = require("../database");

const DEFAULTS = {
    enabled: 0,
    category_id: null,
    trigger_channel_id: null,
    panel_channel_id: null,
    default_limit: 0,
    auto_lock: 0,
    name_template: "🔊 {user}",
    admin_manage: 1,
    manager_role_id: null,
    owner_rename: 1,
    owner_lock: 1,
    owner_limit: 1,
    owner_kick: 1,
    owner_ban: 1,
    owner_transfer: 1,
    owner_delete: 1
};

class TempVoiceRepository {
    static async get(guildId) {
        let row = await database.get(
            `SELECT * FROM temp_voice_settings WHERE guild_id = ?`,
            [guildId]
        );

        if (!row) {
            await database.run(
                `INSERT OR IGNORE INTO temp_voice_settings (guild_id) VALUES (?)`,
                [guildId]
            );
            row = await database.get(
                `SELECT * FROM temp_voice_settings WHERE guild_id = ?`,
                [guildId]
            );
        }

        return { ...DEFAULTS, ...row };
    }

    static async set(guildId, values) {
        await this.get(guildId);
        const keys = Object.keys(values);
        if (!keys.length) return;

        const fields = keys.map(key => `${key} = ?`).join(", ");
        await database.run(
            `UPDATE temp_voice_settings SET ${fields} WHERE guild_id = ?`,
            [...keys.map(key => values[key]), guildId]
        );
    }

    static async setEnabled(guildId, enabled) {
        return this.set(guildId, { enabled: enabled ? 1 : 0 });
    }

    static async addRoom(guildId, channelId, ownerId) {
        await database.run(
            `INSERT OR REPLACE INTO temp_voice_rooms
             (guild_id, channel_id, owner_id)
             VALUES (?, ?, ?)`,
            [guildId, channelId, ownerId]
        );
    }

    static async getRoom(channelId) {
        return database.get(
            `SELECT * FROM temp_voice_rooms WHERE channel_id = ?`,
            [channelId]
        );
    }

    static async getRooms(guildId) {
        return database.all(
            `SELECT * FROM temp_voice_rooms WHERE guild_id = ?`,
            [guildId]
        );
    }

    static async setRoom(channelId, values) {
        const keys = Object.keys(values);
        if (!keys.length) return;

        const fields = keys.map(key => `${key} = ?`).join(", ");
        await database.run(
            `UPDATE temp_voice_rooms SET ${fields} WHERE channel_id = ?`,
            [...keys.map(key => values[key]), channelId]
        );
    }

    static async removeRoom(channelId) {
        await database.run(
            `DELETE FROM temp_voice_rooms WHERE channel_id = ?`,
            [channelId]
        );
        await database.run(
            `DELETE FROM temp_voice_bans WHERE channel_id = ?`,
            [channelId]
        );
    }

    static async removeAllRooms(guildId) {
        await database.run(
            `DELETE FROM temp_voice_rooms WHERE guild_id = ?`,
            [guildId]
        );
        await database.run(
            `DELETE FROM temp_voice_bans WHERE guild_id = ?`,
            [guildId]
        );
    }

    static async banUser(channelId, guildId, userId) {
        await database.run(
            `INSERT OR IGNORE INTO temp_voice_bans (guild_id, channel_id, user_id)
             VALUES (?, ?, ?)`,
            [guildId, channelId, userId]
        );
    }

    static async unbanUser(channelId, userId) {
        await database.run(
            `DELETE FROM temp_voice_bans WHERE channel_id = ? AND user_id = ?`,
            [channelId, userId]
        );
    }

    static async isBanned(channelId, userId) {
        return !!await database.get(
            `SELECT 1 FROM temp_voice_bans WHERE channel_id = ? AND user_id = ?`,
            [channelId, userId]
        );
    }

    static async getBans(channelId) {
        return database.all(
            `SELECT user_id FROM temp_voice_bans WHERE channel_id = ?`,
            [channelId]
        );
    }
}

module.exports = TempVoiceRepository;
