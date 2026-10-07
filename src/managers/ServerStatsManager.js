const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const ServerStatsRepository = require("../database/repositories/ServerStatsRepository");

const COUNTERS = {
    members: { label: "Membros", emoji: "👥" },
    bots: { label: "Bots", emoji: "🤖" },
    online: { label: "Online", emoji: "🟢" },
    offline: { label: "Offline", emoji: "⚫" },
    voice: { label: "Em call", emoji: "🔊" },
    channels: { label: "Canais", emoji: "💬" },
    categories: { label: "Categorias", emoji: "📁" },
    roles: { label: "Cargos", emoji: "🎭" },
    servers: { label: "Servidores", emoji: "🌐" }
};

const ORDER = Object.keys(COUNTERS);
const UPDATE_INTERVAL = 60_000;
let clientRef = null;
let timer = null;
let updating = false;

function enabledCounters(config) {
    return ORDER.filter(key => config[`${key}_enabled`]);
}

function safeCountMembers(guild) {
    const members = guild.members.cache;
    let bots = 0;
    let online = 0;
    let voice = 0;

    for (const member of members.values()) {
        if (member.user?.bot) bots++;
        const status = member.presence?.status;
        if (status && status !== "offline") online++;
        if (member.voice?.channelId) voice++;
    }

    const total = Number(guild.memberCount || members.size || 0);
    const offline = Math.max(0, total - online);

    return { total, bots, online, offline, voice };
}

function getValues(guild, client) {
    const members = safeCountMembers(guild);
    return {
        members: members.total,
        bots: members.bots,
        online: members.online,
        offline: members.offline,
        voice: members.voice,
        channels: guild.channels.cache.filter(channel => channel.type !== ChannelType.GuildCategory).size,
        categories: guild.channels.cache.filter(channel => channel.type === ChannelType.GuildCategory).size,
        roles: Math.max(0, guild.roles.cache.size - 1),
        servers: client.guilds.cache.size
    };
}

async function ensureCategory(guild, config) {
    let category = config.category_id ? guild.channels.cache.get(config.category_id) : null;

    if (!category || category.type !== ChannelType.GuildCategory) {
        category = guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildCategory &&
            channel.name === "📊・Estatísticas"
        ) || null;
    }

    if (!category) {
        category = await guild.channels.create({
            name: "📊・Estatísticas",
            type: ChannelType.GuildCategory,
            reason: "Nina: categoria de estatísticas do servidor"
        });
        await ServerStatsRepository.update(guild.id, { category_id: category.id });
    }

    return category;
}

async function createOrUpdate(guild, { force = false } = {}) {
    const config = await ServerStatsRepository.get(guild.id);
    if (!config.enabled && !force) return false;

    const category = await ensureCategory(guild, config);
    let ids = await ServerStatsRepository.getChannelIds(guild.id);
    const values = getValues(guild, clientRef);
    const active = new Set(enabledCounters(config));

    for (const key of ORDER) {
        const existing = ids[key] ? guild.channels.cache.get(ids[key]) : null;

        if (!active.has(key)) {
            if (existing) {
                await existing.delete("Nina: contador desativado").catch(() => {});
            }
            delete ids[key];
            continue;
        }

        const data = COUNTERS[key];
        const name = `${data.emoji}・${data.label}: ${values[key]}`.slice(0, 100);

        if (existing && existing.type === ChannelType.GuildVoice) {
            if (existing.name !== name) await existing.setName(name, "Nina: atualizar contador").catch(() => {});
            if (existing.parentId !== category.id) await existing.setParent(category.id, { lockPermissions: false }).catch(() => {});
            continue;
        }

        if (existing) await existing.delete("Nina: substituir contador").catch(() => {});

        const channel = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                }
            ],
            reason: "Nina: criar contador de estatísticas"
        });

        ids[key] = channel.id;
    }

    await ServerStatsRepository.setChannelIds(guild.id, ids);
    return true;
}

async function updateGuild(guild) {
    const config = await ServerStatsRepository.get(guild.id);
    if (!config.enabled) return;
    await createOrUpdate(guild);
}

async function updateAll() {
    if (!clientRef || updating) return;
    updating = true;
    try {
        for (const guild of clientRef.guilds.cache.values()) {
            await updateGuild(guild).catch(error => {
                console.error(`[ServerStats] Falha em ${guild.name}:`, error.message);
            });
        }
    } finally {
        updating = false;
    }
}

async function enable(guild) {
    await ServerStatsRepository.setEnabled(guild.id, true);
    await createOrUpdate(guild, { force: true });
    return ServerStatsRepository.get(guild.id);
}

async function disable(guild, { remove = false } = {}) {
    const ids = await ServerStatsRepository.getChannelIds(guild.id);
    const config = await ServerStatsRepository.get(guild.id);

    await ServerStatsRepository.setEnabled(guild.id, false);

    if (remove) {
        for (const id of Object.values(ids)) {
            const channel = guild.channels.cache.get(id);
            if (channel) await channel.delete("Nina: remover estatísticas").catch(() => {});
        }
        if (config.category_id) {
            const category = guild.channels.cache.get(config.category_id);
            if (category) {
                const children = category.children?.cache || new Map();
                const hasForeignChannels = [...children.values()].some(channel => !Object.values(ids).includes(channel.id));
                if (!hasForeignChannels) {
                    await category.delete("Nina: remover categoria de estatísticas").catch(() => {});
                }
            }
        }
        await ServerStatsRepository.update(guild.id, { category_id: null, channel_ids: "{}" });
    }

    return ServerStatsRepository.get(guild.id);
}

async function setCounter(guild, counter, enabled) {
    await ServerStatsRepository.setCounter(guild.id, counter, enabled);
    const config = await ServerStatsRepository.get(guild.id);
    if (config.enabled) await createOrUpdate(guild);
    return config;
}

function start(client) {
    clientRef = client;
    if (timer) clearInterval(timer);
    timer = setInterval(updateAll, UPDATE_INTERVAL);
    timer.unref?.();
    setTimeout(updateAll, 5000);
}

module.exports = {
    COUNTERS,
    ORDER,
    start,
    updateGuild,
    updateAll,
    enable,
    disable,
    setCounter,
    createOrUpdate,
    getValues
};
