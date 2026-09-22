const database = require("../database");

class BroadcastRepository {

    static async log({ title, description, color, kind, sentCount, failedCount }) {

        await database.run(

            `
            INSERT INTO broadcasts (title, description, color, kind, sent_count, failed_count)
            VALUES (?, ?, ?, ?, ?, ?)
            `,

            [title || null, description, color || null, kind || "broadcast", sentCount, failedCount]

        );

    }

    static async listRecent(limit = 20) {

        return database.all(

            `
            SELECT *
            FROM broadcasts
            ORDER BY id DESC
            LIMIT ?
            `,

            [limit]

        );

    }

}

module.exports = BroadcastRepository;
