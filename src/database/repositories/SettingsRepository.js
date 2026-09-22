const database = require("../database");

class SettingsRepository {

    /*
    =========================
        PRESENÇA / STATUS
    =========================
    */

    static async listPresence() {

        return database.all(

            `
            SELECT *
            FROM bot_presence
            ORDER BY position ASC, id ASC
            `

        );

    }

    static async addPresence({ type, text }) {

        const row = await database.get(

            `
            SELECT COALESCE(MAX(position), -1) AS maxPos
            FROM bot_presence
            `

        );

        const result = await database.run(

            `
            INSERT INTO bot_presence (type, text, position)
            VALUES (?, ?, ?)
            `,

            [type, text, (row?.maxPos ?? -1) + 1]

        );

        return result.lastID;

    }

    static async removePresence(id) {

        await database.run(

            `
            DELETE FROM bot_presence
            WHERE id = ?
            `,

            [id]

        );

    }

    static async replaceAllPresence(lista) {

        await database.run(`DELETE FROM bot_presence`);

        let position = 0;

        for (const item of lista) {

            await database.run(

                `
                INSERT INTO bot_presence (type, text, position)
                VALUES (?, ?, ?)
                `,

                [item.type, item.text, position]

            );

            position++;

        }

    }

    /*
    =========================
        CONFIGURAÇÕES GENÉRICAS (key/value)
    =========================
    */

    static async get(key, fallback = null) {

        const row = await database.get(

            `
            SELECT value
            FROM bot_settings
            WHERE key = ?
            `,

            [key]

        );

        return row ? row.value : fallback;

    }

    static async set(key, value) {

        await database.run(

            `
            INSERT INTO bot_settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `,

            [key, value]

        );

    }

}

module.exports = SettingsRepository;
