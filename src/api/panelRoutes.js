const { E } = require("../config/emojiRegistry");
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
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const EmbedUtils = require("../interactions/embed/EmbedUtils");
const EmbedPreview = require("../interactions/embed/EmbedPreview");
const ContainerManager = require("../managers/ContainerManager");
const ServerStatsRepository = require("../database/repositories/ServerStatsRepository");
const ServerStatsManager = require("../managers/ServerStatsManager");
const AntiNukeRepository = require("../database/repositories/AntiNukeRepository");
const SecurityRepository = require("../database/repositories/SecurityRepository");
const SecurityManager = require("../managers/SecurityManager");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");
const TempVoiceManager = require("../managers/TempVoiceManager");
const LockdownRepository = require("../database/repositories/LockdownRepository");
const VoiceRecordingRepository = require("../database/repositories/VoiceRecordingRepository");
const VoiceRecordingManager = require("../managers/VoiceRecordingManager");
const RecordingApi = require("../services/RecordingService");
const { Readable } = require("node:stream");
const LockdownManager = require("../managers/LockdownManager");
const AutorolePanelManager = require("../managers/AutorolePanelManager");
const { normalizeReactionEmoji } = require("../utils/reactionEmoji");
const AnalyticsRepository = require("../database/repositories/AnalyticsRepository");

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

    if (b.mode !== undefined) {
        if (!["thread", "channel"].includes(b.mode)) throw new ErroValidacao("Modo de ticket inválido.");
        campos.mode = b.mode;
    }

    if (b.category_id !== undefined) {
        campos.category_id = idOpcional("category_id", b.category_id, id => guild.channels.cache.get(id)?.type === ChannelType.GuildCategory);
    }

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

        const lockdownChannels = guild.channels.cache
            .filter(channel => !channel.isThread?.() && (
                [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)
            ))
            .map(channel => ({ id: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId }));
        const categories = guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildCategory)
            .map(channel => ({ id: channel.id, name: channel.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ size: 128 }),
            memberCount: guild.memberCount,
            channels,
            lockdownChannels,
            categories,
            roles
        });

    });

    // Analytics agregado por servidor. O middleware requireGuildAccess já validou a sessão e o acesso.
    router.get("/guilds/:guildId/analytics/export", async (req, res) => {
        try {
            const requestedDays = Number.parseInt(req.query.days, 10) || 30;
            const days = [7, 14, 30, 90].includes(requestedDays) ? requestedDays : 30;
            const csv = await AnalyticsRepository.exportCsv(req.painelGuild.id, days);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="analytics-${days}d.csv"`);
            res.send("\uFEFF" + csv);
        } catch (error) {
            console.error("[Painel Analytics] Falha ao exportar:", error);
            res.status(500).json({ error: "Não foi possível exportar o Analytics." });
        }
    });

    router.get("/guilds/:guildId/analytics", async (req, res) => {
        try {
            const requestedDays = Number.parseInt(req.query.days, 10) || 7;
            const days = [7, 14, 30, 90].includes(requestedDays) ? requestedDays : 7;
            const analytics = await AnalyticsRepository.getAnalytics(
                req.painelGuild.id,
                days,
                req.painelGuild
            );
            res.json(analytics);
        } catch (error) {
            console.error("[Painel Analytics] Falha ao consultar dados:", error);
            res.status(500).json({ error: "Não foi possível carregar o Analytics deste servidor." });
        }
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

    router.get("/guilds/:guildId/autorole/selfroles", async (req, res) => {
        res.json({
            roles: await AutoroleRepository.listSelfRoles(req.params.guildId),
            reactions: await AutoroleRepository.listReactionRoles(req.params.guildId)
        });
    });

    router.post("/guilds/:guildId/autorole/selfroles", async (req, res) => {
        const roleId = String(req.body?.roleId || "");
        const role = req.painelGuild.roles.cache.get(roleId);
        const botRole = req.painelGuild.members.me?.roles?.highest;
        if (!role || role.managed || role.id === req.params.guildId) {
            return res.status(400).json({ error: "Cargo inválido." });
        }
        if (!req.painelGuild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            (botRole && role.comparePositionTo(botRole) >= 0)) {
            return res.status(400).json({ error: "A Nina precisa estar acima desse cargo para atribuí-lo." });
        }
        let label;
        let emoji = null;
        try {
            label = texto("label", req.body?.label || role.name, 80);
            if (req.body?.emoji) emoji = texto("emoji", req.body.emoji, 100);
        } catch (error) {
            return tratarValidacao(res, error);
        }
        const current = await AutoroleRepository.listSelfRoles(req.params.guildId);
        if (current.length >= 25 && !current.some(item => item.role_id === roleId)) {
            return res.status(400).json({ error: "O painel de botões aceita no máximo 25 cargos." });
        }
        await AutoroleRepository.addSelfRole(req.params.guildId, roleId, label, emoji);
        res.json({ roles: await AutoroleRepository.listSelfRoles(req.params.guildId) });
    });

    router.delete("/guilds/:guildId/autorole/selfroles/:roleId", async (req, res) => {
        await AutoroleRepository.removeSelfRole(req.params.guildId, req.params.roleId);
        res.json({ roles: await AutoroleRepository.listSelfRoles(req.params.guildId) });
    });

    router.post("/guilds/:guildId/autorole/selfroles/panel", async (req, res) => {
        const channelId = String(req.body?.channelId || "");
        const channel = req.painelGuild.channels.cache.get(channelId);
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
            return res.status(400).json({ error: "Canal de texto ou anúncios inválido." });
        }
        const roles = await AutoroleRepository.listSelfRoles(req.params.guildId);
        let title;
        let description;
        try {
            title = req.body?.title ? texto("title", req.body.title, 256) : undefined;
            description = req.body?.description ? texto("description", req.body.description, 2000) : undefined;
        } catch (error) {
            return tratarValidacao(res, error);
        }
        try {
            const message = await AutorolePanelManager.send(channel, roles, { title, description });
            return res.json({ messageId: message.id, channelId: channel.id });
        } catch (error) {
            console.error(`[Panel:Autorole:${req.params.guildId}] Falha ao publicar painel:`, error);
            return res.status(400).json({ error: error.message });
        }
    });

    router.get("/guilds/:guildId/autorole/reactions", async (req, res) => {
        res.json({ reactions: await AutoroleRepository.listReactionRoles(req.params.guildId) });
    });

    router.post("/guilds/:guildId/autorole/reactions", async (req, res) => {
        const body = req.body || {};
        const channelId = String(body.channelId || "");
        const messageId = String(body.messageId || "");
        const roleId = String(body.roleId || "");
        const emoji = String(body.emoji || "").trim();
        const channel = req.painelGuild.channels.cache.get(channelId);
        const role = req.painelGuild.roles.cache.get(roleId);
        const botRole = req.painelGuild.members.me?.roles?.highest;

        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
            return res.status(400).json({ error: "Canal de texto ou anúncios inválido." });
        }
        if (!SNOWFLAKE.test(messageId)) return res.status(400).json({ error: "ID da mensagem inválido." });
        if (!role || role.managed || role.id === req.params.guildId) {
            return res.status(400).json({ error: "Cargo inválido." });
        }
        if (!req.painelGuild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            (botRole && role.comparePositionTo(botRole) >= 0)) {
            return res.status(400).json({ error: "A Nina precisa estar acima desse cargo para atribuí-lo." });
        }

        let emojiKey;
        try {
            emojiKey = normalizeReactionEmoji(emoji);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        try {
            const message = await channel.messages.fetch(messageId);
            if (message.guildId !== req.params.guildId) {
                return res.status(400).json({ error: "A mensagem precisa pertencer a este servidor." });
            }
            await message.react(emoji);
            await AutoroleRepository.addReactionRole(req.params.guildId, channel.id, message.id, role.id, emojiKey);
            return res.json({ reactions: await AutoroleRepository.listReactionRoles(req.params.guildId) });
        } catch (error) {
            console.error(`[Panel:Autorole:${req.params.guildId}] Falha ao adicionar reação:`, error);
            return res.status(400).json({ error: error.message });
        }
    });

    router.delete("/guilds/:guildId/autorole/reactions/:id", async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "ID de regra inválido." });
        const existing = (await AutoroleRepository.listReactionRoles(req.params.guildId)).some(rule => rule.id === id);
        if (!existing) return res.status(404).json({ error: "Regra de reação não encontrada." });
        await AutoroleRepository.removeReactionRole(req.params.guildId, id);
        res.json({ reactions: await AutoroleRepository.listReactionRoles(req.params.guildId) });
    });

    router.get("/guilds/:guildId/lockdown", async (req, res) => {
        res.json(await LockdownRepository.get(req.params.guildId));
    });

    router.post("/guilds/:guildId/lockdown", async (req, res) => {
        const guild = req.painelGuild;
        const current = await LockdownRepository.get(guild.id);
        if (current.active) return res.status(409).json({ error: "Destranque os canais antes de alterar a configuração." });

        const body = req.body || {};
        const fields = {};
        try {
            if (body.enabled !== undefined) {
                if (![true, false, 0, 1, "true", "false"].includes(body.enabled)) {
                    throw new ErroValidacao('"enabled" precisa ser verdadeiro ou falso.');
                }
                fields.enabled = bool(body.enabled);
            }
            for (const [input, output, isCategory] of [
                ["channelIds", "channel_ids", false],
                ["categoryIds", "category_ids", true]
            ]) {
                if (body[input] === undefined) continue;
                const ids = [...new Set(listaCsv(body[input]))];
                if (ids.length > 25 || ids.some(id => !SNOWFLAKE.test(id))) {
                    throw new ErroValidacao(`"${input}" aceita até 25 IDs válidos.`);
                }
                const valid = ids.every(id => {
                    const channel = guild.channels.cache.get(id);
                    return isCategory
                        ? channel?.type === ChannelType.GuildCategory
                        : channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type);
                });
                if (!valid) throw new ErroValidacao(`"${input}" contém um canal inválido para este servidor.`);
                fields[output] = ids;
            }
            for (const [input, output] of [
                ["allowedRoleIds", "allowed_role_ids"],
                ["deniedRoleIds", "denied_role_ids"]
            ]) {
                if (body[input] === undefined) continue;
                const ids = [...new Set(listaCsv(body[input]))];
                if (ids.length > 25 || ids.some(id => !SNOWFLAKE.test(id))) {
                    throw new ErroValidacao(`"${input}" aceita até 25 IDs válidos.`);
                }
                if (ids.some(id => id === guild.id || !guild.roles.cache.has(id))) {
                    throw new ErroValidacao(`"${input}" contém um cargo inválido; @everyone não pode ser selecionado.`);
                }
                fields[output] = ids;
            }
        } catch (error) {
            return tratarValidacao(res, error);
        }

        const allowedRoleIds = fields.allowed_role_ids || current.allowed_role_ids;
        const deniedRoleIds = fields.denied_role_ids || current.denied_role_ids;
        if (allowedRoleIds.some(id => deniedRoleIds.includes(id))) {
            return res.status(400).json({ error: "Um cargo não pode aparecer nas listas de acesso permitido e negado." });
        }

        try {
            return res.json(await LockdownManager.configure(guild.id, fields));
        } catch (error) {
            if (error.message.includes("Destranque")) return res.status(409).json({ error: error.message });
            console.error(`[Panel:Lockdown:${guild.id}] Falha ao salvar configuração:`, error);
            return res.status(500).json({ error: error.message });
        }
    });

    router.post("/guilds/:guildId/lockdown/:action", async (req, res) => {
        if (!["lock", "unlock"].includes(req.params.action)) {
            return res.status(404).json({ error: "Ação de lockdown inválida." });
        }
        let member;
        try {
            member = await req.painelGuild.members.fetch(req.painelSessao.user.id);
        } catch {
            return res.status(403).json({ error: "Não consegui confirmar sua permissão para gerenciar canais." });
        }
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return res.status(403).json({ error: "Você precisa da permissão Gerenciar Canais para esta ação." });
        }

        try {
            const result = req.params.action === "lock"
                ? await LockdownManager.lock(req.painelGuild, "Lockdown iniciado pelo painel web.")
                : await LockdownManager.restore(req.painelGuild, "Lockdown encerrado pelo painel web.");
            return res.json({ ...result, config: await LockdownManager.getConfig(req.params.guildId) });
        } catch (error) {
            console.error(`[Panel:Lockdown:${req.params.guildId}] Falha ao executar ${req.params.action}:`, error);
            return res.status(500).json({ error: error.message });
        }
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
                   COALESCE(SUM(wallet + bank), 0) AS totalWealth
            FROM economy_global_users
        `);
        const levelStats = await database.get(`
            SELECT COALESCE(SUM(xp), 0) AS totalXp
            FROM economy_users WHERE guild_id = ?
        `, [guildId]);
        stats.totalXp = Number(levelStats?.totalXp || 0);
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

        res.json({
            channelId: settings.log_channel || null,
            statsLogsEnabled: !!settings.stats_logs_enabled,
            categories
        });

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

    router.post("/guilds/:guildId/logs/stats", async (req, res) => {

        await GuildRepository.setStatsLogsEnabled(req.params.guildId, !!(req.body || {}).enabled);
        res.json({ ok: true, enabled: await GuildRepository.isStatsLogsEnabled(req.params.guildId) });

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
        STATS DO SERVIDOR
    =========================
    */

    router.get("/guilds/:guildId/stats", async (req, res) => {
        const config = await ServerStatsRepository.get(req.params.guildId);
        const values = ServerStatsManager.getValues(req.painelGuild, req.painelGuild.client);
        res.json({ config, values, counters: ServerStatsManager.COUNTERS });
    });

    router.post("/guilds/:guildId/stats", async (req, res) => {
        const guild = req.painelGuild;
        const body = req.body || {};
        const allowed = ["members", "bots", "online", "offline", "voice", "channels", "categories", "roles", "servers"];

        try {
            if (body.enabled !== undefined) {
                if (body.enabled) await ServerStatsManager.enable(guild);
                else await ServerStatsManager.disable(guild, { remove: true });
            }

            if (body.counter && allowed.includes(body.counter)) {
                await ServerStatsRepository.setCounter(guild.id, body.counter, !!body.active);
            }

            const config = await ServerStatsRepository.get(guild.id);
            if (config.enabled) await ServerStatsManager.createOrUpdate(guild);

            res.json({
                config: await ServerStatsRepository.get(guild.id),
                values: ServerStatsManager.getValues(guild, guild.client)
            });
        } catch (error) {
            console.error("[Painel] Falha ao atualizar stats:", error);
            res.status(500).json({ error: "Não consegui atualizar os contadores." });
        }
    });

    router.post("/guilds/:guildId/stats/update", async (req, res) => {
        try {
            await ServerStatsManager.updateGuild(req.painelGuild);
            res.json({ ok: true, values: ServerStatsManager.getValues(req.painelGuild, req.painelGuild.client) });
        } catch (error) {
            console.error("[Painel] Falha ao atualizar stats agora:", error);
            res.status(500).json({ error: "Não consegui atualizar os contadores." });
        }
    });

    /*
    =========================
        TEMPVOICE
    =========================
    */

    router.get("/guilds/:guildId/tempvoice", async (req, res) => {
        const guild = req.painelGuild;
        const config = await TempVoiceRepository.get(guild.id);
        const rooms = await TempVoiceRepository.getRooms(guild.id);

        const voiceChannels = guild.channels.cache
            .filter(c => c.type === 2)
            .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const categories = guild.channels.cache
            .filter(c => c.type === 4)
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
            .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

        const roomData = rooms.map(room => {
            const channel = guild.channels.cache.get(room.channel_id);
            const owner = guild.members.cache.get(room.owner_id);
            return {
                channelId: room.channel_id,
                name: channel?.name || "Sala removida",
                ownerId: room.owner_id,
                ownerName: owner?.displayName || owner?.user?.username || room.owner_id,
                members: channel?.members?.size || 0,
                limit: channel?.userLimit || 0,
                locked: !!room.locked,
                createdAt: room.created_at || null
            };
        });

        res.json({
            config,
            voiceChannels,
            categories,
            roles,
            rooms: roomData
        });
    });

    router.post("/guilds/:guildId/tempvoice", async (req, res) => {
        const guild = req.painelGuild;
        const body = req.body || {};

        try {
            const values = {};

            if (body.enabled !== undefined) values.enabled = bool(body.enabled);
            if (body.auto_lock !== undefined) values.auto_lock = bool(body.auto_lock);
            if (body.admin_manage !== undefined) values.admin_manage = bool(body.admin_manage);

            if (body.default_limit !== undefined) {
                values.default_limit = inteiro("default_limit", body.default_limit, 0, 99);
            }

            if (body.name_template !== undefined) {
                const template = String(body.name_template ?? "").trim();
                if (!template) throw new ErroValidacao('"name_template" não pode ficar vazio.');
                if (template.length > 90) throw new ErroValidacao('"name_template" aceita no máximo 90 caracteres.');
                values.name_template = template;
            }

            if (body.trigger_channel_id !== undefined) {
                values.trigger_channel_id = idOpcional(
                    "trigger_channel_id",
                    body.trigger_channel_id,
                    id => guild.channels.cache.get(id)?.type === 2
                );
            }

            if (body.category_id !== undefined) {
                values.category_id = idOpcional(
                    "category_id",
                    body.category_id,
                    id => guild.channels.cache.get(id)?.type === 4
                );
            }

            if (body.manager_role_id !== undefined) {
                values.manager_role_id = idOpcional(
                    "manager_role_id",
                    body.manager_role_id,
                    id => {
                        const role = guild.roles.cache.get(id);
                        return !!role && !role.managed && role.id !== guild.id;
                    }
                );
            }

            for (const key of [
                "owner_rename", "owner_lock", "owner_limit", "owner_kick",
                "owner_ban", "owner_transfer", "owner_delete"
            ]) {
                if (body[key] !== undefined) values[key] = bool(body[key]);
            }

            await TempVoiceManager.configure(guild, values);
            res.json({ ok: true, config: await TempVoiceRepository.get(guild.id) });
        } catch (error) {
            console.error("[Painel] Falha ao atualizar TempVoice:", error);
            return tratarValidacao(res, error);
        }
    });

    router.post("/guilds/:guildId/tempvoice/setup", async (req, res) => {
        try {
            const result = await TempVoiceManager.setup(req.painelGuild, {
                categoryId: req.body?.category_id || null,
                triggerChannelId: req.body?.trigger_channel_id || null
            });

            const config = await TempVoiceManager.configure(req.painelGuild, {
                enabled: true,
                category_id: result.category.id,
                trigger_channel_id: result.trigger.id
            });

            res.json({ ok: true, config });
        } catch (error) {
            console.error("[Painel] Falha ao criar estrutura do TempVoice:", error);
            res.status(400).json({ error: error.message || "Não consegui criar a estrutura do TempVoice." });
        }
    });

    router.post("/guilds/:guildId/tempvoice/disable", async (req, res) => {
        try {
            await TempVoiceManager.disable(req.painelGuild);
            res.json({ ok: true, config: await TempVoiceRepository.get(req.painelGuild.id) });
        } catch (error) {
            console.error("[Painel] Falha ao desativar TempVoice:", error);
            res.status(500).json({ error: "Não consegui desativar o TempVoice." });
        }
    });

    /*
    =========================
        GRAVAÇÃO DE CALLS
    =========================
    Tudo filtrado por guildId: cada servidor só enxerga as próprias gravações.
    O painel web já exige Gerenciar Servidor (requireGuildAccess).
    */

    const UUID = /^[0-9a-f-]{36}$/i;

    async function gravacaoDoServidor(req, res) {
        const id = String(req.params.id || "");

        if (!UUID.test(id)) {
            res.status(400).json({ error: "ID de gravação inválido." });
            return null;
        }

        const gravacao = await VoiceRecordingRepository.getRecording(req.painelGuild.id, id);

        if (!gravacao) {
            res.status(404).json({ error: "Gravação não encontrada neste servidor." });
            return null;
        }

        return gravacao;
    }

    function erroGravacao(res, error) {
        if (error instanceof RecordingApi.RecordingApiError) {
            if (error.code === "unsupported") return res.status(409).json({ error: "Esta gravação não tem áudio guardado: só a transcrição fica salva." });

            const status = error.code === "not_found" ? 404 : 502;
            return res.status(status).json({ error: status === 404 ? "A gravação não existe mais no serviço de áudio." : "O serviço de gravação está indisponível agora." });
        }

        console.error("[Painel] Erro em gravação:", error);
        return res.status(500).json({ error: "Não consegui concluir essa ação agora." });
    }

    router.get("/guilds/:guildId/recordings", async (req, res) => {
        const guild = req.painelGuild;
        const [config, recordings] = await Promise.all([
            VoiceRecordingRepository.get(guild.id),
            VoiceRecordingRepository.list(guild.id, 100)
        ]);

        const voiceChannels = guild.channels.cache
            .filter(c => c.type === 2 || c.type === 13)
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
            .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

        const ativa = VoiceRecordingManager.getSession(guild.id);

        res.json({
            config,
            apiConfigured: RecordingApi.isConfigured(),
            maxMinutesOptions: VoiceRecordingRepository.MAX_MINUTES_OPTIONS,
            voiceChannels,
            roles,
            active: ativa ? { channelId: ativa.channel.id, channelName: ativa.channel.name, startedAt: ativa.startedAt, startedBy: ativa.startedBy } : null,
            recordings: recordings.map(r => ({
                id: r.id,
                channelId: r.channel_id,
                channelName: r.channel_name,
                startedBy: r.started_by,
                startedByName: r.started_by_name,
                startedAt: r.started_at,
                endedAt: r.ended_at,
                durationMs: r.duration_ms,
                sizeBytes: r.size_bytes,
                status: r.status,
                transcriptStatus: r.transcript_status,
                hasAudio: RecordingApi.supportsAudio(r.remote_id),
                participants: r.participants.length
            }))
        });
    });

    router.post("/guilds/:guildId/recordings/config", async (req, res) => {
        const guild = req.painelGuild;
        const body = req.body || {};

        try {
            const values = {};

            if (body.enabled !== undefined) {
                values.enabled = bool(body.enabled);

                if (values.enabled && !RecordingApi.isConfigured()) {
                    throw new ErroValidacao("A transcrição ainda não foi configurada no host (defina TRANSCRIPTION_GROQ_API_KEY).");
                }
            }

            if (body.max_minutes !== undefined) {
                const minutos = inteiro("max_minutes", body.max_minutes, 1, 1000);
                if (!VoiceRecordingRepository.MAX_MINUTES_OPTIONS.includes(minutos)) {
                    throw new ErroValidacao(`"max_minutes" precisa ser um de: ${VoiceRecordingRepository.MAX_MINUTES_OPTIONS.join(", ")}.`);
                }
                values.max_minutes = minutos;
            }

            const listaIds = (nome, valor, existe) => {
                const ids = [...new Set(listaCsv(valor))];
                if (ids.length > 25 || ids.some(id => !SNOWFLAKE.test(id) || !existe(id))) {
                    throw new ErroValidacao(`"${nome}" contém itens inválidos para este servidor.`);
                }
                return ids;
            };

            const canalDeVoz = id => [2, 13].includes(guild.channels.cache.get(id)?.type);

            if (body.allowed_role_ids !== undefined) {
                values.allowed_role_ids = listaIds("allowed_role_ids", body.allowed_role_ids, id => {
                    const cargo = guild.roles.cache.get(id);
                    return !!cargo && cargo.id !== guild.id;
                });
            }

            if (body.allowed_channel_ids !== undefined) {
                values.allowed_channel_ids = listaIds("allowed_channel_ids", body.allowed_channel_ids, canalDeVoz);
            }

            if (body.blocked_channel_ids !== undefined) {
                values.blocked_channel_ids = listaIds("blocked_channel_ids", body.blocked_channel_ids, canalDeVoz);
            }

            res.json({ ok: true, config: await VoiceRecordingRepository.update(guild.id, values) });
        } catch (error) {
            return tratarValidacao(res, error);
        }
    });

    router.post("/guilds/:guildId/recordings/:id/transcribe", async (req, res) => {
        const gravacao = await gravacaoDoServidor(req, res);
        if (!gravacao) return;

        try {
            const atual = await VoiceRecordingManager.refreshRecording(gravacao);

            if (atual.status !== "ready") return res.status(409).json({ error: "O áudio ainda não está pronto." });
            if (atual.transcript_status === "pending") return res.status(409).json({ error: "A transcrição já está em andamento." });
            if (atual.transcript_status === "ready") return res.status(409).json({ error: "Esta gravação já foi transcrita." });

            await VoiceRecordingManager.requestTranscription(atual);
            res.json({ ok: true });
        } catch (error) {
            return erroGravacao(res, error);
        }
    });

    router.get("/guilds/:guildId/recordings/:id/status", async (req, res) => {
        const gravacao = await gravacaoDoServidor(req, res);
        if (!gravacao) return;

        const atual = await VoiceRecordingManager.refreshRecording(gravacao);
        res.json({ status: atual.status, transcriptStatus: atual.transcript_status, durationMs: atual.duration_ms, sizeBytes: atual.size_bytes });
    });

    router.get("/guilds/:guildId/recordings/:id/audio", async (req, res) => {
        const gravacao = await gravacaoDoServidor(req, res);
        if (!gravacao) return;

        try {
            const atual = await VoiceRecordingManager.refreshRecording(gravacao);
            if (!RecordingApi.supportsAudio(atual.remote_id)) return res.status(409).json({ error: "Esta gravação não tem áudio guardado: só a transcrição fica salva." });
            if (atual.status !== "ready") return res.status(409).json({ error: "O áudio ainda não está pronto." });

            const origem = await RecordingApi.openAudio(atual.remote_id);
            const tipo = origem.headers.get("content-type") || "audio/ogg";

            res.setHeader("Content-Type", tipo);
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Content-Disposition", `attachment; filename="gravacao-${VoiceRecordingManager.fileStamp(atual)}.${tipo.includes("mpeg") ? "mp3" : tipo.includes("wav") ? "wav" : "ogg"}"`);

            const tamanho = origem.headers.get("content-length");
            if (tamanho) res.setHeader("Content-Length", tamanho);

            // Repassa em stream: o áudio passa pela memória, nunca pelo disco.
            Readable.fromWeb(origem.body).on("error", () => res.destroy()).pipe(res);
        } catch (error) {
            return erroGravacao(res, error);
        }
    });

    router.get("/guilds/:guildId/recordings/:id/transcript", async (req, res) => {
        const gravacao = await gravacaoDoServidor(req, res);
        if (!gravacao) return;

        try {
            const atual = await VoiceRecordingManager.refreshRecording(gravacao);
            const arquivo = await VoiceRecordingManager.buildTranscriptFile(req.painelGuild, atual);

            if (!arquivo.ready) return res.status(409).json({ error: "A transcrição ainda não está pronta." });

            if (atual.transcript_status !== "ready") {
                await VoiceRecordingRepository.patch(atual.guild_id, atual.id, { transcript_status: "ready" });
            }

            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Content-Disposition", `attachment; filename="transcricao-${VoiceRecordingManager.fileStamp(atual)}.txt"`);
            res.send(arquivo.buffer);
        } catch (error) {
            return erroGravacao(res, error);
        }
    });

    router.delete("/guilds/:guildId/recordings/:id", async (req, res) => {
        const gravacao = await gravacaoDoServidor(req, res);
        if (!gravacao) return;

        if (gravacao.status === "recording") {
            return res.status(409).json({ error: "Pare a gravação antes de excluí-la." });
        }

        try {
            if (gravacao.remote_id) {
                try {
                    await RecordingApi.remove(gravacao.remote_id);
                } catch (error) {
                    // Já removida no serviço de áudio: segue e apaga o registro local.
                    if (error.code !== "not_found") throw error;
                }
            }

            await VoiceRecordingRepository.remove(req.painelGuild.id, gravacao.id);
            res.json({ ok: true });
        } catch (error) {
            return erroGravacao(res, error);
        }
    });

    /*
    =========================
        ANTI-NUKE
    =========================
    */

    router.get("/guilds/:guildId/antinuke", async (req, res) => {
        res.json({ config: await AntiNukeRepository.get(req.params.guildId) });
    });

    router.post("/guilds/:guildId/antinuke", async (req, res) => {
        const b = req.body || {};
        const fields = {};

        if (b.enabled !== undefined) fields.enabled = bool(b.enabled);
        if (b.action !== undefined) {
            if (!["ban", "strip"].includes(String(b.action))) return res.status(400).json({ error: "Ação inválida." });
            fields.action = String(b.action);
        }
        for (const [key, min, max] of [
            ["window_seconds", 5, 60],
            ["channel_limit", 2, 20],
            ["role_limit", 2, 20],
            ["member_limit", 2, 20],
            ["bot_limit", 1, 20],
            ["webhook_limit", 2, 20]
        ]) {
            if (b[key] !== undefined) {
                try { fields[key] = inteiro(key, b[key], min, max); }
                catch (error) { return tratarValidacao(res, error); }
            }
        }

        await AntiNukeRepository.update(req.params.guildId, fields);
        res.json({ config: await AntiNukeRepository.get(req.params.guildId) });
    });

    /*
    =========================
        SECURITY CENTER (HONEYPOT + TOPICGUARD)
    =========================
    */

    const canalTexto = c => c?.isTextBased?.() && !c.isThread?.() && !c.isVoiceBased?.();

    async function payloadSeguranca(guild) {
        const [config, rules, events] = await Promise.all([
            SecurityRepository.get(guild.id),
            SecurityRepository.listRules(guild.id),
            SecurityRepository.listEvents(guild.id, 15)
        ]);

        const channels = guild.channels.cache
            .filter(canalTexto)
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => ({ id: r.id, name: r.name, position: r.position }))
            .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

        let ignoredRoles = [];
        try { ignoredRoles = JSON.parse(config.ignored_roles || "[]"); } catch { }

        const { honeypot_message_id, honeypot_notice_channel_id, ignored_roles, ...publico } = config;

        return {
            config: { ...publico, ignored_roles: ignoredRoles, notice_published: !!honeypot_message_id },
            rules: rules.map(r => ({ id: r.id, channel_id: r.channel_id, topic: r.topic, keywords: r.keywords, enabled: !!r.enabled })),
            events: events.map(e => ({ id: e.id, type: e.event_type, user_id: e.user_id, channel_id: e.channel_id, reason: e.reason, created_at: e.created_at })),
            channels,
            roles,
            contextAvailable: !!process.env.GROQ_API_KEY,
            actions: SecurityRepository.HONEYPOT_ACTIONS.map(value => ({ value, label: SecurityManager.HONEYPOT_ACTION_LABELS[value] })),
            noticePreview: SecurityManager.honeypotNoticeText(config.honeypot_action),
            issues: config.honeypot_enabled ? SecurityManager.honeypotDiagnostics(guild, config) : []
        };
    }

    router.get("/guilds/:guildId/security", async (req, res) => {
        res.json(await payloadSeguranca(req.painelGuild));
    });

    router.post("/guilds/:guildId/security", async (req, res) => {
        const guild = req.painelGuild;
        const b = req.body || {};
        const atual = await SecurityRepository.get(guild.id);
        const campos = {};

        try {
            for (const chave of ["topic_enabled", "contextual_enabled", "topic_warn_enabled", "topic_timeout_enabled", "behavior_enabled", "honeypot_enabled"]) {
                if (b[chave] !== undefined) campos[chave] = bool(b[chave]);
            }

            if (b.topic_timeout_minutes !== undefined) campos.topic_timeout_minutes = inteiro("topic_timeout_minutes", b.topic_timeout_minutes, 1, 60);

            if (b.honeypot_action !== undefined) {
                if (!SecurityRepository.HONEYPOT_ACTIONS.includes(String(b.honeypot_action))) throw new ErroValidacao('"honeypot_action" inválida.');
                campos.honeypot_action = String(b.honeypot_action);
            }

            if (b.honeypot_channel_id !== undefined) {
                campos.honeypot_channel_id = idOpcional("honeypot_channel_id", b.honeypot_channel_id, id => canalTexto(guild.channels.cache.get(id)));
            }

            if (b.alert_channel_id !== undefined) {
                campos.alert_channel_id = idOpcional("alert_channel_id", b.alert_channel_id, id => canalTexto(guild.channels.cache.get(id)));
            }

            if (b.ignored_roles !== undefined) {
                const ids = [...new Set(listaCsv(b.ignored_roles))].slice(0, 25);
                if (ids.some(id => !SNOWFLAKE.test(id) || !guild.roles.cache.has(id))) throw new ErroValidacao('"ignored_roles" contém cargos inexistentes.');
                campos.ignored_roles = JSON.stringify(ids);
            }

            const proximo = { ...atual, ...campos };

            if (campos.contextual_enabled && !process.env.GROQ_API_KEY) {
                throw new ErroValidacao("Configure GROQ_API_KEY no ambiente da Nina antes de ativar a análise contextual.");
            }
            if (proximo.honeypot_enabled && !proximo.honeypot_channel_id) {
                throw new ErroValidacao("Escolha o canal-isca antes de ativar o Honeypot.");
            }
            if (proximo.honeypot_channel_id && proximo.honeypot_channel_id === proximo.alert_channel_id) {
                throw new ErroValidacao("O canal-isca não pode ser o mesmo canal de alertas.");
            }
        } catch (error) { return tratarValidacao(res, error); }

        const mudouCanal = campos.honeypot_channel_id !== undefined && campos.honeypot_channel_id !== atual.honeypot_channel_id;
        const mudouAcao = campos.honeypot_action !== undefined && campos.honeypot_action !== atual.honeypot_action;
        const ligou = campos.honeypot_enabled === 1 && !atual.honeypot_enabled;

        // Trocou de canal: remove o aviso do canal antigo.
        if (mudouCanal && atual.honeypot_message_id) {
            const antigo = guild.channels.cache.get(atual.honeypot_notice_channel_id || atual.honeypot_channel_id);
            const msg = await antigo?.messages?.fetch?.(atual.honeypot_message_id).catch(() => null);
            await msg?.delete?.().catch(() => { });
            campos.honeypot_message_id = null;
            campos.honeypot_notice_channel_id = null;
        }

        const salvo = await SecurityRepository.update(guild.id, campos);

        let aviso = null;
        if (salvo.honeypot_enabled && salvo.honeypot_channel_id && (mudouCanal || mudouAcao || ligou || !salvo.honeypot_message_id)) {
            aviso = await SecurityManager.ensureHoneypotNotice(guild, salvo);
        }

        const dados = await payloadSeguranca(guild);
        res.json({ ...dados, notice: aviso ? { ok: aviso.ok, error: aviso.error || null } : null });
    });

    router.post("/guilds/:guildId/security/honeypot/notice", async (req, res) => {
        const guild = req.painelGuild;
        const config = await SecurityRepository.get(guild.id);
        if (!config.honeypot_channel_id) return res.status(400).json({ error: "Escolha o canal-isca primeiro." });
        const resultado = await SecurityManager.ensureHoneypotNotice(guild, config);
        if (!resultado.ok) return res.status(400).json({ error: resultado.error });
        res.json(await payloadSeguranca(guild));
    });

    router.post("/guilds/:guildId/security/rules", async (req, res) => {
        const guild = req.painelGuild;
        const b = req.body || {};
        let regra;

        try {
            const channelId = String(b.channel_id ?? "");
            if (!SNOWFLAKE.test(channelId) || !canalTexto(guild.channels.cache.get(channelId))) {
                throw new ErroValidacao('"channel_id" precisa ser um canal de texto deste servidor.');
            }
            const topic = String(b.topic ?? "").trim();
            if (!topic || topic.length > 80) throw new ErroValidacao('"topic" precisa ter de 1 a 80 caracteres.');
            const keywords = [...new Set(listaCsv(b.keywords))].slice(0, 30);
            if (!keywords.length || keywords.some(word => word.length > 80)) {
                throw new ErroValidacao("Informe ao menos uma palavra/expressão (até 80 caracteres cada).");
            }
            regra = { guildId: guild.id, channelId, topic, keywords };
        } catch (error) { return tratarValidacao(res, error); }

        const existentes = await SecurityRepository.listRules(guild.id);
        if (existentes.length >= 50) return res.status(400).json({ error: "Limite de 50 regras TopicGuard atingido." });

        await SecurityRepository.addRule(regra);
        await SecurityRepository.update(guild.id, { topic_enabled: 1 });
        res.json(await payloadSeguranca(guild));
    });

    router.post("/guilds/:guildId/security/rules/:id/toggle", async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "ID inválido." });
        await SecurityRepository.setRuleEnabled(req.painelGuild.id, id, bool(req.body?.enabled));
        res.json(await payloadSeguranca(req.painelGuild));
    });

    router.delete("/guilds/:guildId/security/rules/:id", async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "ID inválido." });
        await SecurityRepository.removeRule(req.painelGuild.id, id);
        res.json(await payloadSeguranca(req.painelGuild));
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
                await mensagem.edit({ content: `${E("ui_celebrating")} **SORTEIO CANCELADO** (via painel) ${E("ui_celebrating")}`, embeds: [], components: [] });

            }

        } catch {
            // canal/mensagem pode não existir mais
        }

        res.json({ ok: true });

    });

    return router;

};
