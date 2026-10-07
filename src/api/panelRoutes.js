const router = require("express").Router();

const GuildRepository = require("../database/repositories/GuildRepository");
const AutomodRepository = require("../database/repositories/AutomodRepository");
const WelcomeRepository = require("../database/repositories/WelcomeRepository");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const GiveawayRepository = require("../database/repositories/GiveawayRepository");
const TicketRepository = require("../database/repositories/TicketRepository");
const EconomyRepository = require("../database/repositories/EconomyRepository");
const database = require("../database/database");
const { CATEGORIES: LOG_CATEGORIES } = require("../managers/LogCategories");
const { validateHttpUrl } = require("../utils/safeFetch");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const EmbedUtils = require("../interactions/embed/EmbedUtils");
const EmbedPreview = require("../interactions/embed/EmbedPreview");
const ContainerManager = require("../managers/ContainerManager");

/*
=========================
    VALIDAÇÃO DE ENTRADA
=========================
*/

class ErroValidacao extends Error { }

const SNOWFLAKE = /^\d{17,20}$/;

const bool = v => (v === true || v === 1 || v === "1" || v === "true") ? 1 : 0;

function inteiro(nome, v, min, max) {

    const n = Number(v);

    if (!Number.isInteger(n) || n < min || n > max) {
        throw new ErroValidacao(`"${nome}" precisa ser um número inteiro entre ${min} e ${max}.`);
    }

    return n;

}

function listaCsv(v) {

    const itens = Array.isArray(v) ? v : String(v ?? "").split(",");

    return itens.map(i => String(i).trim()).filter(Boolean);

}

function acoes(nome, v) {

    const validas = new Set(["delete", "notify", "warn", "mute"]);
    const lista = [...new Set(listaCsv(v))];

    if (lista.some(a => !validas.has(a))) {
        throw new ErroValidacao(`"${nome}" contém uma ação inválida.`);
    }

    return lista.join(",");

}

function idsCsv(nome, v) {

    const lista = [...new Set(listaCsv(v))];

    if (lista.length > 100 || lista.some(i => !SNOWFLAKE.test(i))) {
        throw new ErroValidacao(`"${nome}" contém IDs inválidos.`);
    }

    return lista.join(",");

}

function texto(nome, v, max, { vazio = false } = {}) {

    const t = String(v ?? "").trim();

    if (!vazio && !t) throw new ErroValidacao(`"${nome}" não pode ficar vazio.`);
    if (t.length > max) throw new ErroValidacao(`"${nome}" aceita no máximo ${max} caracteres.`);

    return t;

}

function idOpcional(nome, v, existe) {

    if (v === null || v === undefined || v === "") return null;

    const id = String(v);

    if (!SNOWFLAKE.test(id) || !existe(id)) {
        throw new ErroValidacao(`"${nome}" não é válido para este servidor.`);
    }

    return id;

}

function sanitizarAutomod(body) {

    const campos = {};
    const b = body || {};

    const set = (chave, fn) => { if (b[chave] !== undefined) campos[chave] = fn(b[chave]); };

    for (const chave of ["enabled", "spam_enabled", "emoji_enabled", "swear_enabled", "mention_enabled", "invite_enabled", "raid_enabled"]) {
        set(chave, bool);
    }

    set("mute_duration_minutes", v => inteiro("mute_duration_minutes", v, 1, 40320));
    set("spam_max_messages", v => inteiro("spam_max_messages", v, 2, 50));
    set("spam_interval_seconds", v => inteiro("spam_interval_seconds", v, 1, 300));
    set("emoji_max_count", v => inteiro("emoji_max_count", v, 1, 100));
    set("mention_max_count", v => inteiro("mention_max_count", v, 1, 50));
    set("raid_join_threshold", v => inteiro("raid_join_threshold", v, 2, 100));
    set("raid_interval_seconds", v => inteiro("raid_interval_seconds", v, 5, 3600));

    for (const chave of ["spam_actions", "emoji_actions", "swear_actions", "mention_actions", "invite_actions"]) {
        set(chave, v => acoes(chave, v));
    }

    set("ignored_channels", v => idsCsv("ignored_channels", v));
    set("ignored_roles", v => idsCsv("ignored_roles", v));
    set("swear_custom_words", v => texto("swear_custom_words", v, 2000, { vazio: true }));

    set("raid_action", v => {
        if (!["lockdown", "kick_new", "ban_new"].includes(v)) throw new ErroValidacao('"raid_action" inválido.');
        return v;
    });

    return campos;

}

function sanitizarWelcome(body, guild) {

    const campos = {};
    const b = body || {};

    if (b.enabled !== undefined) campos.enabled = bool(b.enabled);

    if (b.channel_id !== undefined) {
        campos.channel_id = idOpcional("channel_id", b.channel_id, id => guild.channels.cache.get(id)?.isTextBased?.());
    }

    if (b.background_url !== undefined) {

        const url = String(b.background_url ?? "").trim();

        if (!url) {
            campos.background_url = null;
        } else {
            try { validateHttpUrl(url); } catch (error) { throw new ErroValidacao(`"background_url": ${error.message}`); }
            campos.background_url = url;
        }

    }

    if (b.title_text !== undefined) campos.title_text = texto("title_text", b.title_text, 255);
    if (b.subtitle_text !== undefined) campos.subtitle_text = texto("subtitle_text", b.subtitle_text, 255, { vazio: true });
    if (b.message_content !== undefined) campos.message_content = texto("message_content", b.message_content, 2000, { vazio: true });

    if (b.accent_color !== undefined) {

        if (!/^#[0-9a-fA-F]{6}$/.test(String(b.accent_color))) throw new ErroValidacao('"accent_color" precisa estar no formato #RRGGBB.');

        campos.accent_color = String(b.accent_color);

    }

    return campos;

}

function sanitizarTickets(body, guild) {

    const campos = {};
    const b = body || {};

    if (b.enabled !== undefined) campos.enabled = bool(b.enabled);

    for (const chave of ["parent_channel_id", "panel_channel_id"]) {
        if (b[chave] !== undefined) campos[chave] = idOpcional(chave, b[chave], id => guild.channels.cache.has(id));
    }

    if (b.support_role_id !== undefined) {
        campos.support_role_id = idOpcional("support_role_id", b.support_role_id, id => guild.roles.cache.has(id));
    }

    return campos;

}

function tratarValidacao(res, error) {

    if (error instanceof ErroValidacao) return res.status(400).json({ error: error.message });

    throw error;

}

async function exigirGerenciarMensagens(req, res) {

    try {
        const membro = await req.painelGuild.members.fetch(req.painelSessao.user.id);
        if (membro.permissions.has(PermissionFlagsBits.Administrator) || membro.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return true;
        }
    } catch (error) {
        console.error("[Painel] Falha ao verificar permissões do usuário:", error);
    }

    res.status(403).json({ error: "Você precisa de Administrador ou Gerenciar Mensagens para enviar mensagens pelo painel." });
    return false;
}

function obterCanalTexto(guild, channelId) {
    const canal = guild.channels.cache.get(String(channelId || ""));
    if (!canal || !canal.isTextBased?.() || canal.isThread?.()) return null;
    return canal;
}

function validarEmbedPainel(body) {
    const data = EmbedUtils.sanitize(body || {});
    if (!EmbedUtils.hasContent(data)) throw new ErroValidacao("A embed precisa ter pelo menos título, descrição, imagem, thumbnail, autor, rodapé ou um campo.");
    return data;
}

module.exports = (client) => {

    const { loginUrl, callback, requireAuth, requireGuildAccess, logout } = require("./panelAuth")(client);

    /*
    =========================
        AUTENTICAÇÃO (sem exigir sessão)
    =========================
    */

    router.get("/login-url", loginUrl);
    router.get("/callback", callback);

    router.get("/client-id", (req, res) => {

        res.json({ clientId: process.env.CLIENT_ID });

    });

    /*
    =========================
        A PARTIR DAQUI, PRECISA ESTAR LOGADO
    =========================
    */

    router.use(requireAuth);

    router.post("/logout", logout);

    router.get("/me", (req, res) => {

        res.json({
            user: req.painelSessao.user,
            guilds: req.painelSessao.guilds
        });

    });

    /*
    =========================
        A PARTIR DAQUI, PRECISA TER ACESSO AO SERVIDOR
    =========================
    */

    router.use("/guilds/:guildId", requireGuildAccess);

    /*
    =========================
        VISÃO GERAL
    =========================
    */

    router.get("/guilds/:guildId/overview", (req, res) => {

        const guild = req.painelGuild;

        const channels = guild.channels.cache
            .filter(c => c.isTextBased?.() && !c.isThread?.())
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
            .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

        res.json({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ size: 128 }),
            memberCount: guild.memberCount,
            channels,
            roles
        });

    });

    /*
    =========================
        CONFIGURAÇÃO GERAL
    =========================
    */

    router.get("/guilds/:guildId/geral", async (req, res) => {

        const settings = await GuildRepository.getSettings(req.params.guildId);

        res.json({
            economyEnabled: !!settings.economy_enabled,
            moderationEnabled: !!settings.moderation_enabled,
            levelupEnabled: !!settings.levelup_enabled,
            prefix: settings.prefix || "!"
        });

    });

    router.post("/guilds/:guildId/geral", async (req, res) => {

        const { economyEnabled, moderationEnabled, levelupEnabled, prefix } = req.body || {};

        const campos = {};

        if (economyEnabled !== undefined) campos.economy_enabled = economyEnabled ? 1 : 0;
        if (moderationEnabled !== undefined) campos.moderation_enabled = moderationEnabled ? 1 : 0;
        if (levelupEnabled !== undefined) campos.levelup_enabled = levelupEnabled ? 1 : 0;
        if (prefix) campos.prefix = String(prefix).slice(0, 5);

        if (Object.keys(campos).length) await GuildRepository.update(req.params.guildId, campos);

        res.json({ ok: true });

    });

    /*
    =========================
        AUTOMOD
    =========================
    */

    router.get("/guilds/:guildId/automod", async (req, res) => {

        res.json(await AutomodRepository.get(req.params.guildId));

    });

    router.post("/guilds/:guildId/automod", async (req, res) => {

        let campos;

        try { campos = sanitizarAutomod(req.body); } catch (error) { return tratarValidacao(res, error); }

        const atualizado = await AutomodRepository.update(req.params.guildId, campos);

        res.json(atualizado);

    });

    /*
    =========================
        BOAS-VINDAS
    =========================
    */

    router.get("/guilds/:guildId/welcome", async (req, res) => {

        res.json(await WelcomeRepository.get(req.params.guildId));

    });

    router.post("/guilds/:guildId/welcome", async (req, res) => {

        let campos;

        try { campos = sanitizarWelcome(req.body, req.painelGuild); } catch (error) { return tratarValidacao(res, error); }

        const atualizado = await WelcomeRepository.update(req.params.guildId, campos);

        res.json(atualizado);

    });

    /*
    =========================
        AUTOROLE (cargo de entrada)
    =========================
    */

    router.get("/guilds/:guildId/autorole", async (req, res) => {

        const roleIds = await AutoroleRepository.getJoinRoles(req.params.guildId);

        res.json({ roleIds });

    });

    router.post("/guilds/:guildId/autorole", async (req, res) => {

        const { roleId } = req.body || {};

        if (!roleId) return res.status(400).json({ error: "roleId é obrigatório." });
        const role = req.painelGuild.roles.cache.get(roleId);
        const botRole = req.painelGuild.members.me?.roles?.highest;
        if (!role || role.managed) return res.status(400).json({ error: "Cargo inválido." });
        if (botRole && role.comparePositionTo(botRole) >= 0) {
            return res.status(400).json({ error: "A Nina precisa estar acima desse cargo para conseguir atribuí-lo." });
        }

        const roleIds = await AutoroleRepository.addJoinRole(req.params.guildId, roleId);

        res.json({ roleIds });

    });

    router.delete("/guilds/:guildId/autorole/:roleId", async (req, res) => {

        const roleIds = await AutoroleRepository.removeJoinRole(req.params.guildId, req.params.roleId);

        res.json({ roleIds });

    });


    /*
    =========================
        TICKETS
    =========================
    */

    router.get("/guilds/:guildId/tickets", async (req, res) => {
        const config = await TicketRepository.getConfig(req.params.guildId);
        const tickets = await TicketRepository.listOpen(req.params.guildId);
        res.json({
            config,
            tickets,
            openCount: tickets.length
        });
    });

    router.post("/guilds/:guildId/tickets", async (req, res) => {
        let campos;
        try { campos = sanitizarTickets(req.body, req.painelGuild); } catch (error) { return tratarValidacao(res, error); }
        await TicketRepository.setConfig(req.params.guildId, campos);
        res.json({ config: await TicketRepository.getConfig(req.params.guildId) });
    });

    /*
    =========================
        AUTOROLE POR NÍVEL
    =========================
    */

    router.get("/guilds/:guildId/autorole/levels", async (req, res) => {
        res.json({ levels: await AutoroleRepository.listLevelRoles(req.params.guildId) });
    });

    router.post("/guilds/:guildId/autorole/levels", async (req, res) => {
        const level = Number(req.body?.level);
        const roleId = String(req.body?.roleId || "");
        if (!Number.isInteger(level) || level < 1 || level > 10000 || !roleId) {
            return res.status(400).json({ error: "Nível e cargo são obrigatórios." });
        }
        const role = req.painelGuild.roles.cache.get(roleId);
        const botRole = req.painelGuild.members.me?.roles?.highest;
        if (!role || role.managed) return res.status(400).json({ error: "Cargo inválido." });
        if (botRole && role.comparePositionTo(botRole) >= 0) {
            return res.status(400).json({ error: "A Nina precisa estar acima desse cargo para conseguir atribuí-lo." });
        }
        await AutoroleRepository.setLevelRole(req.params.guildId, level, roleId);
        res.json({ ok: true });
    });

    router.delete("/guilds/:guildId/autorole/levels/:level", async (req, res) => {
        const level = Number(req.params.level);
        await AutoroleRepository.removeLevelRole(req.params.guildId, level);
        res.json({ ok: true });
    });

    /*
    =========================
        ECONOMIA
    =========================
    */

    router.get("/guilds/:guildId/economy", async (req, res) => {
        const guildId = req.params.guildId;
        const settings = await GuildRepository.getSettings(guildId);
        const stats = await database.get(`
            SELECT COUNT(*) AS users,
                   COALESCE(SUM(wallet + bank), 0) AS totalWealth,
                   COALESCE(SUM(xp), 0) AS totalXp
            FROM economy_users WHERE guild_id = ?
        `, [guildId]);
        const leaderboard = await EconomyRepository.getLeaderboard(guildId, 10);
        res.json({
            enabled: !!settings.economy_enabled,
            users: Number(stats?.users || 0),
            totalWealth: Number(stats?.totalWealth || 0),
            totalXp: Number(stats?.totalXp || 0),
            leaderboard
        });
    });

    /*
    =========================
        LOGS
    =========================
    */

    router.get("/guilds/:guildId/logs", async (req, res) => {

        const settings = await GuildRepository.getSettings(req.params.guildId);
        const disabled = await GuildRepository.getDisabledCategories(req.params.guildId);

        const categories = Object.entries(LOG_CATEGORIES).map(([key, cat]) => ({
            key,
            label: cat.label,
            emoji: cat.emoji,
            enabled: !disabled.includes(key)
        }));

        res.json({ channelId: settings.log_channel || null, categories });

    });

    router.post("/guilds/:guildId/logs/canal", async (req, res) => {

        let channelId;

        try {
            channelId = idOpcional("channelId", (req.body || {}).channelId, id => req.painelGuild.channels.cache.get(id)?.isTextBased?.());
        } catch (error) { return tratarValidacao(res, error); }

        await GuildRepository.setLogChannel({ guildId: req.params.guildId, channelId });

        res.json({ ok: true });

    });

    router.post("/guilds/:guildId/logs/categoria", async (req, res) => {

        const { key, enabled } = req.body || {};

        if (!LOG_CATEGORIES[key]) return res.status(400).json({ error: "Categoria inválida." });

        await GuildRepository.setCategoryEnabled(req.params.guildId, key, !!enabled);

        res.json({ ok: true });

    });

    /*
    =========================
        CRIADORES — EMBED / CONTAINER
    =========================
    */

    router.post("/guilds/:guildId/embed/send", async (req, res) => {

        if (!await exigirGerenciarMensagens(req, res)) return;

        try {
            const data = validarEmbedPainel(req.body);
            const canal = obterCanalTexto(req.painelGuild, req.body?.channelId);

            if (!canal) return res.status(400).json({ error: "Canal de texto inválido." });
            if (!canal.permissionsFor(req.painelGuild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
                return res.status(403).json({ error: "A Nina não pode enviar mensagens nesse canal." });
            }

            const embed = EmbedPreview.build(data);
            await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
            res.json({ ok: true });
        } catch (error) {
            if (error instanceof ErroValidacao) return tratarValidacao(res, error);
            console.error("[Painel] Falha ao enviar embed:", error);
            res.status(500).json({ error: "Não consegui enviar a embed." });
        }
    });

    router.post("/guilds/:guildId/container/send", async (req, res) => {

        if (!await exigirGerenciarMensagens(req, res)) return;

        try {
            const canal = obterCanalTexto(req.painelGuild, req.body?.channelId);
            if (!canal) return res.status(400).json({ error: "Canal de texto inválido." });
            if (!canal.permissionsFor(req.painelGuild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
                return res.status(403).json({ error: "A Nina não pode enviar mensagens nesse canal." });
            }

            const data = ContainerManager.normalize(req.body?.container || {});
            const problem = ContainerManager.fits(data);
            if (problem) return res.status(400).json({ error: problem });

            await canal.send(ContainerManager.message(data, false));
            res.json({ ok: true });
        } catch (error) {
            console.error("[Painel] Falha ao enviar container:", error);
            res.status(500).json({ error: "Não consegui enviar o container." });
        }
    });

    /*
    =========================
        SORTEIOS
    =========================
    */

    router.get("/guilds/:guildId/giveaways", async (req, res) => {

        res.json({ giveaways: await GiveawayRepository.listRunningByGuild(req.params.guildId) });

    });

    router.post("/guilds/:guildId/giveaways/:id/cancel", async (req, res) => {

        const giveaway = await GiveawayRepository.get(req.params.id);

        if (!giveaway || giveaway.guild_id !== req.params.guildId) {

            return res.status(404).json({ error: "Sorteio não encontrado." });

        }

        await GiveawayRepository.setStatus(giveaway.id, "cancelled");

        try {

            const canal = await req.painelGuild.channels.fetch(giveaway.channel_id);

            if (canal && giveaway.message_id) {

                const mensagem = await canal.messages.fetch(giveaway.message_id);
                await mensagem.edit({ content: "🎉 **SORTEIO CANCELADO** (via painel) 🎉", embeds: [], components: [] });

            }

        } catch {
            // canal/mensagem pode não existir mais
        }

        res.json({ ok: true });

    });

    return router;

};
