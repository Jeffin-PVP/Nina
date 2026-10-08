const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    Routes,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");

class TempVoiceManager {
    static canManageRoom(member, room, config, action) {
        if (!member || !room || !config) return false;
        if (member.id === room.owner_id) return !!config[`owner_${action}`];
        if (config.admin_manage && member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
        if (config.manager_role_id && member.roles?.cache?.has(config.manager_role_id)) return true;
        return false;
    }

    static async configure(guild, values = {}) {
        const current = await TempVoiceRepository.get(guild.id);
        const next = { ...values };
        if (next.enabled !== undefined) next.enabled = next.enabled ? 1 : 0;
        if (next.admin_manage !== undefined) next.admin_manage = next.admin_manage ? 1 : 0;
        for (const key of ["auto_lock", "owner_rename", "owner_lock", "owner_limit", "owner_kick", "owner_ban", "owner_transfer", "owner_delete"]) {
            if (next[key] !== undefined) next[key] = next[key] ? 1 : 0;
        }
        if (next.default_limit !== undefined) next.default_limit = Math.max(0, Math.min(99, Number(next.default_limit) || 0));
        if (next.name_template !== undefined) next.name_template = String(next.name_template).slice(0, 90) || current.name_template;
        await TempVoiceRepository.set(guild.id, next);
        return TempVoiceRepository.get(guild.id);
    }

    static async setup(guild, { categoryId = null, triggerChannelId = null, panelChannelId = null } = {}) {
        let config = await TempVoiceRepository.get(guild.id);

        let category = categoryId ? guild.channels.cache.get(categoryId) : null;

        if (!category) {
            category = config.category_id
                ? guild.channels.cache.get(config.category_id)
                : null;
        }

        if (!category) {
            category = guild.channels.cache.find(
                channel =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === "🔊 Salas Temporárias"
            );
        }

        if (!category) {
            category = await guild.channels.create({
                name: "🔊 Salas Temporárias",
                type: ChannelType.GuildCategory
            });
        }

        if (category.type !== ChannelType.GuildCategory) {
            throw new Error("A categoria escolhida é inválida.");
        }

        let trigger = triggerChannelId ? guild.channels.cache.get(triggerChannelId) : (config.trigger_channel_id
            ? guild.channels.cache.get(config.trigger_channel_id)
            : null);

        if (!trigger || trigger.type !== ChannelType.GuildVoice) {
            trigger = guild.channels.cache.find(
                channel =>
                    channel.type === ChannelType.GuildVoice &&
                    channel.name === "➕ Criar sala" &&
                    channel.parentId === category.id
            );
        }

        if (!trigger) {
            trigger = await guild.channels.create({
                name: "➕ Criar sala",
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak
                        ]
                    }
                ]
            });
        }

        await TempVoiceRepository.set(guild.id, {
            enabled: 1,
            category_id: category.id,
            trigger_channel_id: trigger.id,
            ...(panelChannelId ? { panel_channel_id: panelChannelId } : {})
        });

        return { category, trigger };
    }

    static async disable(guild) {
        const config = await TempVoiceRepository.get(guild.id);
        const rooms = await TempVoiceRepository.getRooms(guild.id);

        for (const room of rooms) {
            const channel = guild.channels.cache.get(room.channel_id);
            if (channel) await channel.delete("Desativação do Temp Voice").catch(() => {});
        }

        for (const id of [config.trigger_channel_id]) {
            const channel = id ? guild.channels.cache.get(id) : null;
            if (channel) await channel.delete("Desativação do Temp Voice").catch(() => {});
        }

        if (config.category_id) {
            const category = guild.channels.cache.get(config.category_id);
            if (
                category &&
                category.type === ChannelType.GuildCategory &&
                category.children.cache.size === 0
            ) {
                await category.delete("Desativação do Temp Voice").catch(() => {});
            }
        }

        await TempVoiceRepository.removeAllRooms(guild.id);
        await TempVoiceRepository.set(guild.id, {
            enabled: 0,
            category_id: null,
            trigger_channel_id: null,
            panel_channel_id: null
        });
    }

    static formatName(template, member) {
        return (template || "🔊 {user}")
            .replaceAll("{user}", member.displayName)
            .replaceAll("{username}", member.user.username)
            .replace(/[\\/:*?"<>|]/g, "")
            .trim()
            .slice(0, 95) || `🔊 ${member.user.username}`;
    }

    static async createRoom(member, trigger) {
        const guild = member.guild;
        const config = await TempVoiceRepository.get(guild.id);

        if (!config.enabled || trigger.id !== config.trigger_channel_id) return null;

        const existing = (await TempVoiceRepository.getRooms(guild.id))
            .find(room => room.owner_id === member.id);

        if (existing) {
            const oldChannel = guild.channels.cache.get(existing.channel_id);
            if (oldChannel) {
                await member.voice.setChannel(oldChannel).catch(() => {});
                return oldChannel;
            }
            await TempVoiceRepository.removeRoom(existing.channel_id);
        }

        const name = this.formatName(config.name_template, member);

        const channel = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: config.category_id || trigger.parentId,
            userLimit: Math.max(0, Math.min(99, Number(config.default_limit) || 0)),
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak
                    ]
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.MoveMembers,
                        PermissionFlagsBits.MuteMembers,
                        PermissionFlagsBits.DeafenMembers
                    ]
                }
            ]
        });

        await TempVoiceRepository.addRoom(guild.id, channel.id, member.id);

        if (config.auto_lock) {
            await TempVoiceRepository.setRoom(channel.id, { locked: 1 });
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                Connect: false
            }).catch(() => {});
        }

        await member.voice.setChannel(channel).catch(() => {});

        // O painel é publicado no chat integrado da própria sala. Se o Discord
        // recusar o envio, a sala continua funcionando normalmente.
        await this.postPanel(channel, member).catch(error => {
            console.error("❌ Não consegui publicar o painel do TempVoice:", error);
        });

        return channel;
    }

    static async transferOwnership(channel, oldOwnerId, newOwner) {
        if (!channel || !newOwner) return false;

        await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});

        await channel.permissionOverwrites.edit(newOwner.id, {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true
        }).catch(() => {});

        await TempVoiceRepository.setRoom(channel.id, {
            owner_id: newOwner.id
        });

        return true;
    }

    static async cleanupIfEmpty(channel) {
        if (!channel || channel.type !== ChannelType.GuildVoice) return false;

        const room = await TempVoiceRepository.getRoom(channel.id);
        if (!room || channel.members.size > 0) return false;

        await TempVoiceRepository.removeRoom(channel.id);
        await channel.delete("Sala temporária vazia").catch(() => {});
        return true;
    }

    static async cleanupGuild(guild) {
        const config = await TempVoiceRepository.get(guild.id);
        if (!config.enabled) return;

        const rooms = await TempVoiceRepository.getRooms(guild.id);

        for (const room of rooms) {
            const channel = guild.channels.cache.get(room.channel_id);

            if (!channel || channel.type !== ChannelType.GuildVoice || channel.members.size === 0) {
                await TempVoiceRepository.removeRoom(room.channel_id);
                if (channel) await channel.delete("Limpeza do Temp Voice").catch(() => {});
            }
        }
    }

    static async postPanel(channel, owner = null) {
        if (!channel || channel.type !== ChannelType.GuildVoice) {
            throw new Error("O painel do TempVoice precisa ser publicado em uma sala de voz.");
        }

        // Salas de voz possuem o chat de texto integrado. O discord.js 14 não
        // expõe GuildVoiceChannel como TextBasedChannel em todas as versões,
        // então enviamos a mensagem diretamente pelo endpoint de mensagens.
        const payload = {
            content: owner ? `<@${owner.id}> sua sala foi criada. Use o painel abaixo para configurá-la.` : undefined,
            embeds: [this.controlEmbed(channel, owner, false).toJSON()],
            components: this.controlRows(true).map(row => row.toJSON()),
            allowed_mentions: owner ? { users: [owner.id] } : { parse: [] }
        };

        return channel.client.rest.post(
            Routes.channelMessages(channel.id),
            { body: payload }
        );
    }

    static controlRows(includeManagement = false) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("tempvoice:lock")
                .setLabel("Bloquear")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("tempvoice:rename")
                .setLabel("Renomear")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("tempvoice:limit")
                .setLabel("Limite")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("tempvoice:kick")
                .setLabel("Expulsar")
                .setEmoji("👢")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("tempvoice:delete")
                .setLabel("Excluir")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        );

        if (!includeManagement) return [row1];

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("tempvoice:transfer")
                .setLabel("Transferir dono")
                .setEmoji("👑")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("tempvoice:ban")
                .setLabel("Bloquear membro")
                .setEmoji("🚫")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("tempvoice:unban")
                .setLabel("Desbloquear")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Secondary)
        );

        return [row1, row2];
    }

    static controlEmbed(channel, owner, generic = false) {
        const embed = new EmbedBuilder()
            .setColor("#7C3AED")
            .setTitle("🔊 Controle de sala temporária")
            .setDescription(
                generic
                    ? "Entre em uma sala temporária da Nina e use os botões para gerenciá-la."
                    : `Gerencie ${channel}. O dono e os administradores/cargos autorizados podem usar os controles.`
            );

        if (channel) {
            const locked = channel.permissionOverwrites.cache
                .get(channel.guild.roles.everyone.id)
                ?.deny.has(PermissionFlagsBits.Connect);

            embed.addFields(
                { name: "👥 Membros", value: `\`${channel.members.size}\``, inline: true },
                { name: "🔒 Estado", value: locked ? "Bloqueada" : "Aberta", inline: true },
                { name: "👑 Dono", value: owner ? `<@${owner.id}>` : "—", inline: true }
            );
        }

        return embed;
    }
}

module.exports = TempVoiceManager;
