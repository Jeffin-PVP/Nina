const { AuditLogEvent } = require("discord.js");
const AntiNukeRepository = require("../database/repositories/AntiNukeRepository");
const LogManager = require("./LogManager");
const LogTypes = require("./LogTypes");

const windows = new Map();
const triggers = new Map();

const TYPE_CONFIG = {
    channel_create: "channel_limit",
    channel_delete: "channel_limit",
    role_create: "role_limit",
    role_delete: "role_limit",
    member_ban: "member_limit",
    member_kick: "member_limit",
    bot_add: "bot_limit",
    webhook_create: "webhook_limit",
    webhook_delete: "webhook_limit"
};

function now() {
    return Date.now();
}

function cleanup(list, cutoff) {
    return list.filter(timestamp => timestamp >= cutoff);
}

function canActOnExecutor(guild, executor) {
    if (!executor) return false;
    if (executor.id === guild.ownerId) return false;
    if (executor.id === guild.client.user.id) return false;
    return true;
}

async function fetchAuditExecutor(guild, type, targetId = null) {
    try {
        if (!guild.members.me?.permissions.has("ViewAuditLog")) return null;
        const logs = await guild.fetchAuditLogs({ type, limit: 5 });
        const entry = targetId
            ? logs.entries.find(item => item.target?.id === targetId)
            : logs.entries.first();
        if (!entry) return null;
        if (now() - entry.createdTimestamp > 10_000) return null;
        return entry.executor ?? null;
    } catch {
        return null;
    }
}

async function resolveExecutor(guild, auditType, targetId) {
    return fetchAuditExecutor(guild, auditType, targetId);
}

async function record({ guild, type, executor = null, target = null, reason = null }) {
    if (!guild || !type) return { triggered: false };

    const config = await AntiNukeRepository.get(guild.id);
    if (!config.enabled) return { triggered: false, disabled: true };

    if (!executor) return { triggered: false, unknownExecutor: true };
    if (!canActOnExecutor(guild, executor)) return { triggered: false, ignored: true };

    const limit = Number(config[TYPE_CONFIG[type]] ?? 3);
    const windowMs = Math.max(5, Number(config.window_seconds) || 10) * 1000;
    const key = `${guild.id}:${executor.id}:${type}`;
    const cutoff = now() - windowMs;
    const list = cleanup(windows.get(key) || [], cutoff);
    list.push(now());
    windows.set(key, list);

    if (list.length < limit) return { triggered: false, count: list.length, limit };

    const lastTrigger = triggers.get(key) || 0;
    if (now() - lastTrigger < windowMs) {
        return { triggered: false, count: list.length, limit, alreadyTriggered: true };
    }

    triggers.set(key, now());
    windows.set(key, []);

    await takeAction({ guild, executor, target, action: config.action, type, reason: reason || `Limite do Anti-Nuke atingido: ${list.length}/${limit} em ${config.window_seconds}s.` });

    return { triggered: true, count: list.length, limit };
}

async function takeAction({ guild, executor, target, action, type, reason }) {
    const member = guild.members.cache.get(executor.id) || await guild.members.fetch(executor.id).catch(() => null);
    const me = guild.members.me;
    let result = "nenhuma ação";

    if (target?.user?.bot && target.id !== guild.client.user.id) {
        await target.kick("Nina Anti-Nuke: bot adicionado durante possível ataque").catch(() => {});
    }

    if (member && me) {
        const removable = member.roles.cache.filter(role =>
            role.id !== guild.id &&
            !role.managed &&
            role.position < me.roles.highest.position
        );

        if (removable.size) {
            await member.roles.remove(removable, "Nina Anti-Nuke: remover privilégios do possível atacante").catch(() => {});
            result = `${removable.size} cargo(s) removido(s)`;
        }

        if (action === "ban" && member.bannable) {
            await member.ban({ deleteMessageSeconds: 0, reason: `Nina Anti-Nuke: ${reason}` }).catch(() => {});
            result = "usuário banido e cargos removidos";
        } else if (action === "kick" && member.kickable) {
            await member.kick(`Nina Anti-Nuke: ${reason}`).catch(() => {});
            result = "usuário expulso e cargos removidos";
        }
    }

    await LogManager.send({
        type: LogTypes.ANTINUKE_TRIGGER,
        guild,
        executor,
        target,
        extra: {
            action,
            type,
            reason,
            result
        }
    });

    console.warn(`[Anti-Nuke] ${guild.name}: ${executor.tag || executor.username} -> ${type} -> ${result}`);
}

async function detectChannel(guild, type, channelId, executor = null) {
    const auditType = type === "channel_delete" ? AuditLogEvent.ChannelDelete : AuditLogEvent.ChannelCreate;
    executor ||= await resolveExecutor(guild, auditType, channelId);
    return record({ guild, type, executor });
}

async function detectRole(guild, type, roleId, executor = null) {
    const auditType = type === "role_delete" ? AuditLogEvent.RoleDelete : AuditLogEvent.RoleCreate;
    executor ||= await resolveExecutor(guild, auditType, roleId);
    return record({ guild, type, executor });
}

async function detectBan(guild, userId, target = null) {
    const executor = await resolveExecutor(guild, AuditLogEvent.MemberBanAdd, userId);
    return record({ guild, type: "member_ban", executor, target });
}

async function detectKick(guild, userId, target = null) {
    const executor = await resolveExecutor(guild, AuditLogEvent.MemberKick, userId);
    return record({ guild, type: "member_kick", executor, target });
}

async function detectBotAdd(guild, member) {
    if (!member?.user?.bot) return { triggered: false };
    const executor = await resolveExecutor(guild, AuditLogEvent.BotAdd, member.id);
    return record({ guild, type: "bot_add", executor, target: member });
}

async function detectWebhook(guild) {
    try {
        if (!guild.members.me?.permissions.has("ViewAuditLog")) return { triggered: false };
        const [created, deleted] = await Promise.all([
            guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 3 }),
            guild.fetchAuditLogs({ type: AuditLogEvent.WebhookDelete, limit: 3 })
        ]);
        const candidates = [
            ...created.entries.map(entry => ({ entry, type: "webhook_create" })),
            ...deleted.entries.map(entry => ({ entry, type: "webhook_delete" }))
        ].filter(item => now() - item.entry.createdTimestamp <= 10_000);
        candidates.sort((a, b) => b.entry.createdTimestamp - a.entry.createdTimestamp);
        const latest = candidates[0];
        if (!latest) return { triggered: false };
        return record({ guild, type: latest.type, executor: latest.entry.executor });
    } catch {
        return { triggered: false };
    }
}

function clearGuild(guildId) {
    for (const key of windows.keys()) if (key.startsWith(`${guildId}:`)) windows.delete(key);
    for (const key of triggers.keys()) if (key.startsWith(`${guildId}:`)) triggers.delete(key);
}

module.exports = {
    record,
    detectChannel,
    detectRole,
    detectBan,
    detectKick,
    detectBotAdd,
    detectWebhook,
    clearGuild
};
