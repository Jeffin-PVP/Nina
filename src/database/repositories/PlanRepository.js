const database = require("../database");

/*
=========================
    PLANOS — ACESSO AO BANCO
=========================
Só SQL aqui. As regras (quem pode o quê) ficam no PlanManager.
*/

class PlanRepository {

    /* ---------- chave geral (bot_settings) ---------- */

    static async getSetting(key) {
        const row = await database.get(`SELECT value FROM bot_settings WHERE key = ?`, [key]);
        return row?.value ?? null;
    }

    static async setSetting(key, value) {
        await database.run(
            `INSERT INTO bot_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, String(value)]
        );
    }

    /* ---------- assinatura ---------- */

    static async getSubscription(guildId) {
        return database.get(`SELECT * FROM guild_subscriptions WHERE guild_id = ?`, [guildId]);
    }

    static async upsertSubscription({ guildId, plan, source, startedAt, expiresAt, grantedBy, note }) {
        const now = Date.now();
        await database.run(
            `INSERT INTO guild_subscriptions
                (guild_id, plan, status, source, started_at, expires_at, granted_by, note, warned_at, updated_at)
             VALUES (?, ?, 'active', ?, ?, ?, ?, ?, NULL, ?)
             ON CONFLICT(guild_id) DO UPDATE SET
                plan = excluded.plan,
                status = 'active',
                source = excluded.source,
                started_at = excluded.started_at,
                expires_at = excluded.expires_at,
                granted_by = excluded.granted_by,
                note = excluded.note,
                warned_at = NULL,
                updated_at = excluded.updated_at`,
            [guildId, plan, source, startedAt ?? now, expiresAt ?? null, grantedBy ?? null, note ?? null, now]
        );
    }

    static async setStatus(guildId, status) {
        await database.run(
            `UPDATE guild_subscriptions SET status = ?, updated_at = ? WHERE guild_id = ?`,
            [status, Date.now(), guildId]
        );
    }

    static async deleteSubscription(guildId) {
        await database.run(`DELETE FROM guild_subscriptions WHERE guild_id = ?`, [guildId]);
    }

    static async markWarned(guildId) {
        await database.run(`UPDATE guild_subscriptions SET warned_at = ? WHERE guild_id = ?`, [Date.now(), guildId]);
    }

    static async listSubscriptions({ status = null, plan = null, limit = 200 } = {}) {
        const where = [];
        const params = [];
        if (status) { where.push("status = ?"); params.push(status); }
        if (plan) { where.push("plan = ?"); params.push(plan); }
        params.push(Math.min(Math.max(Number(limit) || 200, 1), 1000));
        return database.all(
            `SELECT * FROM guild_subscriptions
             ${where.length ? "WHERE " + where.join(" AND ") : ""}
             ORDER BY updated_at DESC LIMIT ?`,
            params
        );
    }

    /** Assinaturas ativas com vencimento até `ts` (para expirar / avisar). */
    static async listExpiringBefore(ts) {
        return database.all(
            `SELECT * FROM guild_subscriptions
             WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?`,
            [ts]
        );
    }

    static async countByPlan() {
        return database.all(
            `SELECT plan, COUNT(*) AS total FROM guild_subscriptions WHERE status = 'active' GROUP BY plan`
        );
    }

    /* ---------- auditoria ---------- */

    static async addEvent({ guildId, action, plan = null, source = null, actor = null, details = null }) {
        await database.run(
            `INSERT INTO subscription_events (guild_id, action, plan, source, actor, details, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [guildId, action, plan, source, actor, details ? String(details).slice(0, 500) : null, Date.now()]
        );
    }

    static async listEvents(guildId = null, limit = 50) {
        const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
        if (guildId) {
            return database.all(
                `SELECT * FROM subscription_events WHERE guild_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
                [guildId, n]
            );
        }
        return database.all(`SELECT * FROM subscription_events ORDER BY created_at DESC, id DESC LIMIT ?`, [n]);
    }

    /* ---------- overrides ---------- */

    static async getOverrides(guildId) {
        const rows = await database.all(`SELECT key, value FROM plan_overrides WHERE guild_id = ?`, [guildId]);
        const out = {};
        for (const row of rows) {
            try { out[row.key] = JSON.parse(row.value); } catch { /* ignora linha corrompida */ }
        }
        return out;
    }

    static async setOverride(guildId, key, value) {
        await database.run(
            `INSERT INTO plan_overrides (guild_id, key, value) VALUES (?, ?, ?)
             ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value`,
            [guildId, key, JSON.stringify(value)]
        );
    }

    static async removeOverride(guildId, key) {
        await database.run(`DELETE FROM plan_overrides WHERE guild_id = ? AND key = ?`, [guildId, key]);
    }

    /* ---------- códigos ---------- */

    static async createCode({ code, plan, durationDays, maxUses, expiresAt, note, createdBy }) {
        await database.run(
            `INSERT INTO redeem_codes (code, plan, duration_days, max_uses, expires_at, note, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, plan, durationDays ?? null, maxUses, expiresAt ?? null, note ?? null, createdBy ?? null, Date.now()]
        );
    }

    static async getCode(code) {
        return database.get(`SELECT * FROM redeem_codes WHERE code = ?`, [code]);
    }

    static async listCodes(limit = 100) {
        return database.all(
            `SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT ?`,
            [Math.min(Math.max(Number(limit) || 100, 1), 500)]
        );
    }

    static async revokeCode(code) {
        const r = await database.run(`UPDATE redeem_codes SET revoked = 1 WHERE code = ?`, [code]);
        return r.changes > 0;
    }

    /**
     * Consome 1 uso do código de forma atômica (um único UPDATE condicional),
     * então dois resgates simultâneos nunca passam do max_uses.
     */
    static async consumeCodeUse(code, now = Date.now()) {
        const r = await database.run(
            `UPDATE redeem_codes SET uses = uses + 1
             WHERE code = ? AND revoked = 0 AND uses < max_uses
               AND (expires_at IS NULL OR expires_at > ?)`,
            [code, now]
        );
        return r.changes > 0;
    }

    static async refundCodeUse(code) {
        await database.run(`UPDATE redeem_codes SET uses = MAX(uses - 1, 0) WHERE code = ?`, [code]);
    }

    static async addCodeUse(code, guildId, userId) {
        await database.run(
            `INSERT INTO redeem_code_uses (code, guild_id, user_id, used_at) VALUES (?, ?, ?, ?)`,
            [code, guildId, userId, Date.now()]
        );
    }

    static async guildUsedCode(code, guildId) {
        const row = await database.get(
            `SELECT 1 AS ok FROM redeem_code_uses WHERE code = ? AND guild_id = ?`,
            [code, guildId]
        );
        return Boolean(row);
    }

    /* ---------- cotas mensais ---------- */

    static async getUsage(guildId, key, period) {
        const row = await database.get(
            `SELECT count FROM plan_usage WHERE guild_id = ? AND key = ? AND period = ?`,
            [guildId, key, period]
        );
        return Number(row?.count || 0);
    }

    /**
     * Soma `amount` ao contador se (atual + amount) <= max. Atômico num único UPDATE/INSERT.
     * Retorna { allowed, used }.
     */
    static async consumeUsage(guildId, key, period, amount, max) {
        if (!Number.isFinite(max)) {
            await database.run(
                `INSERT INTO plan_usage (guild_id, key, period, count) VALUES (?, ?, ?, ?)
                 ON CONFLICT(guild_id, key, period) DO UPDATE SET count = count + excluded.count`,
                [guildId, key, period, amount]
            );
            return { allowed: true, used: await this.getUsage(guildId, key, period) };
        }

        await database.run(
            `INSERT OR IGNORE INTO plan_usage (guild_id, key, period, count) VALUES (?, ?, ?, 0)`,
            [guildId, key, period]
        );
        const r = await database.run(
            `UPDATE plan_usage SET count = count + ?
             WHERE guild_id = ? AND key = ? AND period = ? AND count + ? <= ?`,
            [amount, guildId, key, period, amount, max]
        );
        return { allowed: r.changes > 0, used: await this.getUsage(guildId, key, period) };
    }

    static async refundUsage(guildId, key, period, amount) {
        await database.run(
            `UPDATE plan_usage SET count = MAX(count - ?, 0) WHERE guild_id = ? AND key = ? AND period = ?`,
            [amount, guildId, key, period]
        );
    }

    /** Limpa contadores de meses antigos. */
    static async pruneUsage(keepFromPeriod) {
        await database.run(`DELETE FROM plan_usage WHERE period < ?`, [keepFromPeriod]);
    }
}

module.exports = PlanRepository;
