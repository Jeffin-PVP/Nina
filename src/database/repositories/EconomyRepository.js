const database = require("../database");

class EconomyRepository {

    /*
    =====================================
    OBTÉM OU CRIA O USUÁRIO
    =====================================
    */

    static async getUser(
        guildId,
        userId
    ) {

        let user = await database.get(

            `
            SELECT *
            FROM economy_users
            WHERE guild_id = ?
            AND user_id = ?
            `,

            [
                guildId,
                userId
            ]

        );

        if (!user) {

            await database.run(

                `
                INSERT INTO economy_users (

                    guild_id,
                    user_id

                )

                VALUES (?, ?)
                `,

                [
                    guildId,
                    userId
                ]

            );

            user = await database.get(

                `
                SELECT *
                FROM economy_users
                WHERE guild_id = ?
                AND user_id = ?
                `,

                [
                    guildId,
                    userId
                ]

            );

        }

        return user;

    }

    /*
    =====================================
    UPDATE GENÉRICO
    =====================================
    */

    static async update(
        guildId,
        userId,
        values
    ) {

        await this.getUser(
            guildId,
            userId
        );

        const keys =
            Object.keys(values);

        if (!keys.length)
            return;

        const fields = keys
            .map(key => `${key} = ?`)
            .join(", ");

        const params = [

            ...keys.map(
                key => values[key]
            ),

            guildId,
            userId

        ];

        await database.run(

            `
            UPDATE economy_users
            SET ${fields}
            WHERE guild_id = ?
            AND user_id = ?
            `,

            params

        );

    }

    /*
    =====================================
    CARTEIRA
    =====================================
    */

    static async getWallet(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.wallet;

    }

    static async setWallet(
        guildId,
        userId,
        amount
    ) {

        await this.update(

            guildId,

            userId,

            {
                wallet: amount
            }

        );

    }

    static async addWallet(
        guildId,
        userId,
        amount
    ) {

        const wallet =
            await this.getWallet(
                guildId,
                userId
            );

        await this.setWallet(

            guildId,

            userId,

            wallet + amount

        );

    }

    static async removeWallet(
        guildId,
        userId,
        amount
    ) {

        const wallet =
            await this.getWallet(
                guildId,
                userId
            );

        await this.setWallet(

            guildId,

            userId,

            Math.max(
                0,
                wallet - amount
            )

        );

    }

    /*
    =====================================
    BANCO
    =====================================
    */

    static async getBank(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.bank;

    }

    static async setBank(
        guildId,
        userId,
        amount
    ) {

        await this.update(

            guildId,

            userId,

            {
                bank: amount
            }

        );

    }

    static async addBank(
        guildId,
        userId,
        amount
    ) {

        const bank =
            await this.getBank(
                guildId,
                userId
            );

        await this.setBank(

            guildId,

            userId,

            bank + amount

        );

    }

    static async removeBank(
        guildId,
        userId,
        amount
    ) {

        const bank =
            await this.getBank(
                guildId,
                userId
            );

        await this.setBank(

            guildId,

            userId,

            Math.max(
                0,
                bank - amount
            )

        );

    }
    /*
=====================================
DAILY
=====================================
*/

    static async getDaily(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.daily_at || 0;

    }

    static async setDaily(
        guildId,
        userId,
        timestamp
    ) {

        await this.update(

            guildId,

            userId,

            {

                daily_at: timestamp

            }

        );

    }

    /*
    =====================================
    WORK
    =====================================
    */

    static async getWork(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.work_at || 0;

    }

    static async setWork(
        guildId,
        userId,
        timestamp
    ) {

        await this.update(

            guildId,

            userId,

            {

                work_at: timestamp

            }

        );

    }

    /*
    =====================================
    XP
    =====================================
    */

    static async getXP(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.xp;

    }

    static async setXP(
        guildId,
        userId,
        xp
    ) {

        await this.update(

            guildId,

            userId,

            {

                xp

            }

        );

    }

    static async addXP(
        guildId,
        userId,
        amount
    ) {

        const xp =
            await this.getXP(
                guildId,
                userId
            );

        await this.setXP(

            guildId,

            userId,

            xp + amount

        );

    }

    /*
    =====================================
    LEVEL
    =====================================
    */

    static async getLevel(
        guildId,
        userId
    ) {

        const user =
            await this.getUser(
                guildId,
                userId
            );

        return user.level;

    }

    static async setLevel(
        guildId,
        userId,
        level
    ) {

        await this.update(

            guildId,

            userId,

            {

                level

            }

        );

    }

    /*
    =====================================
    TRANSAÇÕES
    =====================================
    */

    static async createTransaction(

        guildId,

        userId,

        type,

        amount,

        reason = null

    ) {

        await database.run(

            `

            INSERT INTO economy_transactions (

                guild_id,

                user_id,

                type,

                amount,

                reason

            )

            VALUES (?, ?, ?, ?, ?)

            `,

            [

                guildId,

                userId,

                type,

                amount,

                reason

            ]

        );

    }

    static async getTransactions(

        guildId,

        userId,

        limit = 20

    ) {

        return database.all(

            `

            SELECT *

            FROM economy_transactions

            WHERE guild_id = ?

            AND user_id = ?

            ORDER BY id DESC

            LIMIT ?

            `,

            [

                guildId,

                userId,

                limit

            ]

        );

    }
    /*
=====================================
VERIFICA SE O USUÁRIO EXISTE
=====================================
*/

    static async hasUser(
        guildId,
        userId
    ) {

        const user = await database.get(

            `
            SELECT 1
            FROM economy_users
            WHERE guild_id = ?
            AND user_id = ?
            `,

            [
                guildId,
                userId
            ]

        );

        return !!user;

    }

    /*
    =====================================
    RESETA O USUÁRIO
    =====================================
    */

    static async resetUser(
        guildId,
        userId
    ) {

        await this.update(

            guildId,

            userId,

            {

                wallet: 0,

                bank: 0,

                xp: 0,

                level: 1,

                daily_at: null,

                work_at: null

            }

        );

    }

    /*
    =====================================
    REMOVE O USUÁRIO
    =====================================
    */

    static async deleteUser(
        guildId,
        userId
    ) {

        await database.run(

            `
            DELETE FROM economy_users
            WHERE guild_id = ?
            AND user_id = ?
            `,

            [
                guildId,
                userId
            ]

        );

    }

    /*
    =====================================
    RANKING
    =====================================
    */

    static async getLeaderboard(
        guildId,
        limit = 10
    ) {

        return database.all(

            `
            SELECT
                *,
                (wallet + bank) AS total
            FROM economy_users
            WHERE guild_id = ?
            ORDER BY total DESC
            LIMIT ?
            `,

            [
                guildId,
                limit
            ]

        );

    }

    /*
=====================================
TRANSFERÊNCIA
=====================================
*/

    static async transfer(
        guildId,
        fromUserId,
        toUserId,
        amount
    ) {

        // Garante que ambos existam
        await this.getUser(
            guildId,
            fromUserId
        );

        await this.getUser(
            guildId,
            toUserId
        );

        const sender =
            await this.getUser(
                guildId,
                fromUserId
            );

        if (sender.wallet < amount) {

            return false;

        }

        // Remove do remetente
        await this.removeWallet(

            guildId,

            fromUserId,

            amount

        );

        // Adiciona ao destinatário
        await this.addWallet(

            guildId,

            toUserId,

            amount

        );

        // Histórico
        await this.addTransaction(

            guildId,

            fromUserId,

            -amount,

            "PAY",

            `Transferência para ${toUserId}`

        );

        await this.addTransaction(

            guildId,

            toUserId,

            amount,

            "PAY",

            `Recebido de ${fromUserId}`

        );

        return true;

    }

    /*
=====================================
TRANSAÇÕES
=====================================
*/

    static async addTransaction(
        guildId,
        userId,
        amount,
        type,
        description = null
    ) {

        await database.run(

            `
        INSERT INTO economy_transactions (

            guild_id,

            user_id,

            amount,

            type,

            description

        )
        VALUES (?, ?, ?, ?, ?)
        `,

            [

                guildId,

                userId,

                amount,

                type,

                description

            ]

        );

    }

}

module.exports = EconomyRepository;