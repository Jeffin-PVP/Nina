const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const LockdownRepository = require("../database/repositories/LockdownRepository");

function isLockableChannel(channel) {
    if (!channel || channel.isThread?.()) return false;
    if (channel.isVoiceBased?.()) return true;
    return channel.isTextBased?.() && channel.type !== ChannelType.GuildCategory;
}

function permissionsFor(channel, value) {
    if (channel.isVoiceBased?.()) return { Connect: value };
    return {
        SendMessages: value,
        SendMessagesInThreads: value,
        CreatePublicThreads: value,
        CreatePrivateThreads: value,
        AddReactions: value,
        UseApplicationCommands: value
    };
}

function clearLockPermissionsFor(channel) {
    if (channel.isVoiceBased?.()) return { ViewChannel: null, Connect: null };
    return {
        ViewChannel: null,
        ReadMessageHistory: null,
        SendMessages: null,
        SendMessagesInThreads: null,
        CreatePublicThreads: null,
        CreatePrivateThreads: null,
        AddReactions: null,
        UseApplicationCommands: null
    };
}

function rolePermissionsFor(channel, value) {
    return {
        ...permissionsFor(channel, value),
        ViewChannel: value,
        ...(channel.isVoiceBased?.() ? {} : { ReadMessageHistory: value })
    };
}

function snapshotFor(channel) {
    return {
        permissionsLocked: !!channel.permissionsLocked,
        overwrites: channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
        }))
    };
}

class LockdownManager {

    static operations = new Map();

    static serialize(guildId, operation) {
        const previous = this.operations.get(guildId) || Promise.resolve();
        const current = previous.catch(() => {}).then(operation);
        this.operations.set(guildId, current);
        return current.finally(() => {
            if (this.operations.get(guildId) === current) this.operations.delete(guildId);
        });
    }

    static async getConfig(guildId) {
        return LockdownRepository.get(guildId);
    }

    static configure(guildId, fields) {
        return this.serialize(guildId, async () => {
            const current = await LockdownRepository.get(guildId);
            if (current.active) {
                throw new Error("Destranque os canais antes de alterar a configuração.");
            }
            return LockdownRepository.update(guildId, fields);
        });
    }

    static async resolveTargets(guild, config) {
        const categoryIds = new Set(config.category_ids);
        const channelIds = new Set(config.channel_ids);
        const invalidChannel = config.channel_ids.find(id => !isLockableChannel(guild.channels.cache.get(id)));
        if (invalidChannel) throw new Error(`O canal configurado ${invalidChannel} não existe mais ou não pode ser trancado.`);
        const invalidCategory = config.category_ids.find(id =>
            guild.channels.cache.get(id)?.type !== ChannelType.GuildCategory
        );
        if (invalidCategory) throw new Error(`A categoria configurada ${invalidCategory} não existe mais.`);

        const targets = guild.channels.cache.filter(channel =>
            isLockableChannel(channel) &&
            (channelIds.has(channel.id) || categoryIds.has(channel.parentId))
        );

        if (!targets.size) {
            throw new Error("Configure ao menos um canal ou uma categoria antes de iniciar o lockdown.");
        }

        return [...targets.values()];
    }

    static lock(guild, reason = "Lockdown do servidor") {
        return this.serialize(guild.id, () => this.applyLock(guild, reason));
    }

    static async applyLock(guild, reason) {
        const config = await LockdownRepository.get(guild.id);
        if (!config.enabled) {
            throw new Error("O lockdown está desativado. Ative-o no painel `/config` primeiro.");
        }
        if (config.active) {
            throw new Error("O lockdown já está ativo. Use `/lockdown encerrar` para restaurar os canais.");
        }

        const botMember = guild.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
            throw new Error("Preciso da permissão Gerenciar Canais para aplicar o lockdown.");
        }

        for (const roleId of [...config.allowed_role_ids, ...config.denied_role_ids]) {
            if (!guild.roles.cache.has(roleId)) {
                throw new Error(`O cargo configurado ${roleId} não existe mais. Atualize os cargos no `/config` antes do lockdown.`);
            }
        }

        const targets = await this.resolveTargets(guild, config);
        for (const channel of targets) {
            if (!channel.permissionOverwrites) {
                throw new Error(`O canal ${channel.name} não permite configurar overwrites.`);
            }
            await LockdownRepository.saveSnapshot(guild.id, channel.id, snapshotFor(channel));
        }

        await LockdownRepository.update(guild.id, { active: true });

        try {
            for (const channel of targets) {
                const reasonForChannel = `${reason} (lockdown)`;
                const everyone = guild.roles.everyone;
                await channel.permissionOverwrites.edit(
                    everyone,
                    permissionsFor(channel, false),
                    { reason: reasonForChannel }
                );

                const allowedRoleIds = new Set(config.allowed_role_ids);
                const deniedRoleIds = new Set(config.denied_role_ids);
                for (const overwrite of channel.permissionOverwrites.cache.values()) {
                    if (overwrite.id === guild.id) continue;
                    if (overwrite.type === 1) {
                        await channel.permissionOverwrites.edit(
                            overwrite.id,
                            clearLockPermissionsFor(channel),
                            { reason: reasonForChannel }
                        );
                    } else if (!allowedRoleIds.has(overwrite.id) && !deniedRoleIds.has(overwrite.id)) {
                        await channel.permissionOverwrites.edit(
                            overwrite.id,
                            permissionsFor(channel, false),
                            { reason: reasonForChannel }
                        );
                    }
                }

                for (const roleId of config.allowed_role_ids) {
                    await channel.permissionOverwrites.edit(
                        roleId,
                        rolePermissionsFor(channel, true),
                        { reason: reasonForChannel }
                    );
                }

                for (const roleId of config.denied_role_ids) {
                    await channel.permissionOverwrites.edit(
                        roleId,
                        rolePermissionsFor(channel, false),
                        { reason: reasonForChannel }
                    );
                }
            }
        } catch (lockError) {
            try {
                await this.restoreInternal(guild, `${reason} (rollback do lockdown)`);
            } catch (restoreError) {
                throw new AggregateError(
                    [lockError, restoreError],
                    "O lockdown falhou e nem todos os canais puderam ser restaurados."
                );
            }
            throw lockError;
        }

        return { lockedChannels: targets.length };
    }

    static restore(guild, reason = "Lockdown encerrado") {
        return this.serialize(guild.id, () => this.restoreInternal(guild, reason));
    }

    static async restoreInternal(guild, reason) {
        const snapshots = await LockdownRepository.listSnapshots(guild.id);
        const failures = [];
        let restoredChannels = 0;

        for (const snapshot of snapshots) {
            const channel = guild.channels.cache.get(snapshot.channel_id);
            if (!channel) {
                await LockdownRepository.removeSnapshot(guild.id, snapshot.channel_id);
                continue;
            }

            try {
                if (snapshot.overwrites.permissionsLocked && channel.parent) {
                    await channel.lockPermissions();
                } else {
                    await channel.permissionOverwrites.set(snapshot.overwrites.overwrites, { reason });
                }
                await LockdownRepository.removeSnapshot(guild.id, snapshot.channel_id);
                restoredChannels++;
            } catch (error) {
                failures.push(new Error(`Falha ao restaurar #${channel.name}: ${error.message}`, { cause: error }));
            }
        }

        if (failures.length) {
            await LockdownRepository.update(guild.id, { active: true });
            throw new AggregateError(failures, "Nem todos os canais puderam ser restaurados.");
        }

        await LockdownRepository.update(guild.id, { active: false });
        return { restoredChannels };
    }

}

module.exports = LockdownManager;
