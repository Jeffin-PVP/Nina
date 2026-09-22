const database = require("../database");

class StatsHistoryRepository {

    static async recordSnapshot(date, servers, members) {

        await database.run(

            `
            INSERT INTO bot_stats_history (date, servers, members)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE servers = VALUES(servers), members = VALUES(members)
            `,

            [date, servers, members]

        );

    }

    static async listLast(days = 30) {

        return database.all(

            `
            SELECT *
            FROM bot_stats_history
            ORDER BY date DESC
            LIMIT ?
            `,

            [days]

        );

    }

}

module.exports = StatsHistoryRepository;
