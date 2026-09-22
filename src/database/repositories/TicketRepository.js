const database = require("../database");

class TicketRepository {

    /*
    =========================
        CONFIGURAÇÃO
    =========================
    */

    static async getConfig(guildId) {

        let config = await database.get(

            `
            SELECT *
            FROM ticket_config
            WHERE guild_id = ?
            `,

            [guildId]

        );

        if (!config) {

            await database.run(

                `
                INSERT INTO ticket_config (guild_id)
                VALUES (?)
                `,

                [guildId]

            );

            config = await database.get(

                `
                SELECT *
                FROM ticket_config
                WHERE guild_id = ?
                `,

                [guildId]

            );

        }

        return config;

    }

    static async setConfig(guildId, values) {

        await this.getConfig(guildId);

        const keys = Object.keys(values);

        if (!keys.length) return;

        const fields = keys
            .map(key => `${key} = ?`)
            .join(", ");

        const params = [
            ...keys.map(key => values[key]),
            guildId
        ];

        await database.run(

            `
            UPDATE ticket_config
            SET ${fields}
            WHERE guild_id = ?
            `,

            params

        );

    }

    static async isEnabled(guildId) {

        const config = await this.getConfig(guildId);

        return Boolean(config.enabled) &&
            !!config.parent_channel_id;

    }

    /*
    =========================
        NUMERAÇÃO
    =========================
    */

    static async nextNumber(guildId) {

        const config = await this.getConfig(guildId);

        const number = config.next_number || 1;

        await database.run(

            `
            UPDATE ticket_config
            SET next_number = ?
            WHERE guild_id = ?
            `,

            [number + 1, guildId]

        );

        return number;

    }

    /*
    =========================
        CRIAR TICKET
    =========================
    */

    static async createTicket({
        guildId,
        number,
        threadId,
        parentChannelId,
        userId
    }) {

        await database.run(

            `
            INSERT INTO tickets (
                guild_id,
                number,
                thread_id,
                parent_channel_id,
                user_id
            )
            VALUES (?, ?, ?, ?, ?)
            `,

            [guildId, number, threadId, parentChannelId, userId]

        );

        return this.getByThread(threadId);

    }

    /*
    =========================
        CONSULTAS
    =========================
    */

    static async getByThread(threadId) {

        return database.get(

            `
            SELECT *
            FROM tickets
            WHERE thread_id = ?
            `,

            [threadId]

        );

    }

    static async getOpenByUser(guildId, userId) {

        return database.get(

            `
            SELECT *
            FROM tickets
            WHERE guild_id = ?
              AND user_id = ?
              AND status = 'open'
            `,

            [guildId, userId]

        );

    }

    static async listOpen(guildId) {

        return database.all(

            `
            SELECT *
            FROM tickets
            WHERE guild_id = ?
              AND status = 'open'
            ORDER BY number ASC
            `,

            [guildId]

        );

    }

    /*
    =========================
        AÇÕES
    =========================
    */

    static async claim(threadId, moderatorId) {

        await database.run(

            `
            UPDATE tickets
            SET claimed_by = ?
            WHERE thread_id = ?
            `,

            [moderatorId, threadId]

        );

    }

    static async close(threadId, closedBy) {

        await database.run(

            `
            UPDATE tickets
            SET status = 'closed',
                closed_at = CURRENT_TIMESTAMP,
                closed_by = ?
            WHERE thread_id = ?
            `,

            [closedBy, threadId]

        );

    }

    static async reopen(threadId) {

        await database.run(

            `
            UPDATE tickets
            SET status = 'open',
                closed_at = NULL,
                closed_by = NULL
            WHERE thread_id = ?
            `,

            [threadId]

        );

    }

    static async remove(threadId) {

        await database.run(

            `
            DELETE FROM tickets
            WHERE thread_id = ?
            `,

            [threadId]

        );

    }

}

module.exports = TicketRepository;
