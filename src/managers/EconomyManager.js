const EconomyRepository =
    require("../database/repositories/EconomyRepository");

class EconomyManager {

    /*
    =========================
        OBTÉM DADOS
    =========================
    */

    static async getProfile(
        guildId,
        userId
    ) {

        const user =
            await EconomyRepository.getUser(
                guildId,
                userId
            );

        return {

            wallet: user.wallet,

            // Compatibilidade
            coins: user.wallet,

            bank: user.bank,

            total:
                user.wallet +
                user.bank,

            xp: user.xp,

            level: user.level,

            daily_at: user.daily_at,

            work_at: user.work_at,

            dailyAt: user.daily_at,

            workAt: user.work_at

        };

    }

    /*
    =========================
        CARTEIRA
    =========================
    */

    static async addMoney(
        guildId,
        userId,
        amount
    ) {

        if (amount <= 0)
            return false;

        await EconomyRepository.addWallet(

            guildId,
            userId,
            amount

        );

        return true;

    }

    static async removeMoney(
        guildId,
        userId,
        amount
    ) {

        const user =
            await EconomyRepository.getUser(
                guildId,
                userId
            );

        if (user.wallet < amount) {

            return false;

        }

        await EconomyRepository.removeWallet(

            guildId,
            userId,
            amount

        );

        return true;

    }

    /*
    =========================
        ALIASES (Compatibilidade)
    =========================
    */

    static async addCoins(
        guildId,
        userId,
        amount
    ) {

        return this.addMoney(
            guildId,
            userId,
            amount
        );

    }

    static async removeCoins(
        guildId,
        userId,
        amount
    ) {

        return this.removeMoney(
            guildId,
            userId,
            amount
        );

    }

    /*
    =========================
        BANCO
    =========================
    */

    static async deposit(
        guildId,
        userId,
        amount
    ) {

        const user =
            await EconomyRepository.getUser(
                guildId,
                userId
            );

        if (

            amount <= 0 ||

            user.wallet < amount

        ) {

            return false;

        }

        await EconomyRepository.removeWallet(

            guildId,
            userId,
            amount

        );

        await EconomyRepository.addBank(

            guildId,
            userId,
            amount

        );

        return true;

    }

    static async withdraw(
        guildId,
        userId,
        amount
    ) {

        const user =
            await EconomyRepository.getUser(
                guildId,
                userId
            );

        if (

            amount <= 0 ||

            user.bank < amount

        ) {

            return false;

        }

        await EconomyRepository.removeBank(

            guildId,
            userId,
            amount

        );

        await EconomyRepository.addWallet(

            guildId,
            userId,
            amount

        );

        return true;

    }

    /*
    =========================
        DAILY
    =========================
    */

    static DAILY_COOLDOWN =
        24 * 60 * 60 * 1000;

    static DAILY_REWARD = 500;

    static async canClaimDaily(
        guildId,
        userId
    ) {

        const last =
            await EconomyRepository.getDaily(

                guildId,
                userId

            );

        if (!last) {

            return {

                available: true,

                remaining: 0

            };

        }

        const now = Date.now();

        const remaining =

            this.DAILY_COOLDOWN -

            (now - last);

        return {

            available:
                remaining <= 0,

            remaining:
                Math.max(
                    remaining,
                    0
                )

        };

    }

    static async claimDaily(
        guildId,
        userId
    ) {

        const check =
            await this.canClaimDaily(

                guildId,
                userId

            );

        if (!check.available) {

            return {

                success: false,

                remaining:
                    check.remaining

            };

        }

        await EconomyRepository.addWallet(

            guildId,
            userId,

            this.DAILY_REWARD

        );

        await EconomyRepository.setDaily(

            guildId,
            userId,

            Date.now()

        );

        const profile =
            await this.getProfile(

                guildId,
                userId

            );

        return {

            success: true,

            reward:
                this.DAILY_REWARD,

            wallet:
                profile.wallet,

            bank:
                profile.bank,

            total:
                profile.total

        };

    }

    /*
    =========================
        UPDATE DAILY
    =========================
    */

    static async updateDaily(
        guildId,
        userId,
        timestamp
    ) {

        await EconomyRepository.setDaily(

            guildId,
            userId,
            timestamp

        );

    }

    /*
    =========================
        UPDATE WORK
    =========================
    */

    static async updateWork(
        guildId,
        userId,
        timestamp
    ) {

        await EconomyRepository.setWork(

            guildId,
            userId,
            timestamp

        );

    }

    /*
=========================
    PAGAMENTO
=========================
*/

    static async pay(
        guildId,
        fromUserId,
        toUserId,
        amount
    ) {

        if (amount <= 0) {

            return {

                success: false,

                reason: "invalid_amount"

            };

        }

        if (fromUserId === toUserId) {

            return {

                success: false,

                reason: "same_user"

            };

        }

        const sender =
            await EconomyRepository.getUser(

                guildId,

                fromUserId

            );

        if (sender.wallet < amount) {

            return {

                success: false,

                reason: "insufficient_funds",

                wallet: sender.wallet

            };

        }

        const transferred =
            await EconomyRepository.transfer(

                guildId,

                fromUserId,

                toUserId,

                amount

            );

        if (!transferred) {

            return {

                success: false,

                reason: "transfer_failed"

            };

        }

        const senderUpdated =
            await this.getProfile(

                guildId,

                fromUserId

            );

        const receiverUpdated =
            await this.getProfile(

                guildId,

                toUserId

            );

        return {

            success: true,

            amount,

            sender: senderUpdated,

            receiver: receiverUpdated

        };

    }

    /*
=========================
    LEADERBOARD
=========================
*/

    static async getLeaderboard(
        guildId,
        limit = 10
    ) {

        return await EconomyRepository.getLeaderboard(

            guildId,

            limit

        );

    }

}

module.exports = EconomyManager;