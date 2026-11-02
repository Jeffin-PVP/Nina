const router = require("express").Router();

const { login, logout, requireAuth } = require("./dashboardAuth");
const SettingsRepository = require("../database/repositories/SettingsRepository");
const PresenceManager = require("../managers/PresenceManager");
const BroadcastManager = require("../managers/BroadcastManager");
const BroadcastRepository = require("../database/repositories/BroadcastRepository");
const BannedGuildRepository = require("../database/repositories/BannedGuildRepository");
const GlobalBanManager = require("../managers/GlobalBanManager");
const StatsHistoryRepository = require("../database/repositories/StatsHistoryRepository");
const { encontrarCanalDeAnuncio } = require("../utils/findAnnounceChannel");
const PlanManager = require("../managers/PlanManager");
const PlanRepository = require("../database/repositories/PlanRepository");
const Plans = require("../config/plans");

module.exports = (client) => {

    /*
    =========================
        AUTENTICAÇÃO
    =========================
    */

    router.post("/login", login);
    router.post("/logout", requireAuth, logout);

    // Tudo abaixo daqui exige token válido
    router.use(requireAuth);

    /*
    =========================
        VISÃO GERAL
    =========================
    */

    router.get("/overview", (req, res) => {

        const totalMembros = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        res.json({
            online: client.isReady(),
            tag: client.user?.tag || null,
            avatar: client.user?.displayAvatarURL() || null,
            id: client.user?.id || null,
            ping: client.ws.ping,
            servers: client.guilds.cache.size,
            members: totalMembros,
            uptimeMs: client.uptime,
            node: process.version,
            memory: process.memoryUsage()
        });

    });

    /*
    =========================
        BANIMENTOS GLOBAIS DE USUÁRIOS
    =========================
    */

    router.get("/users/banned", async (req, res) => {

        try {
            const banned = await GlobalBanManager.list();
            res.json({ banned });
        } catch (error) {
            res.status(500).json({ error: `Não foi possível carregar os usuários banidos: ${error.message}` });
        }

    });

    router.post("/users/:id/ban", async (req, res) => {

        const userId = String(req.params.id || "").trim();
        const { reason } = req.body || {};

        if (!GlobalBanManager.isValidUserId(userId)) {
            return res.status(400).json({ error: "ID de usuário do Discord inválido." });
        }

        if (client.user?.id === userId) {
            return res.status(400).json({ error: "A Nina não pode ser banida globalmente." });
        }

        try {

            let userTag = null;

            try {
                const user = await client.users.fetch(userId);
                userTag = user.tag;
            } catch {
                userTag = String(req.body?.userTag || "").trim().slice(0, 255) || null;
            }

            await GlobalBanManager.ban(userId, {
                userTag,
                reason: reason ? String(reason).trim().slice(0, 1000) : null,
                bannedBy: process.env.OWNER_ID || null
            });

            // Se o usuário banido for dono de algum servidor onde a Nina está,
            // ela sai automaticamente desse servidor.
            const guildsToLeave = client.guilds.cache.filter(guild => guild.ownerId === userId);

            for (const guild of guildsToLeave.values()) {
                await guild.leave().catch(error => {
                    console.error(`❌ Não consegui sair do servidor do usuário banido ${guild.id}:`, error.message);
                });
            }

            res.json({
                ok: true,
                message: userTag
                    ? `Usuário ${userTag} banido globalmente.`
                    : `Usuário ${userId} banido globalmente.`,
                leftServers: guildsToLeave.size
            });

        } catch (error) {
            res.status(500).json({ error: `Não foi possível banir o usuário globalmente: ${error.message}` });
        }

    });

    router.post("/users/banned/:id/unban", async (req, res) => {

        try {
            await GlobalBanManager.unban(req.params.id);
            res.json({ ok: true, message: "Usuário desbanido globalmente." });
        } catch (error) {
            res.status(500).json({ error: `Não foi possível desbanir o usuário: ${error.message}` });
        }

    });

    /*
    =========================
        SERVIDORES
    =========================
    */

    router.get("/guilds", (req, res) => {

        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL({ size: 128 }) || null,
            memberCount: g.memberCount,
            ownerId: g.ownerId,
            joinedAt: g.joinedTimestamp
        })).sort((a, b) => b.memberCount - a.memberCount);

        res.json({ guilds });

    });

    router.post("/guilds/:id/leave", async (req, res) => {

        const guild = client.guilds.cache.get(req.params.id);

        if (!guild) {

            return res.status(404).json({ error: "Servidor não encontrado (o bot não está nele)." });

        }

        const nome = guild.name;

        try {

            await guild.leave();
            res.json({ ok: true, message: `Saí do servidor "${nome}".` });

        } catch (error) {

            res.status(500).json({ error: `Não foi possível sair: ${error.message}` });

        }

    });

    /*
    =========================
        SERVIDORES BANIDOS
    =========================
    */

    router.get("/guilds/banned", async (req, res) => {

        const banidos = await BannedGuildRepository.list();

        res.json({ banned: banidos });

    });

    router.post("/guilds/:id/ban", async (req, res) => {

        const { reason } = req.body || {};
        const guild = client.guilds.cache.get(req.params.id);
        const nome = guild?.name || `Servidor ${req.params.id}`;

        try {

            await BannedGuildRepository.ban(req.params.id, nome, reason || null);

            if (guild) await guild.leave().catch(() => {});

            res.json({ ok: true, message: `"${nome}" banido. O bot sai automaticamente se for adicionado de novo.` });

        } catch (error) {

            res.status(500).json({ error: `Não foi possível banir: ${error.message}` });

        }

    });

    router.post("/guilds/banned/:id/unban", async (req, res) => {

        await BannedGuildRepository.unban(req.params.id);

        res.json({ ok: true });

    });

    router.get("/guilds/:id/invite", async (req, res) => {

        const guild = client.guilds.cache.get(req.params.id);

        if (!guild) {

            return res.status(404).json({ error: "Servidor não encontrado (o bot não está nele)." });

        }

        try {

            const canal = await encontrarCanalDeAnuncio(guild);

            if (!canal) {

                return res.status(400).json({ error: "Não achei nenhum canal onde eu possa criar um convite." });

            }

            const invite = await canal.createInvite({
                maxAge: 3600,
                maxUses: 1,
                unique: true,
                reason: "Convite gerado pelo dashboard do dono"
            });

            res.json({ url: invite.url, expiresInSeconds: 3600 });

        } catch (error) {

            res.status(500).json({ error: `Não foi possível criar o convite: ${error.message}` });

        }

    });

    /*
    =========================
        PRESENÇA / STATUS
    =========================
    */

    router.get("/presence", async (req, res) => {

        const lista = await SettingsRepository.listPresence();
        const intervalo = await SettingsRepository.get("presence_interval_seconds", "15");

        res.json({
            tipos: PresenceManager.TIPOS_ATIVIDADE,
            intervalSeconds: parseInt(intervalo, 10) || 15,
            statuses: lista
        });

    });

    router.post("/presence", async (req, res) => {

        const { statuses, intervalSeconds } = req.body || {};

        if (!Array.isArray(statuses)) {

            return res.status(400).json({ error: "\"statuses\" precisa ser uma lista." });

        }

        const validos = statuses
            .map(s => ({
                type: PresenceManager.TIPOS_ATIVIDADE.includes(s.type) ? s.type : "WATCHING",
                text: String(s.text || "").trim().slice(0, 128)
            }))
            .filter(s => s.text.length > 0);

        await SettingsRepository.replaceAllPresence(validos);

        if (intervalSeconds && Number(intervalSeconds) >= 5) {

            await SettingsRepository.set("presence_interval_seconds", String(Math.floor(Number(intervalSeconds))));

        }

        await PresenceManager.recarregar();

        res.json({ ok: true });

    });

    /*
    =========================
        COMUNICADOS
    =========================
    */

    router.post("/broadcast", async (req, res) => {

        const { title, description, color } = req.body || {};

        if (!description || !String(description).trim()) {

            return res.status(400).json({ error: "A mensagem do comunicado é obrigatória." });

        }

        const resultado = await BroadcastManager.broadcast(client, {
            title,
            description,
            color,
            footer: "Comunicado enviado pelo dono do bot"
        });

        res.json(resultado);

    });

    router.get("/broadcast/history", async (req, res) => {

        const historico = await BroadcastRepository.listRecent(20);

        res.json({ history: historico });

    });

    /*
    =========================
        HISTÓRICO DE ESTATÍSTICAS
    =========================
    */

    router.get("/stats-history", async (req, res) => {

        const historico = await StatsHistoryRepository.listLast(30);

        res.json({ history: historico.reverse() });

    });


    /*
    =========================
        PLANOS (admin)
    =========================
    Tudo aqui exige o token do dashboard (requireAuth já foi aplicado acima).
    */

    const planActor = "dashboard";
    const SNOWFLAKE_ID = /^\d{17,20}$/;

    const planError = (res, error) => {
        if (error instanceof PlanManager.PlanError) return res.status(400).json({ error: error.message });
        console.error("[Dashboard/Planos]", error);
        return res.status(500).json({ error: "Não foi possível concluir a operação de planos." });
    };

    const guildLabel = (guildId) => {
        const guild = client.guilds.cache.get(guildId);
        return { id: guildId, name: guild?.name || null, icon: guild?.iconURL({ size: 64 }) || null, members: guild?.memberCount ?? null, inGuild: Boolean(guild) };
    };

    router.get("/plans/catalog", (req, res) => res.json(Plans.toPublic()));

    // Chave geral: enquanto desligada, todo servidor usa a Nina sem limites de plano.
    router.get("/plans/enabled", async (req, res) => {
        try { res.json({ enabled: await PlanManager.isEnabled() }); } catch (error) { planError(res, error); }
    });

    router.post("/plans/enabled", async (req, res) => {
        try {
            await PlanManager.setEnabled(Boolean(req.body?.enabled), planActor);
            res.json({ ok: true, enabled: await PlanManager.isEnabled() });
        } catch (error) { planError(res, error); }
    });

    router.get("/plans/summary", async (req, res) => {
        try {
            const rows = await PlanRepository.countByPlan();
            const counts = Object.fromEntries(Plans.PLAN_ORDER.map(id => [id, 0]));
            for (const row of rows) if (row.plan in counts) counts[row.plan] = Number(row.total);
            const total = client.guilds.cache.size;
            counts.free = Math.max(0, total - counts.basic - counts.pro);
            res.json({ counts, totalGuilds: total });
        } catch (error) { planError(res, error); }
    });

    router.get("/plans/subscriptions", async (req, res) => {
        try {
            const status = ["active", "expired"].includes(req.query.status) ? req.query.status : null;
            const plan = Plans.isValidPlan(req.query.plan) ? req.query.plan : null;
            const rows = await PlanRepository.listSubscriptions({ status, plan, limit: 500 });
            res.json({
                subscriptions: rows.map(r => ({
                    ...guildLabel(r.guild_id),
                    plan: r.plan, status: r.status, source: r.source,
                    startedAt: Number(r.started_at), expiresAt: r.expires_at == null ? null : Number(r.expires_at),
                    grantedBy: r.granted_by, note: r.note
                }))
            });
        } catch (error) { planError(res, error); }
    });

    router.get("/plans/guild/:guildId", async (req, res) => {
        try {
            const { guildId } = req.params;
            if (!SNOWFLAKE_ID.test(guildId)) return res.status(400).json({ error: "ID de servidor inválido." });
            const [info, events] = await Promise.all([PlanManager.describe(guildId), PlanRepository.listEvents(guildId, 30)]);
            res.json({
                guild: guildLabel(guildId),
                ...info,
                events: events.map(e => ({ action: e.action, plan: e.plan, source: e.source, actor: e.actor, details: e.details, at: Number(e.created_at) }))
            });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/grant", async (req, res) => {
        try {
            const { guildId, plan, days, note } = req.body || {};
            if (!SNOWFLAKE_ID.test(String(guildId || ""))) return res.status(400).json({ error: "ID de servidor inválido." });
            const result = await PlanManager.grant({
                guildId: String(guildId), plan, days: days === "" || days == null ? null : Number(days),
                source: "manual", actor: planActor, note: note ? String(note).slice(0, 100) : null
            });
            res.json({ ok: true, plan: result.id, expiresAt: result.expiresAt });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/revoke", async (req, res) => {
        try {
            const guildId = String(req.body?.guildId || "");
            if (!SNOWFLAKE_ID.test(guildId)) return res.status(400).json({ error: "ID de servidor inválido." });
            const removed = await PlanManager.revoke({ guildId, actor: planActor, reason: "remoção pelo dashboard" });
            res.json({ ok: true, removed });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/override", async (req, res) => {
        try {
            const { guildId, key, value } = req.body || {};
            if (!SNOWFLAKE_ID.test(String(guildId || ""))) return res.status(400).json({ error: "ID de servidor inválido." });
            await PlanManager.setOverride({ guildId: String(guildId), key, value, actor: planActor });
            res.json({ ok: true });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/override/remove", async (req, res) => {
        try {
            const { guildId, key } = req.body || {};
            if (!SNOWFLAKE_ID.test(String(guildId || ""))) return res.status(400).json({ error: "ID de servidor inválido." });
            await PlanManager.removeOverride({ guildId: String(guildId), key: String(key || ""), actor: planActor });
            res.json({ ok: true });
        } catch (error) { planError(res, error); }
    });

    router.get("/plans/codes", async (req, res) => {
        try {
            const rows = await PlanRepository.listCodes(200);
            res.json({
                codes: rows.map(c => ({
                    code: c.code, plan: c.plan, durationDays: c.duration_days, maxUses: c.max_uses, uses: c.uses,
                    expiresAt: c.expires_at == null ? null : Number(c.expires_at), note: c.note,
                    revoked: Boolean(c.revoked), createdAt: Number(c.created_at)
                }))
            });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/codes", async (req, res) => {
        try {
            const b = req.body || {};
            const codes = await PlanManager.createCode({
                plan: b.plan,
                durationDays: b.durationDays === "" || b.durationDays == null ? null : Number(b.durationDays),
                maxUses: b.maxUses === "" || b.maxUses == null ? 1 : Number(b.maxUses),
                expiresInDays: b.expiresInDays ? Number(b.expiresInDays) : null,
                quantity: Number(b.quantity) || 1,
                note: b.note ? String(b.note).slice(0, 100) : null,
                actor: planActor
            });
            res.json({ ok: true, codes });
        } catch (error) { planError(res, error); }
    });

    router.post("/plans/codes/revoke", async (req, res) => {
        try {
            const ok = await PlanRepository.revokeCode(PlanManager.normalizeCode(req.body?.code));
            res.json({ ok });
        } catch (error) { planError(res, error); }
    });

    router.get("/plans/events", async (req, res) => {
        try {
            const rows = await PlanRepository.listEvents(null, 100);
            res.json({ events: rows.map(e => ({ guild: guildLabel(e.guild_id), action: e.action, plan: e.plan, source: e.source, actor: e.actor, details: e.details, at: Number(e.created_at) })) });
        } catch (error) { planError(res, error); }
    });

    /*
    =========================
        REINICIAR
    =========================
    */

    router.post("/restart", async (req, res) => {

        const { title, description, color } = req.body || {};

        const resultado = await BroadcastManager.restart(client, {
            title,
            description,
            color
        });

        res.json({
            ok: true,
            message: "Comunicado enviado. O processo vai encerrar em alguns segundos.",
            broadcast: resultado
        });

    });

    return router;

};
