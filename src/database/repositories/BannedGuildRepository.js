const database = require("../database");

class BannedGuildRepository {

    static async ban(guildId, guildName, reason) {

        await database.run(

            `
            INSERT INTO banned_guilds (guild_id, guild_name, reason)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET guild_name = excluded.guild_name, reason = excluded.reason
            `,

            [guildId, guildName || null, reason || null]

        );

    }

    static async unban(guildId) {

        await database.run(

            `
            DELETE FROM banned_guilds
            WHERE guild_id = ?
            `,

            [guildId]

        );

    }

    static async isBanned(guildId) {

        const row = await database.get(

            `
            SELECT 1
            FROM banned_guilds
            WHERE guild_id = ?
            `,

            [guildId]

        );

        return !!row;

    }

    static async list() {

        return database.all(

            `
            SELECT *
            FROM banned_guilds
            ORDER BY banned_at DESC
            `

        );

    }

}

module.exports = BannedGuildRepository;
