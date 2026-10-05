const database = require("../database");

class GiveawayRepository {

    /*
    =========================
        CRIAÇÃO
    =========================
    */

    static async create({
        guildId,
        channelId,
        hostId,
        prize,
        winnersCount,
        requiredRoleId,
        endsAt
    }) {

        const result = await database.run(

            `
            INSERT INTO giveaways (
                guild_id, channel_id, host_id, prize,
                winners_count, required_role_id, ends_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,

            [
                guildId,
                channelId,
                hostId,
                prize,
                winnersCount,
                requiredRoleId || null,
                endsAt
            ]

        );

        return result.lastID;

    }

    static async setMessageId(id, messageId) {

        await database.run(

            `
            UPDATE giveaways
            SET message_id = ?
            WHERE id = ?
            `,

            [messageId, id]

        );

    }

    /*
    =========================
        CONSULTAS
    =========================
    */

    static async get(id) {

        return database.get(

            `
            SELECT *
            FROM giveaways
            WHERE id = ?
            `,

            [id]

        );

    }

    static async getByMessageId(messageId) {

        return database.get(

            `
            SELECT *
            FROM giveaways
            WHERE message_id = ?
            `,

            [messageId]

        );

    }

    static async listRunningByGuild(guildId) {

        return database.all(

            `
            SELECT *
            FROM giveaways
            WHERE guild_id = ? AND status = 'running'
            ORDER BY ends_at ASC
            `,

            [guildId]

        );

    }

    static async listDue(now) {

        return database.all(

            `
            SELECT *
            FROM giveaways
            WHERE status = 'running' AND ends_at <= ?
            `,

            [now]

        );

    }

    /*
    =========================
        STATUS
    =========================
    */

    static async setStatus(id, status) {

        await database.run(

            `
            UPDATE giveaways
            SET status = ?
            WHERE id = ?
            `,

            [status, id]

        );

    }

    // Atualiza só os campos passados (prêmio, vencedores e/ou prazo)
    static async update(id, { prize, winnersCount, endsAt }) {

        const campos = [];
        const valores = [];

        if (prize !== undefined) { campos.push("prize = ?"); valores.push(prize); }
        if (winnersCount !== undefined) { campos.push("winners_count = ?"); valores.push(winnersCount); }
        if (endsAt !== undefined) { campos.push("ends_at = ?"); valores.push(endsAt); }

        if (!campos.length) return;

        valores.push(id);

        await database.run(

            `
            UPDATE giveaways
            SET ${campos.join(", ")}
            WHERE id = ?
            `,

            valores

        );

    }

    /*
    =========================
        MULTIPLICADORES DE ENTRADA
    =========================
    */

    static async addMultiplier(guildId, roleId, multiplier) {

        await database.run(

            `
            INSERT INTO giveaway_multipliers (guild_id, role_id, multiplier)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, role_id) DO UPDATE SET multiplier = excluded.multiplier
            `,

            [guildId, roleId, multiplier]

        );

    }

    static async removeMultiplier(guildId, roleId) {

        await database.run(

            `
            DELETE FROM giveaway_multipliers
            WHERE guild_id = ? AND role_id = ?
            `,

            [guildId, roleId]

        );

    }

    static async listMultipliers(guildId) {

        return database.all(

            `
            SELECT *
            FROM giveaway_multipliers
            WHERE guild_id = ?
            `,

            [guildId]

        );

    }

    /*
    =========================
        PARTICIPAÇÕES
    =========================
    */

    static async addEntry(giveawayId, userId) {

        await database.run(

            `
            INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id)
            VALUES (?, ?)
            `,

            [giveawayId, userId]

        );

    }

    static async removeEntry(giveawayId, userId) {

        await database.run(

            `
            DELETE FROM giveaway_entries
            WHERE giveaway_id = ? AND user_id = ?
            `,

            [giveawayId, userId]

        );

    }

    static async hasEntry(giveawayId, userId) {

        const row = await database.get(

            `
            SELECT 1
            FROM giveaway_entries
            WHERE giveaway_id = ? AND user_id = ?
            `,

            [giveawayId, userId]

        );

        return !!row;

    }

    static async countEntries(giveawayId) {

        const row = await database.get(

            `
            SELECT COUNT(*) AS total
            FROM giveaway_entries
            WHERE giveaway_id = ?
            `,

            [giveawayId]

        );

        return row?.total || 0;

    }

    static async listEntries(giveawayId) {

        const rows = await database.all(

            `
            SELECT user_id
            FROM giveaway_entries
            WHERE giveaway_id = ?
            `,

            [giveawayId]

        );

        return rows.map(row => row.user_id);

    }

}

module.exports = GiveawayRepository;
