const database = require("../database");

// A moeda é global; XP e nível continuam separados por servidor em economy_users.
class EconomyRepository {
    static async ensureGlobalUser(userId) {
        await database.run(
            `INSERT OR IGNORE INTO economy_global_users (user_id) VALUES (?)`,
            [userId]
        );
    }

    static async getUser(guildId, userId) {
        await database.run(
            `INSERT OR IGNORE INTO economy_users (guild_id, user_id) VALUES (?, ?)`,
            [guildId, userId]
        );
        await this.ensureGlobalUser(userId);

        const local = await database.get(
            `SELECT * FROM economy_users WHERE guild_id = ? AND user_id = ?`,
            [guildId, userId]
        );
        const global = await database.get(
            `SELECT wallet, bank, daily_at, work_at, created_at FROM economy_global_users WHERE user_id = ?`,
            [userId]
        );
        return { ...local, wallet: global.wallet, bank: global.bank,
            daily_at: global.daily_at, work_at: global.work_at };
    }

    static async update(guildId, userId, values) {
        await this.getUser(guildId, userId);
        const globalFields = ["wallet", "bank", "daily_at", "work_at"];
        const globalValues = Object.fromEntries(Object.entries(values).filter(([key]) => globalFields.includes(key)));
        const localValues = Object.fromEntries(Object.entries(values).filter(([key]) => !globalFields.includes(key)));
        for (const [table, fields, where] of [
            ["economy_global_users", globalValues, "user_id = ?"],
            ["economy_users", localValues, "guild_id = ? AND user_id = ?"]
        ]) {
            const keys = Object.keys(fields);
            if (!keys.length) continue;
            const params = [...keys.map(key => fields[key]), ...(table === "economy_global_users" ? [userId] : [guildId, userId])];
            await database.run(`UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE ${where}`, params);
        }
    }

    static async getWallet(guildId, userId) { return (await this.getUser(guildId, userId)).wallet; }
    static async setWallet(guildId, userId, amount) { return this.update(guildId, userId, { wallet: amount }); }

    static async addWallet(guildId, userId, amount) {
        if (!(amount > 0)) return;
        await this.ensureGlobalUser(userId);
        await database.run(`UPDATE economy_global_users SET wallet = wallet + ? WHERE user_id = ?`, [amount, userId]);
    }

    static async removeWallet(guildId, userId, amount) {
        if (!(amount > 0)) return;
        await this.ensureGlobalUser(userId);
        await database.run(`UPDATE economy_global_users SET wallet = MAX(0, wallet - ?) WHERE user_id = ?`, [amount, userId]);
    }

    static async tryRemoveWallet(guildId, userId, amount) {
        if (!(amount > 0)) return false;
        await this.ensureGlobalUser(userId);
        const result = await database.run(`UPDATE economy_global_users SET wallet = wallet - ? WHERE user_id = ? AND wallet >= ?`, [amount, userId, amount]);
        return result.changes > 0;
    }

    static async tryRemoveBank(guildId, userId, amount) {
        if (!(amount > 0)) return false;
        await this.ensureGlobalUser(userId);
        const result = await database.run(`UPDATE economy_global_users SET bank = bank - ? WHERE user_id = ? AND bank >= ?`, [amount, userId, amount]);
        return result.changes > 0;
    }

    static async tryClaimCooldown(guildId, userId, column, now, cooldownMs) {
        if (column !== "daily_at" && column !== "work_at") throw new TypeError(`Coluna de cooldown inválida: ${column}`);
        await this.ensureGlobalUser(userId);
        const result = await database.run(
            `UPDATE economy_global_users SET ${column} = ? WHERE user_id = ? AND (${column} IS NULL OR ${column} + ? <= ?)`,
            [now, userId, cooldownMs, now]
        );
        return result.changes > 0;
    }

    static async getBank(guildId, userId) { return (await this.getUser(guildId, userId)).bank; }
    static async setBank(guildId, userId, amount) { return this.update(guildId, userId, { bank: amount }); }
    static async addBank(guildId, userId, amount) {
        if (!(amount > 0)) return;
        await this.ensureGlobalUser(userId);
        await database.run(`UPDATE economy_global_users SET bank = bank + ? WHERE user_id = ?`, [amount, userId]);
    }
    static async removeBank(guildId, userId, amount) {
        if (!(amount > 0)) return;
        await this.ensureGlobalUser(userId);
        await database.run(`UPDATE economy_global_users SET bank = MAX(0, bank - ?) WHERE user_id = ?`, [amount, userId]);
    }

    static async getDaily(guildId, userId) { return (await this.getUser(guildId, userId)).daily_at || 0; }
    static async setDaily(guildId, userId, timestamp) { return this.update(guildId, userId, { daily_at: timestamp }); }
    static async getWork(guildId, userId) { return (await this.getUser(guildId, userId)).work_at || 0; }
    static async setWork(guildId, userId, timestamp) { return this.update(guildId, userId, { work_at: timestamp }); }

    static async getXP(guildId, userId) { return (await this.getUser(guildId, userId)).xp; }
    static async setXP(guildId, userId, xp) { return this.update(guildId, userId, { xp }); }
    static async addXP(guildId, userId, amount) {
        await this.getUser(guildId, userId);
        await database.run(`UPDATE economy_users SET xp = xp + ? WHERE guild_id = ? AND user_id = ?`, [amount, guildId, userId]);
    }
    static async getLevel(guildId, userId) { return (await this.getUser(guildId, userId)).level; }
    static async setLevel(guildId, userId, level) { return this.update(guildId, userId, { level }); }

    static async createTransaction(guildId, userId, type, amount, reason = null) {
        return this.addTransaction("GLOBAL", userId, amount, type, reason);
    }
    static async addTransaction(guildId, userId, amount, type, description = null) {
        await database.run(`INSERT INTO economy_transactions (guild_id, user_id, amount, type, description) VALUES ('GLOBAL', ?, ?, ?, ?)`, [userId, amount, type, description]);
    }
    static async getTransactions(guildId, userId, limit = 20) {
        return database.all(`SELECT * FROM economy_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?`, [userId, limit]);
    }
    static async hasUser(guildId, userId) {
        return !!(await database.get(`SELECT 1 FROM economy_global_users WHERE user_id = ?`, [userId]));
    }
    static async resetUser(guildId, userId) {
        await this.update(guildId, userId, { wallet: 0, bank: 0, xp: 0, level: 1, daily_at: null, work_at: null });
    }
    static async deleteUser(guildId, userId) {
        await database.run(`DELETE FROM economy_global_users WHERE user_id = ?`, [userId]);
        await database.run(`DELETE FROM economy_users WHERE user_id = ?`, [userId]);
    }
    static async getLeaderboard(guildId, limit = 10) {
        return database.all(`SELECT user_id, wallet, bank, (wallet + bank) AS total FROM economy_global_users ORDER BY total DESC LIMIT ?`, [limit]);
    }

    static async transfer(guildId, fromUserId, toUserId, amount) {
        if (!Number.isSafeInteger(amount) || amount <= 0 || fromUserId === toUserId) return false;
        await this.ensureGlobalUser(fromUserId);
        await this.ensureGlobalUser(toUserId);

        // Transação SQLite única: nunca debita sem creditar, nem duplica transferências.
        const db = database.db;
        db.exec("BEGIN IMMEDIATE");
        try {
            const debit = db.prepare(
                `UPDATE economy_global_users SET wallet = wallet - ? WHERE user_id = ? AND wallet >= ?`
            ).run(amount, fromUserId, amount);
            if (Number(debit.changes) !== 1) {
                db.exec("ROLLBACK");
                return false;
            }
            db.prepare(`UPDATE economy_global_users SET wallet = wallet + ? WHERE user_id = ?`).run(amount, toUserId);
            db.prepare(`INSERT INTO economy_transactions (guild_id, user_id, amount, type, description) VALUES ('GLOBAL', ?, ?, 'PAY', ?)`)
                .run(fromUserId, -amount, `Transferência para ${toUserId}`);
            db.prepare(`INSERT INTO economy_transactions (guild_id, user_id, amount, type, description) VALUES ('GLOBAL', ?, ?, 'PAY', ?)`)
                .run(toUserId, amount, `Recebido de ${fromUserId}`);
            db.exec("COMMIT");
            return true;
        } catch (error) {
            try { db.exec("ROLLBACK"); } catch {}
            throw error;
        }
    }
}

module.exports = EconomyRepository;
