const crypto = require("node:crypto");

const PlanRepository = require("../database/repositories/PlanRepository");
const ui = require("../utils/ui");
const { encontrarCanalDeAnuncio } = require("../utils/findAnnounceChannel");
const {
    PLANS, PLAN_ORDER, CATALOG, UNLIMITED, FALLBACK_KEY,
    rankOf, isValidPlan, minPlanFor, toPublic
} = require("../config/plans");

/*
=========================
    PLANOS — REGRAS
=========================
  getPlan(guildId)           → plano efetivo do servidor
  can(guildId, "recurso")    → boolean
  limit(guildId, "limite")   → número (Infinity = ilimitado)
  consumeMonthly(...)        → cota mensal com contador atômico
  grant / revoke / redeem    → liberação (manual, código ou pagamento)

Regra de ouro: plano vencido NUNCA apaga dados. Só bloqueia recursos pagos
e reduz limites; ao renovar, tudo volta.
*/

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 3 * DAY_MS;
const JOB_INTERVAL_MS = 10 * 60 * 1000;

class PlanError extends Error {
    constructor(message, code = "PLAN_ERROR") {
        super(message);
        this.code = code;
    }
}

class PlanManager {

    constructor() {
        this.cache = new Map(); // guildId -> { value, at }
        this.timer = null;
        this.client = null;
        this._enabled = { value: false, at: 0 };
    }

    /* =====================================================
       CHAVE GERAL (liga/desliga o sistema de planos)
    ===================================================== */

    /**
     * Desligado (padrão): todo servidor usa a Nina como antes dos planos, sem bloqueios.
     * Ligado pelo dashboard quando o dono estiver pronto para cobrar.
     */
    async isEnabled() {
        if (Date.now() - this._enabled.at < 15_000) return this._enabled.value;
        let value = false;
        try {
            value = (await PlanRepository.getSetting("plans_enabled")) === "1";
        } catch (error) {
            console.error("[Planos] Falha ao ler a chave geral:", error);
            return this._enabled.value; // mantém o último valor conhecido
        }
        this._enabled = { value, at: Date.now() };
        return value;
    }

    async setEnabled(value, actor = null) {
        await PlanRepository.setSetting("plans_enabled", value ? "1" : "0");
        this._enabled = { value: Boolean(value), at: Date.now() };
        this.invalidate();
        await PlanRepository.addEvent({ guildId: "global", action: value ? "system_on" : "system_off", actor });
    }

    /* =====================================================
       CONSULTA
    ===================================================== */

    _cacheSet(guildId, value) {
        if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(guildId, { value, at: Date.now() });
    }

    invalidate(guildId) {
        if (guildId) this.cache.delete(guildId);
        else this.cache.clear();
    }

    /**
     * Plano efetivo. Sem assinatura, cancelada ou vencida = Free.
     * Retorna { id, def, active, expiresAt, source, overrides, subscription }.
     */
    async getPlan(guildId) {
        // Sistema desligado: perfil sem restrições (comportamento antigo da Nina).
        if (!(await this.isEnabled())) return this._legacy();
        return this.getRealPlan(guildId);
    }

    /** Plano contratado de verdade (ignora a chave geral). Usado na gestão: conceder, resgatar, consultar. */
    async getRealPlan(guildId) {
        if (!guildId) return this._build(null, {});

        const hit = this.cache.get(guildId);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

        let subscription = null;
        let overrides = {};
        try {
            [subscription, overrides] = await Promise.all([
                PlanRepository.getSubscription(guildId),
                PlanRepository.getOverrides(guildId)
            ]);
        } catch (error) {
            // Falha de banco nunca pode derrubar um comando: cai para Free sem cachear.
            console.error("[Planos] Falha ao ler plano:", error);
            return this._build(null, {});
        }

        const value = this._build(subscription, overrides);
        this._cacheSet(guildId, value);
        return value;
    }

    _legacy() {
        return {
            id: "legacy", def: PLANS.legacy, active: false, expiresAt: null,
            source: null, overrides: {}, subscription: null
        };
    }

    _build(subscription, overrides) {
        const now = Date.now();
        let id = FALLBACK_KEY;
        let active = false;

        if (subscription && subscription.status === "active" && isValidPlan(subscription.plan)) {
            const expires = subscription.expires_at == null ? null : Number(subscription.expires_at);
            if (expires == null || expires > now) {
                id = subscription.plan;
                active = id !== FALLBACK_KEY;
            }
        }

        return {
            id,
            def: PLANS[id],
            active,
            expiresAt: subscription?.expires_at == null ? null : Number(subscription.expires_at),
            source: subscription?.source || null,
            overrides: overrides || {},
            subscription: subscription || null
        };
    }

    _resolve(plan, key) {
        if (Object.prototype.hasOwnProperty.call(plan.overrides, key)) {
            const v = plan.overrides[key];
            if (v === "unlimited") return UNLIMITED;
            return v;
        }
        const v = plan.def.limits[key];
        return v === undefined ? PLANS[FALLBACK_KEY].limits[key] : v;
    }

    async can(guildId, feature) {
        const plan = await this.getPlan(guildId);
        const v = this._resolve(plan, feature);
        return v === true || (typeof v === "number" && v > 0);
    }

    /** Limite numérico (Infinity = ilimitado). Recurso booleano desligado vira 0. */
    async limit(guildId, key) {
        const plan = await this.getPlan(guildId);
        const v = this._resolve(plan, key);
        if (v === true) return UNLIMITED;
        if (v === false || v == null) return 0;
        return Number(v);
    }

    /** Todos os limites efetivos do servidor (já com overrides), para o painel. */
    async effectiveLimits(guildId) {
        const plan = await this.getPlan(guildId);
        const out = {};
        for (const key of Object.keys(CATALOG)) {
            const v = this._resolve(plan, key);
            out[key] = v === Infinity ? null : v;
        }
        return out;
    }

    /* =====================================================
       COTAS MENSAIS
    ===================================================== */

    period(date = new Date()) {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    async usage(guildId, key) {
        return PlanRepository.getUsage(guildId, key, this.period());
    }

    /**
     * Tenta gastar `amount` da cota mensal `key`, usando como teto o limite do plano.
     * Retorna { allowed, used, max }. Se não permitido, nada é gasto.
     */
    async consumeMonthly(guildId, key, amount = 1) {
        const max = await this.limit(guildId, key);
        if (max <= 0) return { allowed: false, used: await this.usage(guildId, key), max };
        const r = await PlanRepository.consumeUsage(guildId, key, this.period(), amount, max);
        return { ...r, max };
    }

    /** Igual a consumeMonthly, mas a cota renova todo dia (UTC-3 aproximado: usa a data ISO em UTC). */
    async consumeDaily(guildId, key, amount = 1) {
        const max = await this.limit(guildId, key);
        if (max <= 0) return { allowed: false, used: 0, max };
        const day = new Date().toISOString().slice(0, 10);
        const r = await PlanRepository.consumeUsage(guildId, key, day, amount, max);
        return { ...r, max };
    }

    /** Soma consumo já realizado (sem teto), ex.: minutos de uma gravação que acabou de terminar. */
    async addUsage(guildId, key, amount) {
        if (!(amount > 0)) return;
        await PlanRepository.consumeUsage(guildId, key, this.period(), Math.round(amount), Infinity);
    }

    async refundMonthly(guildId, key, amount = 1) {
        await PlanRepository.refundUsage(guildId, key, this.period(), amount);
    }

    /* =====================================================
       MENSAGENS PADRÃO DE BLOQUEIO
    ===================================================== */

    planLabel(planId) {
        const p = PLANS[planId];
        return p ? `${p.emoji} **${p.name}**` : planId;
    }

    /** Texto curto: "Disponível a partir do plano 💎 Pro." */
    requirementText(key) {
        const min = minPlanFor(key);
        const label = CATALOG[key]?.label || key;
        return `**${label}** está disponível a partir do plano ${this.planLabel(min)}.`;
    }

    /** Embed padrão "faça upgrade". */
    upgradeEmbed(key, source = null, extra = "") {
        return ui.panel({
            color: ui.COLORS.warn,
            emoji: "sparkle",
            title: "Recurso de plano superior",
            description:
                `${this.requirementText(key)}\n${extra}\n\n` +
                `Use \`/plano\` para ver o plano atual do servidor e comparar os planos.`.trim(),
            source
        });
    }

    /** Embed padrão "limite atingido". */
    limitEmbed(key, current, max, source = null) {
        const label = CATALOG[key]?.label || key;
        return ui.panel({
            color: ui.COLORS.warn,
            emoji: "sparkle",
            title: "Limite do plano atingido",
            description:
                `**${label}:** \`${current}/${Number.isFinite(max) ? max : "∞"}\`.\n` +
                `Faça upgrade para aumentar esse limite — veja \`/plano\`.`,
            source
        });
    }

    /**
     * Guarda para comandos/handlers. Retorna true se liberado; senão responde
     * com o embed de upgrade (efêmero) e retorna false.
     *   if (!(await PlanManager.gate(interaction, "anti_scam_images"))) return;
     */
    async gate(interaction, feature) {
        if (!interaction.guildId) return true;
        if (await this.can(interaction.guildId, feature)) return true;
        await ui.respond(interaction, this.upgradeEmbed(feature, interaction), { ephemeral: true }).catch(() => null);
        return false;
    }

    /* =====================================================
       LIBERAÇÃO
    ===================================================== */

    /**
     * Libera (ou renova/troca) o plano de um servidor.
     * days = null → sem vencimento. Se já houver o MESMO plano ativo e `extend`,
     * soma os dias ao vencimento atual.
     */
    async grant({ guildId, plan, days = null, source = "manual", actor = null, note = null, extend = true }) {
        if (!guildId) throw new PlanError("Servidor inválido.");
        if (!isValidPlan(plan)) throw new PlanError("Plano inválido.");

        if (plan === FALLBACK_KEY) {
            await this.revoke({ guildId, actor, reason: "grant free" });
            return this.getRealPlan(guildId);
        }

        const now = Date.now();
        const current = await PlanRepository.getSubscription(guildId);
        const sameActive = current && current.status === "active" && current.plan === plan &&
            (current.expires_at == null || Number(current.expires_at) > now);

        let expiresAt = null;
        if (days != null) {
            const d = Number(days);
            if (!Number.isFinite(d) || d <= 0 || d > 3650) throw new PlanError("Duração inválida (1 a 3650 dias).");
            const base = extend && sameActive && current.expires_at != null ? Number(current.expires_at) : now;
            expiresAt = base + Math.round(d * DAY_MS);
        } else if (sameActive && current.expires_at == null && extend) {
            expiresAt = null; // já era permanente
        }

        await PlanRepository.upsertSubscription({
            guildId, plan, source, startedAt: sameActive ? Number(current.started_at) : now,
            expiresAt, grantedBy: actor, note
        });
        await PlanRepository.addEvent({
            guildId, action: sameActive ? "renew" : "grant", plan, source, actor,
            details: `${days == null ? "permanente" : `${days} dia(s)`}${note ? ` · ${note}` : ""}`
        });

        this.invalidate(guildId);
        return this.getRealPlan(guildId);
    }

    async revoke({ guildId, actor = null, reason = null }) {
        const current = await PlanRepository.getSubscription(guildId);
        if (!current) return false;
        await PlanRepository.deleteSubscription(guildId);
        await PlanRepository.addEvent({
            guildId, action: "revoke", plan: current.plan, source: current.source, actor, details: reason
        });
        this.invalidate(guildId);
        return true;
    }

    async setOverride({ guildId, key, value, actor = null }) {
        if (!CATALOG[key]) throw new PlanError("Limite desconhecido.");
        const isBool = CATALOG[key].type === "boolean";
        let parsed = value;
        if (isBool) {
            parsed = value === true || value === "true" || value === 1 || value === "1";
        } else if (value === null || value === "unlimited" || value === "ilimitado") {
            parsed = "unlimited";
        } else {
            parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e9) throw new PlanError("Valor inválido.");
        }
        await PlanRepository.setOverride(guildId, key, parsed);
        await PlanRepository.addEvent({ guildId, action: "override", actor, details: `${key}=${parsed}` });
        this.invalidate(guildId);
    }

    async removeOverride({ guildId, key, actor = null }) {
        await PlanRepository.removeOverride(guildId, key);
        await PlanRepository.addEvent({ guildId, action: "override_remove", actor, details: key });
        this.invalidate(guildId);
    }

    /* =====================================================
       CÓDIGOS DE ATIVAÇÃO
    ===================================================== */

    _generateCode() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
        const block = () => Array.from(crypto.randomBytes(4), b => alphabet[b % alphabet.length]).join("");
        return `NINA-${block()}-${block()}-${block()}`;
    }

    normalizeCode(code) {
        return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
    }

    async createCode({ plan, durationDays = null, maxUses = 1, expiresInDays = null, note = null, actor = null, quantity = 1 }) {
        if (!isValidPlan(plan) || plan === FALLBACK_KEY) throw new PlanError("Escolha basic ou pro.");
        const uses = Number(maxUses);
        if (!Number.isInteger(uses) || uses < 1 || uses > 10000) throw new PlanError("Usos inválidos (1 a 10000).");
        if (durationDays != null && (!Number.isFinite(Number(durationDays)) || Number(durationDays) <= 0 || Number(durationDays) > 3650)) {
            throw new PlanError("Duração inválida (1 a 3650 dias).");
        }
        const qty = Math.min(Math.max(Number(quantity) || 1, 1), 50);
        const codes = [];
        for (let i = 0; i < qty; i++) {
            const code = this._generateCode();
            await PlanRepository.createCode({
                code, plan,
                durationDays: durationDays == null ? null : Number(durationDays),
                maxUses: uses,
                expiresAt: expiresInDays ? Date.now() + Number(expiresInDays) * DAY_MS : null,
                note, createdBy: actor
            });
            codes.push(code);
        }
        return codes;
    }

    /**
     * Resgata um código para um servidor.
     * Mesmo plano → soma dias. Plano maior → substitui. Plano menor com outro ativo → recusa.
     */
    async redeem({ code, guildId, userId }) {
        const normalized = this.normalizeCode(code);
        if (!normalized) throw new PlanError("Informe o código.", "BAD_CODE");

        const row = await PlanRepository.getCode(normalized);
        if (!row || row.revoked) throw new PlanError("Código inválido.", "BAD_CODE");
        if (row.expires_at && Number(row.expires_at) <= Date.now()) throw new PlanError("Este código expirou.", "CODE_EXPIRED");
        if (row.uses >= row.max_uses) throw new PlanError("Este código já foi totalmente utilizado.", "CODE_USED");
        if (await PlanRepository.guildUsedCode(normalized, guildId)) {
            throw new PlanError("Este servidor já usou esse código.", "CODE_REUSED");
        }

        const current = await this.getRealPlan(guildId);
        if (current.active && rankOf(row.plan) < rankOf(current.id)) {
            throw new PlanError(
                `Este servidor já tem o plano ${PLANS[current.id].name}, superior ao do código (${PLANS[row.plan].name}).`,
                "LOWER_PLAN"
            );
        }

        // Reserva o uso de forma atômica; se algo falhar depois, devolve.
        if (!(await PlanRepository.consumeCodeUse(normalized))) {
            throw new PlanError("Este código não pode mais ser usado.", "CODE_USED");
        }

        try {
            const result = await this.grant({
                guildId, plan: row.plan, days: row.duration_days,
                source: "code", actor: userId, note: `código ${normalized}`,
                extend: current.id === row.plan
            });
            await PlanRepository.addCodeUse(normalized, guildId, userId);
            return result;
        } catch (error) {
            await PlanRepository.refundCodeUse(normalized).catch(() => null);
            throw error;
        }
    }

    /* =====================================================
       EXPIRAÇÃO E AVISOS
    ===================================================== */

    start(client) {
        this.client = client;
        if (this.timer) clearInterval(this.timer);

        const run = () => this.tick().catch(error => console.error("[Planos] Falha no ciclo de expiração:", error));
        setTimeout(run, 15_000).unref?.();
        this.timer = setInterval(run, JOB_INTERVAL_MS);
        this.timer.unref?.();
    }

    async tick() {
        // Sistema desligado: não expira nem avisa ninguém (nada está sendo cobrado ainda).
        if (!(await this.isEnabled())) return;

        const now = Date.now();
        const rows = await PlanRepository.listExpiringBefore(now + WARN_BEFORE_MS);

        for (const sub of rows) {
            const expires = Number(sub.expires_at);

            if (expires <= now) {
                await PlanRepository.setStatus(sub.guild_id, "expired");
                await PlanRepository.addEvent({
                    guildId: sub.guild_id, action: "expire", plan: sub.plan, source: sub.source
                });
                this.invalidate(sub.guild_id);
                await this._notify(sub.guild_id, ui.panel({
                    color: ui.COLORS.warn,
                    emoji: "sparkle",
                    title: "Plano expirado",
                    description:
                        `O plano ${this.planLabel(sub.plan)} deste servidor expirou e ele voltou ao **Free**.\n` +
                        `Nada foi apagado: seus dados e configurações continuam salvos, e os recursos extras voltam assim que o plano for renovado.`
                }));
            } else if (!sub.warned_at) {
                await PlanRepository.markWarned(sub.guild_id);
                await this._notify(sub.guild_id, ui.panel({
                    color: ui.COLORS.warn,
                    emoji: "sparkle",
                    title: "Seu plano vence em breve",
                    description:
                        `O plano ${this.planLabel(sub.plan)} deste servidor vence ${ui.ts(expires)}.\n` +
                        `Renove para não perder os recursos extras.`
                }));
            }
        }

        // Limpa contadores com mais de 3 meses (1x por ciclo, é barato).
        const old = new Date(); old.setUTCMonth(old.getUTCMonth() - 3);
        await PlanRepository.pruneUsage(this.period(old)).catch(() => null);
    }

    async _notify(guildId, embed) {
        const guild = this.client?.guilds?.cache?.get(guildId);
        if (!guild) return;
        try {
            const channel = await encontrarCanalDeAnuncio(guild);
            if (channel) return await channel.send({ embeds: [embed] });
            const owner = await guild.fetchOwner().catch(() => null);
            await owner?.send({ embeds: [embed] }).catch(() => null);
        } catch (error) {
            console.warn(`[Planos] Não foi possível avisar o servidor ${guildId}:`, error.message);
        }
    }

    /* =====================================================
       SERIALIZAÇÃO (painel / dashboard / site)
    ===================================================== */

    async describe(guildId) {
        const plan = await this.getRealPlan(guildId); // contratado de verdade; limits abaixo são os efetivos
        const sub = plan.subscription;
        return {
            enabled: await this.isEnabled(),
            plan: plan.id,
            name: plan.def.name,
            active: plan.active,
            source: plan.source,
            expiresAt: plan.expiresAt,
            status: sub?.status || "none",
            startedAt: sub?.started_at ? Number(sub.started_at) : null,
            overrides: plan.overrides,
            limits: await this.effectiveLimits(guildId)
        };
    }

    async publicCatalog() {
        return { enabled: await this.isEnabled(), ...toPublic() };
    }
}

module.exports = new PlanManager();
module.exports.PlanError = PlanError;
module.exports.PLAN_ORDER = PLAN_ORDER;
