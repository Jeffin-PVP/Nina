const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const SecurityRepository = require("../src/database/repositories/SecurityRepository");
const SecurityManager = require("../src/managers/SecurityManager");

let counter = 0;
const nextId = () => `9990000000000${String(++counter).padStart(5, "0")}`;

function perms(...names) {
    const set = new Set(names.map(name => PermissionFlagsBits[name]));
    return { has: flag => set.has(flag) };
}

function makeEnv({ action = "ban", botPerms = ["BanMembers", "KickMembers", "ModerateMembers", "ManageMessages", "ViewChannel", "SendMessages"], bannable = true, admin = false, topicRules = null } = {}) {
    const guildId = nextId();
    const channelId = nextId();
    const alertId = nextId();
    const calls = { ban: [], kick: [], timeout: [], deleted: 0, sent: [], alerts: [], pinned: 0 };

    const alertChannel = {
        id: alertId, isTextBased: () => true, isThread: () => false,
        send: async payload => { calls.alerts.push(payload); return { id: "a1" }; }
    };
    const sentMessages = new Map();
    const channel = {
        id: channelId, name: "isca", parentId: null,
        isTextBased: () => true, isThread: () => false, isVoiceBased: () => false,
        permissionsFor: target => target === "everyone" ? perms("ViewChannel", "SendMessages") : perms(...botPerms),
        send: async payload => {
            const message = {
                id: nextId(), payload,
                pin: async () => { calls.pinned++; },
                delete: async () => { calls.deleted++; sentMessages.delete(message.id); }
            };
            calls.sent.push(message);
            sentMessages.set(message.id, message);
            return message;
        },
        messages: { fetch: async id => sentMessages.get(id) || null }
    };
    const me = { permissions: perms(...botPerms) };
    const guild = {
        id: guildId,
        channels: {
            cache: new Map([[channelId, channel], [alertId, alertChannel]]),
            fetch: async id => (id === channelId ? channel : null)
        },
        members: {
            me,
            fetchMe: async () => me,
            ban: async (id, options) => { calls.ban.push({ id, options }); }
        },
        roles: { everyone: "everyone", cache: new Map() }
    };
    const member = {
        displayName: "Alvo",
        permissions: admin ? perms("Administrator") : perms(),
        roles: { cache: new Map() },
        bannable, kickable: bannable, moderatable: bannable,
        kick: async reason => { calls.kick.push(reason); },
        timeout: async (ms, reason) => { calls.timeout.push({ ms, reason }); }
    };
    const message = {
        guild, channel, member,
        author: { id: nextId(), bot: false, username: "alvo" },
        content: "oi eu sou um bot",
        delete: async () => { calls.deleted++; }
    };
    return { guildId, channelId, alertId, guild, channel, member, message, calls, action };
}

async function configure(env, extra = {}) {
    return SecurityRepository.update(env.guildId, {
        honeypot_enabled: 1, honeypot_channel_id: env.channelId, honeypot_action: env.action,
        alert_channel_id: env.alertId, ...extra
    });
}

test("Honeypot: ação 'ban' apaga a mensagem, bane e alerta", async () => {
    const env = makeEnv({ action: "ban" });
    await configure(env);
    const handled = await SecurityManager.handleMessage(env.message);
    assert.equal(handled, true);
    assert.equal(env.calls.ban.length, 1);
    assert.equal(env.calls.ban[0].id, env.message.author.id);
    assert.equal(env.calls.deleted, 1);
    assert.equal(env.calls.alerts.length, 1);
    const events = await SecurityRepository.listEvents(env.guildId);
    assert.equal(events[0].event_type, "honeypot_triggered");
});

test("Honeypot: kick e timeout usam a ação configurada", async () => {
    const kick = makeEnv({ action: "kick" });
    await configure(kick);
    await SecurityManager.handleMessage(kick.message);
    assert.equal(kick.calls.kick.length, 1);
    assert.equal(kick.calls.ban.length, 0);

    const timeout = makeEnv({ action: "timeout" });
    await configure(timeout);
    await SecurityManager.handleMessage(timeout.message);
    assert.equal(timeout.calls.timeout.length, 1);
    assert.equal(timeout.calls.timeout[0].ms, 24 * 60 * 60 * 1000);
});

test("Honeypot: falha de hierarquia é registrada e não quebra o fluxo", async () => {
    const env = makeEnv({ action: "ban", bannable: false });
    await configure(env);
    const handled = await SecurityManager.handleMessage(env.message);
    assert.equal(handled, true);
    assert.equal(env.calls.ban.length, 0);
    const events = await SecurityRepository.listEvents(env.guildId);
    assert.equal(events[0].event_type, "honeypot_action_failed");
    assert.match(env.calls.alerts[0].content, /falhou/);
});

test("Honeypot: administradores são isentos e modo 'log' não pune nem apaga", async () => {
    const admin = makeEnv({ action: "ban", admin: true });
    await configure(admin);
    assert.equal(await SecurityManager.handleMessage(admin.message), false);
    assert.equal(admin.calls.ban.length, 0);

    const log = makeEnv({ action: "log" });
    await configure(log);
    assert.equal(await SecurityManager.handleMessage(log.message), true);
    assert.equal(log.calls.ban.length, 0);
    assert.equal(log.calls.deleted, 0);
    assert.equal(log.calls.alerts.length, 1);
});

test("Honeypot: desligado ou em outro canal não faz nada", async () => {
    const env = makeEnv();
    await configure(env, { honeypot_enabled: 0 });
    assert.equal(await SecurityManager.handleMessage(env.message), false);
    await configure(env, { honeypot_enabled: 1 });
    env.message.channel = { ...env.channel, id: nextId() };
    assert.equal(await SecurityManager.handleMessage(env.message), false);
    assert.equal(env.calls.ban.length, 0);
});

test("Honeypot: aviso é publicado, fixado e substituído sem duplicar", async () => {
    const env = makeEnv({ action: "ban" });
    const config = await configure(env);
    const first = await SecurityManager.ensureHoneypotNotice(env.guild, config);
    assert.equal(first.ok, true);
    assert.equal(env.calls.sent.length, 1);
    assert.equal(env.calls.pinned, 1);

    const saved = await SecurityRepository.get(env.guildId);
    assert.equal(saved.honeypot_message_id, first.message.id);

    const second = await SecurityManager.ensureHoneypotNotice(env.guild, saved);
    assert.equal(second.ok, true);
    assert.equal(env.calls.deleted, 1, "o aviso antigo deve ser apagado");

    const text = SecurityManager.honeypotNoticeText("ban");
    assert.match(text, /NÃO ENVIE NENHUMA MENSAGEM AQUI/);
    assert.match(text, /detectar contas automatizadas/);
    assert.match(text, /sanção automática \(\*\*Banimento\*\* — ação programada\)/);
});

test("Honeypot: aviso falha com mensagem clara sem permissão no canal", async () => {
    const env = makeEnv({ botPerms: ["BanMembers"] });
    const config = await configure(env);
    const result = await SecurityManager.ensureHoneypotNotice(env.guild, config);
    assert.equal(result.ok, false);
    assert.match(result.error, /Ver Canal/);
});

test("Honeypot: diagnóstico aponta permissões faltando", async () => {
    const env = makeEnv({ action: "ban", botPerms: ["ViewChannel", "SendMessages"] });
    const config = await configure(env);
    const issues = SecurityManager.honeypotDiagnostics(env.guild, config);
    assert.ok(issues.some(item => /Banir Membros/.test(item)));
    assert.ok(issues.some(item => /Gerenciar Mensagens/.test(item)));
    assert.ok(issues.some(item => /aviso ainda não foi publicado/.test(item)));
});

test("TopicGuard: remove assunto proibido só no canal da regra (inclui threads) e ignora o resto", async () => {
    const env = makeEnv();
    await SecurityRepository.update(env.guildId, { topic_enabled: 1 });
    await SecurityRepository.addRule({ guildId: env.guildId, channelId: env.channelId, topic: "Política", keywords: ["eleições", "candidato"] });

    env.message.content = "Quem é seu candidato favorito?";
    assert.equal(await SecurityManager.handleMessage(env.message), true);
    assert.equal(env.calls.deleted, 1);

    env.message.content = "bom dia pessoal";
    assert.equal(await SecurityManager.handleMessage(env.message), false);

    const elsewhere = { ...env.message, content: "candidato", channel: { ...env.channel, id: nextId() } };
    assert.equal(await SecurityManager.handleMessage(elsewhere), false);

    const thread = { ...env.message, content: "eleições", channel: { ...env.channel, id: nextId(), parentId: env.channelId, isThread: () => true } };
    assert.equal(await SecurityManager.handleMessage(thread), true);
});

test("TopicGuard: edição de mensagem também é verificada", async () => {
    const env = makeEnv();
    await SecurityRepository.update(env.guildId, { topic_enabled: 1 });
    await SecurityRepository.addRule({ guildId: env.guildId, channelId: env.channelId, topic: "Política", keywords: ["eleições"] });
    env.message.content = "falando de eleições agora";
    assert.equal(await SecurityManager.handleEdit(env.message), true);
    assert.equal(env.calls.deleted, 1);
});

test("Security Center: painel web e comandos estão integrados", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.resolve(__dirname, "..");
    const read = file => fs.readFileSync(path.join(root, file), "utf8");
    const routes = read("src/api/panelRoutes.js");
    assert.match(routes, /\/guilds\/:guildId\/security"/);
    assert.match(routes, /security\/honeypot\/notice/);
    assert.match(routes, /security\/rules/);
    assert.match(read("public/panel/index.html"), /id="secao-honeypot"/);
    assert.match(read("public/panel/app.js"), /carregarHoneypot/);
    assert.match(read("src/events/interactionCreate.js"), /config_honeypot_action/);
    assert.match(read("src/events/messageUpdate.js"), /SecurityManager\.handleEdit/);
});
