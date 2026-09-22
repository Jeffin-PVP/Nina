const database = require("../database");

class AutoroleRepository {

    /*
    =========================
        CARGO DE ENTRADA
    =========================
    */

    static async getJoinRoles(guildId) {

        const row = await database.get(

            `
            SELECT role_ids
            FROM autorole_join
            WHERE guild_id = ?
            `,

            [guildId]

        );

        if (!row || !row.role_ids) return [];

        return row.role_ids.split(",").filter(Boolean);

    }

    static async addJoinRole(guildId, roleId) {

        const current = await this.getJoinRoles(guildId);

        if (current.includes(roleId)) return current;

        const updated = [...current, roleId];

        await database.run(

            `
            INSERT INTO autorole_join (guild_id, role_ids)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET role_ids = excluded.role_ids
            `,

            [guildId, updated.join(",")]

        );

        return updated;

    }

    static async removeJoinRole(guildId, roleId) {

        const current = await this.getJoinRoles(guildId);
        const updated = current.filter(id => id !== roleId);

        await database.run(

            `
            INSERT INTO autorole_join (guild_id, role_ids)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET role_ids = excluded.role_ids
            `,

            [guildId, updated.join(",")]

        );

        return updated;

    }

    /*
    =========================
        SELF-ROLE
    =========================
    */

    static async listSelfRoles(guildId) {

        return database.all(

            `
            SELECT *
            FROM autorole_selfroles
            WHERE guild_id = ?
            ORDER BY id ASC
            `,

            [guildId]

        );

    }

    static async addSelfRole(guildId, roleId, label, emoji) {

        await database.run(

            `
            INSERT INTO autorole_selfroles (guild_id, role_id, label, emoji)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, role_id) DO UPDATE SET
                label = excluded.label,
                emoji = excluded.emoji
            `,

            [guildId, roleId, label, emoji ?? null]

        );

    }

    static async removeSelfRole(guildId, roleId) {

        await database.run(

            `
            DELETE FROM autorole_selfroles
            WHERE guild_id = ? AND role_id = ?
            `,

            [guildId, roleId]

        );

    }

    /*
    =========================
        NÍVEIS
    =========================
    */

    static async listLevelRoles(guildId) {

        return database.all(

            `
            SELECT *
            FROM autorole_levels
            WHERE guild_id = ?
            ORDER BY level ASC
            `,

            [guildId]

        );

    }

    static async setLevelRole(guildId, level, roleId) {

        await database.run(

            `
            INSERT INTO autorole_levels (guild_id, level, role_id)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
            `,

            [guildId, level, roleId]

        );

    }

    static async removeLevelRole(guildId, level) {

        await database.run(

            `
            DELETE FROM autorole_levels
            WHERE guild_id = ? AND level = ?
            `,

            [guildId, level]

        );

    }

}

module.exports = AutoroleRepository;
