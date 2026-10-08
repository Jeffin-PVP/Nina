const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection, PermissionsBitField, PermissionFlagsBits, ChannelType } = require("discord.js");

const LockdownManager = require("../src/managers/LockdownManager");
const LockdownRepository = require("../src/database/repositories/LockdownRepository");

test("lockdown bloqueia canais de texto/voz e restaura os overwrites originais", async t => {
    const originals = {
        get: LockdownRepository.get,
        update: LockdownRepository.update,
        saveSnapshot: LockdownRepository.saveSnapshot,
        listSnapshots: LockdownRepository.listSnapshots,
        removeSnapshot: LockdownRepository.removeSnapshot
    };
    t.after(() => Object.assign(LockdownRepository, originals));

    const guildId = "12345678901234567";
    const allowedRoleId = "22345678901234567";
    const deniedRoleId = "32345678901234567";
    const otherRoleId = "72345678901234567";
    const memberId = "82345678901234567";
    let config = {
        guild_id: guildId,
        enabled: true,
        active: false,
        channel_ids: [],
        category_ids: ["42345678901234567"],
        allowed_role_ids: [allowedRoleId],
        denied_role_ids: [deniedRoleId]
    };
    const snapshots = new Map();
    LockdownRepository.get = async () => ({ ...config });
    LockdownRepository.update = async (_guildId, fields) => {
        config = { ...config, ...fields };
        return { ...config };
    };
    LockdownRepository.saveSnapshot = async (_guildId, channelId, overwrites) => snapshots.set(channelId, overwrites);
    LockdownRepository.listSnapshots = async () => [...snapshots].map(([channel_id, overwrites]) => ({ channel_id, overwrites }));
    LockdownRepository.removeSnapshot = async (_guildId, channelId) => snapshots.delete(channelId);

    const initialOverwrites = [{
        id: allowedRoleId,
        type: 0,
        allow: { bitfield: new PermissionsBitField([PermissionFlagsBits.ViewChannel]).bitfield },
        deny: { bitfield: 0n }
    }, {
        id: otherRoleId,
        type: 0,
        allow: { bitfield: new PermissionsBitField([PermissionFlagsBits.SendMessages]).bitfield },
        deny: { bitfield: 0n }
    }, {
        id: memberId,
        type: 1,
        allow: { bitfield: new PermissionsBitField([PermissionFlagsBits.SendMessages]).bitfield },
        deny: { bitfield: 0n }
    }];
    const makeChannel = (id, type, permissionsLocked = false) => {
        const channel = {
            id,
            name: type === ChannelType.GuildVoice ? "voz" : "geral",
            type,
            parentId: "42345678901234567",
            parent: permissionsLocked ? {} : null,
            permissionsLocked,
            isThread: () => false,
            isVoiceBased: () => type === ChannelType.GuildVoice,
            isTextBased: () => type === ChannelType.GuildText,
            applied: [],
            restored: null,
            lockedPermissionsRestored: false,
            lockPermissions: async () => { channel.lockedPermissionsRestored = true; }
        };
        channel.permissionOverwrites = {
            cache: new Collection(initialOverwrites.map(overwrite => [overwrite.id, overwrite])),
            edit: async (target, permissions) => channel.applied.push({ target, permissions }),
            set: async overwrites => { channel.restored = overwrites; }
        };
        return channel;
    };

    const textChannel = makeChannel("52345678901234567", ChannelType.GuildText, true);
    const voiceChannel = makeChannel("62345678901234567", ChannelType.GuildVoice);
    const category = { id: "42345678901234567", type: ChannelType.GuildCategory };
    const everyone = { id: guildId };
    const roleCache = new Collection([
        [allowedRoleId, { id: allowedRoleId }],
        [deniedRoleId, { id: deniedRoleId }]
    ]);
    const guild = {
        id: guildId,
        channels: { cache: new Collection([
            [category.id, category],
            [textChannel.id, textChannel],
            [voiceChannel.id, voiceChannel]
        ]) },
        roles: { everyone, cache: roleCache },
        members: {
            me: {
                permissions: { has: () => true },
                roles: { highest: { position: 99 } }
            }
        }
    };

    const attempts = await Promise.allSettled([
        LockdownManager.lock(guild),
        LockdownManager.lock(guild)
    ]);
    const result = attempts.find(attempt => attempt.status === "fulfilled").value;
    const rejected = attempts.find(attempt => attempt.status === "rejected");
    assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1);
    assert.match(rejected.reason.message, /já está ativo/);
    assert.equal(result.lockedChannels, 2);
    assert.equal(config.active, true);
    assert.deepEqual(textChannel.applied[0].permissions, {
        SendMessages: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        AddReactions: false,
        UseApplicationCommands: false
    });
    assert.deepEqual(voiceChannel.applied[0].permissions, { Connect: false });
    assert.equal(textChannel.applied.find(change => change.target === allowedRoleId).permissions.SendMessages, true);
    assert.equal(textChannel.applied.find(change => change.target === allowedRoleId).permissions.ViewChannel, true);
    assert.equal(textChannel.applied.find(change => change.target === deniedRoleId).permissions.SendMessages, false);
    assert.equal(textChannel.applied.find(change => change.target === deniedRoleId).permissions.ViewChannel, false);
    assert.equal(textChannel.applied.find(change => change.target === otherRoleId).permissions.SendMessages, false);
    assert.equal(textChannel.applied.find(change => change.target === memberId).permissions.SendMessages, null);
    assert.equal(textChannel.applied.find(change => change.target === memberId).permissions.ViewChannel, null);

    const restored = await LockdownManager.restore(guild);
    assert.equal(restored.restoredChannels, 2);
    assert.equal(config.active, false);
    assert.equal(snapshots.size, 0);
    assert.equal(textChannel.lockedPermissionsRestored, true);
    assert.equal(voiceChannel.lockedPermissionsRestored, false);
    assert.deepEqual(voiceChannel.restored, initialOverwrites.map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: String(overwrite.allow.bitfield),
        deny: "0"
    })));
});
