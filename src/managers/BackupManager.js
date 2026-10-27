const { ChannelType, PermissionsBitField, PermissionFlagsBits } = require("discord.js");

const SUPPORTED = new Set([
    ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum
]);
const restoring = new Set(); // guildIds com restauração em andamento
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Guarda cargos, categorias, canais e permissões por cargo. Não guarda mensagens nem membros.
function snapshot(guild) {
    const roles = [...guild.roles.cache.values()]
        .filter(r => r.id !== guild.id && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map(r => ({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString() }));

    const roleName = id => (id === guild.id ? "@everyone" : guild.roles.cache.get(id)?.name);
    const channels = [...guild.channels.cache.values()]
        .filter(c => !c.isThread?.() && SUPPORTED.has(c.type))
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
        .map(c => ({
            id: c.id,
            parentId: c.parentId || null,
            type: c.type,
            name: c.name,
            topic: c.topic || null,
            nsfw: !!c.nsfw,
            rateLimitPerUser: c.rateLimitPerUser || 0,
            bitrate: c.bitrate || null,
            userLimit: c.userLimit || 0,
            overwrites: [...c.permissionOverwrites.cache.values()]
                .filter(o => o.type === 0 && roleName(o.id))
                .map(o => ({ role: roleName(o.id), allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
        }));

    return { version: 1, guildName: guild.name, createdAt: Date.now(), roles, channels };
}

function summarize(data) {
    const cats = data.channels.filter(c => c.type === ChannelType.GuildCategory).length;
    return { roles: data.roles.length, categories: cats, channels: data.channels.length - cats };
}

// Restauração NÃO destrutiva: só recria o que está faltando (por nome). Nada é apagado nem alterado.
async function restore(guild, data, onProgress = () => {}) {
    if (restoring.has(guild.id)) throw new Error("Já existe uma restauração em andamento neste servidor.");
    restoring.add(guild.id);
    const stats = { rolesCreated: 0, categoriesCreated: 0, channelsCreated: 0, skipped: 0, failed: 0 };
    try {
        const me = guild.members.me;
        const botBits = me.permissions.bitfield;
        const mask = bits => (BigInt(bits) & botBits).toString();
        const roleMap = new Map([["@everyone", guild.roles.everyone]]);
        for (const r of guild.roles.cache.values()) if (!roleMap.has(r.name)) roleMap.set(r.name, r);

        // 1) Cargos (do mais alto para o mais baixo, mantendo a ordem relativa).
        for (const r of data.roles) {
            if (roleMap.has(r.name)) { stats.skipped++; continue; }
            try {
                const created = await guild.roles.create({
                    name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
                    permissions: new PermissionsBitField(BigInt(mask(r.permissions))), reason: "Restauração de backup (Nina)"
                });
                roleMap.set(r.name, created);
                stats.rolesCreated++;
            } catch { stats.failed++; }
            await sleep(350);
        }
        await onProgress(`Cargos: ${stats.rolesCreated} criados`);

        const overwritesFor = list => list
            .filter(o => roleMap.has(o.role))
            .map(o => ({ id: roleMap.get(o.role).id, allow: new PermissionsBitField(BigInt(mask(o.allow))), deny: new PermissionsBitField(BigInt(mask(o.deny))) }));

        const existing = [...guild.channels.cache.values()];
        const idMap = new Map(); // id antigo -> canal atual/novo

        // 2) Categorias.
        for (const c of data.channels.filter(x => x.type === ChannelType.GuildCategory)) {
            const found = existing.find(e => e.type === ChannelType.GuildCategory && e.name === c.name);
            if (found) { idMap.set(c.id, found); stats.skipped++; continue; }
            try {
                const created = await guild.channels.create({ name: c.name, type: ChannelType.GuildCategory, permissionOverwrites: overwritesFor(c.overwrites), reason: "Restauração de backup (Nina)" });
                idMap.set(c.id, created);
                existing.push(created);
                stats.categoriesCreated++;
            } catch {
                try {
                    const created = await guild.channels.create({ name: c.name, type: ChannelType.GuildCategory, reason: "Restauração de backup (Nina)" });
                    idMap.set(c.id, created); existing.push(created); stats.categoriesCreated++;
                } catch { stats.failed++; }
            }
            await sleep(350);
        }
        await onProgress(`Categorias: ${stats.categoriesCreated} criadas`);

        // 3) Canais.
        for (const c of data.channels.filter(x => x.type !== ChannelType.GuildCategory)) {
            const parent = c.parentId ? idMap.get(c.parentId) : null;
            const found = existing.find(e => e.type === c.type && e.name === c.name && (e.parentId || null) === (parent?.id || null));
            if (found) { stats.skipped++; continue; }
            const base = {
                name: c.name, type: c.type, parent: parent?.id, topic: c.topic || undefined, nsfw: c.nsfw,
                rateLimitPerUser: c.rateLimitPerUser || undefined, reason: "Restauração de backup (Nina)"
            };
            if (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) {
                base.bitrate = c.bitrate ? Math.min(c.bitrate, guild.maximumBitrate) : undefined;
                base.userLimit = c.userLimit || undefined;
                delete base.topic; delete base.rateLimitPerUser;
            }
            try {
                const created = await guild.channels.create({ ...base, permissionOverwrites: overwritesFor(c.overwrites) });
                existing.push(created);
                stats.channelsCreated++;
            } catch {
                try {
                    const created = await guild.channels.create(base);
                    existing.push(created);
                    stats.channelsCreated++;
                } catch { stats.failed++; }
            }
            await sleep(350);
        }
        return stats;
    } finally {
        restoring.delete(guild.id);
    }
}

const isRestoring = guildId => restoring.has(guildId);

module.exports = { snapshot, summarize, restore, isRestoring, PermissionFlagsBits };
