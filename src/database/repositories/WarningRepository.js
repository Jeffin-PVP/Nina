const database = require("../database");


class WarningRepository {


    static async create({

        guildId,

        userId,

        moderatorId,

        reason

    }) {


        const result = await database.run(`

            INSERT INTO warnings
            (
                guild_id,
                user_id,
                moderator_id,
                reason
            )

            VALUES
            (
                ?,
                ?,
                ?,
                ?
            )

        `, [

            guildId,

            userId,

            moderatorId,

            reason

        ]);


        return result.lastID;

    }



    static async getUserWarnings({

        guildId,

        userId

    }) {


        return await database.all(`

            SELECT *

            FROM warnings

            WHERE guild_id = ?

            AND user_id = ?

            ORDER BY created_at DESC

        `, [

            guildId,

            userId

        ]);

    }



    static async count({

        guildId,

        userId

    }) {


        const result = await database.get(`

            SELECT COUNT(*) AS total

            FROM warnings

            WHERE guild_id = ?

            AND user_id = ?

        `, [

            guildId,

            userId

        ]);


        return result.total;

    }



    static async getById(id) {


        return await database.get(`

            SELECT *

            FROM warnings

            WHERE id = ?

        `, [

            id

        ]);

    }



    static async delete(id) {


        await database.run(`

            DELETE FROM warnings

            WHERE id = ?

        `, [

            id

        ]);


    }


}


module.exports = WarningRepository;