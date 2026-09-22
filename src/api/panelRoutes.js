const router = require("express").Router();

const GuildRepository = require("../database/repositories/GuildRepository");
const AutomodRepository = require("../database/repositories/AutomodRepository");
const WelcomeRepository = require("../database/repositories/WelcomeRepository");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const GiveawayRepository = require("../database/repositories/GiveawayRepository");
const { CATEGORIES: LOG_CATEGORIES } = require("../managers/LogCategories");

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

        const permitido = [
            "enabled", "ignored_channels", "ignored_roles", "mute_duration_minutes",
            "spam_enabled", "spam_max_messages", "spam_interval_seconds", "spam_actions",
            "emoji_enabled", "emoji_max_count", "emoji_actions",
            "swear_enabled", "swear_actions", "swear_custom_words",
            "mention_enabled", "mention_max_count", "mention_actions",
            "invite_enabled", "invite_actions",
            "raid_enabled", "raid_join_threshold", "raid_interval_seconds", "raid_action"
        ];

        const campos = {};

        for (const chave of permitido) {

            if (req.body[chave] !== undefined) campos[chave] = req.body[chave];

        }

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

        const permitido = ["enabled", "channel_id", "background_url", "title_text", "subtitle_text", "message_content", "accent_color"];
        const campos = {};

        for (const chave of permitido) {

            if (req.body[chave] !== undefined) campos[chave] = req.body[chave];

        }

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

        const roleIds = await AutoroleRepository.addJoinRole(req.params.guildId, roleId);

        res.json({ roleIds });

    });

    router.delete("/guilds/:guildId/autorole/:roleId", async (req, res) => {

        const roleIds = await AutoroleRepository.removeJoinRole(req.params.guildId, req.params.roleId);

        res.json({ roleIds });

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

        const { channelId } = req.body || {};

        await GuildRepository.setLogChannel({ guildId: req.params.guildId, channelId: channelId || null });

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
