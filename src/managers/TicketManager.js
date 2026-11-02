const { ChannelType, PermissionFlagsBits } = require("discord.js");
const GuildRepository = require("../database/repositories/GuildRepository");

/*
Camada única para os dois modos de ticket:
  - "thread"  : tópico privado dentro do canal configurado (modo original)
  - "channel" : canal de texto privado dentro de uma categoria
O ticket é identificado pelo ID do tópico/canal (coluna thread_id).
*/

const MODES = {
    thread: { label: "Tópico privado", noun: "tópico" },
    channel: { label: "Canal privado", noun: "canal" }
};

const normalizeMode = mode => (mode === "channel" ? "channel" : "thread");
const modeLabel = mode => MODES[normalizeMode(mode)].label;

function isStaff(member, config) {
    if (member.permissions.has(PermissionFlagsBits.ManageThreads) || member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
    return !!(config.support_role_id && member.roles.cache.has(config.support_role_id));
}

// Categoria usada no modo canal: a escolhida ou a categoria do canal pai configurado.
function resolveCategory(guild, config) {
    const chosen = config.category_id && guild.channels.cache.get(config.category_id);
    if (chosen?.type === ChannelType.GuildCategory) return chosen;
    const parent = config.parent_channel_id && guild.channels.cache.get(config.parent_channel_id);
    return parent?.parent?.type === ChannelType.GuildCategory ? parent.parent : null;
}

// Retorna { ok, channel } ou { ok:false, code, message }.
async function createTicketContainer({ guild, config, user, paddedNumber }) {
    const mode = normalizeMode(config.mode);

    if (mode === "thread") {
        const parent = guild.channels.cache.get(config.parent_channel_id);
        if (!parent) return { ok: false, code: "missing_parent", message: "O canal configurado para tickets não existe mais. Avise um administrador." };
        try {
            const thread = await parent.threads.create({
                name: `ticket-${paddedNumber}-${user.username}`.slice(0, 100),
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Ticket aberto por ${user.tag}`
            });
            await thread.members.add(user.id).catch(() => null);
            if (config.support_role_id) {
                const role = guild.roles.cache.get(config.support_role_id);
                if (role) await Promise.allSettled(role.members.map(m => thread.members.add(m.id)));
            }
            return { ok: true, channel: thread, parentId: parent.id };
        } catch (error) {
            console.error("[Tickets] Erro ao criar tópico:", error);
            return { ok: false, code: "create_failed", message: "Não consegui criar o ticket. Verifique se tenho permissão para criar tópicos privados no canal configurado." };
        }
    }

    const category = resolveCategory(guild, config);
    if (!category) return { ok: false, code: "missing_category", message: "A categoria dos tickets não está configurada ou não existe mais. Avise um administrador." };

    const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: view },
        { id: guild.members.me.id, allow: [...view, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }
    ];
    if (config.support_role_id && guild.roles.cache.has(config.support_role_id)) {
        overwrites.push({ id: config.support_role_id, allow: view });
    }
    try {
        const channel = await guild.channels.create({
            name: `ticket-${paddedNumber}-${user.username}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 100),
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites,
            topic: `Ticket #${paddedNumber} · aberto por ${user.tag} (${user.id})`,
            reason: `Ticket aberto por ${user.tag}`
        });
        return { ok: true, channel, parentId: category.id };
    } catch (error) {
        console.error("[Tickets] Erro ao criar canal:", error);
        return { ok: false, code: "create_failed", message: "Não consegui criar o canal do ticket. Verifique se tenho **Gerenciar Canais** na categoria configurada (e se ela não está cheia)." };
    }
}

// Fecha: tópico é arquivado/trancado; canal tem o envio do dono bloqueado e é renomeado.
async function applyClosed(channel, ticket) {
    const padded = String(ticket.number).padStart(4, "0");
    await channel.setName(`fechado-${padded}`.slice(0, 100)).catch(() => null);
    if (channel.isThread?.()) {
        await channel.setArchived(true).catch(() => null);
        await channel.setLocked(true).catch(() => null);
    } else {
        await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: false }).catch(() => null);
    }
}

async function applyReopened(channel, ticket) {
    const padded = String(ticket.number).padStart(4, "0");
    if (channel.isThread?.()) {
        await channel.setLocked(false).catch(() => null);
        await channel.setArchived(false).catch(() => null);
    } else {
        await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: true }).catch(() => null);
    }
    await channel.setName(`ticket-${padded}`.slice(0, 100)).catch(() => null);
}

async function addMember(channel, userId) {
    if (channel.isThread?.()) return channel.members.add(userId);
    return channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
}

async function removeMember(channel, userId) {
    if (channel.isThread?.()) return channel.members.remove(userId);
    return channel.permissionOverwrites.delete(userId);
}

async function buildTranscript(channel, ticket) {
    if (!channel || !channel.messages) {
        return null;
    }

    const lines = [
        `Ticket #${String(ticket.number).padStart(4, "0")}`,
        `Servidor: ${channel.guild?.name || "Desconhecido"}`,
        `Usuário (ID): ${ticket.user_id}`,
        `Fechado em: ${new Date().toISOString()}`,
        "",
        "--- TRANSCRIÇÃO ---",
        ""
    ];

    let lastId;
    const messages = [];

    for (let page = 0; page < 10; page++) {
        const batch = await channel.messages.fetch({ limit: 100, before: lastId || undefined }).catch(() => null);
        if (!batch || batch.size === 0) break;

        const entries = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        messages.push(...entries);
        lastId = entries[0]?.id;

        if (batch.size < 100) break;
    }

    const seen = new Set();
    for (const message of messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);

        const stamp = new Date(message.createdTimestamp).toISOString();
        const author = message.author?.globalName || message.author?.username || "Sistema";
        const content = message.content?.trim() || "[sem texto]";
        const attachments = message.attachments?.size ? ` [anexos: ${[...message.attachments.values()].map(a => a.name || a.url).join(", ")}]` : "";
        lines.push(`[${stamp}] ${author}: ${content}${attachments}`);
    }

    return Buffer.from(lines.join("\n"), "utf8");
}

async function sendTicketTranscript({ guild, channel, ticket, user }) {
    const transcript = await buildTranscript(channel, ticket);
    if (!transcript) return;

    const logChannelId = await GuildRepository.getLogChannel(guild.id).catch(() => null);
    const logChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;

    // Resumo opcional feito pela IA (só se ligado em /config → Tickets).
    const TicketAI = require("../ai/TicketAI");
    const summary = await TicketAI.summarize({ guild, transcript }).catch(() => null);

    if (logChannel?.isTextBased?.()) {
        await logChannel.send({
            content: `📄 Transcrição do ticket #${String(ticket.number).padStart(4, "0")}` + (summary ? `\n🧠 **Resumo da IA**\n${summary}` : ""),
            allowedMentions: { parse: [] },
            files: [{ attachment: transcript, name: `ticket-${String(ticket.number).padStart(4, "0")}.txt` }]
        }).catch(() => null);
    }

    try {
        await user.send({
            content: `📄 Sua conversa do ticket #${String(ticket.number).padStart(4, "0")} foi anexada abaixo.\n` +
                `Também envie uma avaliação de 1 a 5 para ajudar a melhorar o atendimento.`,
            files: [{ attachment: transcript, name: `ticket-${String(ticket.number).padStart(4, "0")}.txt` }],
            components: [
                {
                    type: 1,
                    components: [
                        { type: 2, style: 1, custom_id: `ticket_rate:${channel.id}:1`, label: "1⭐" },
                        { type: 2, style: 1, custom_id: `ticket_rate:${channel.id}:2`, label: "2⭐" },
                        { type: 2, style: 3, custom_id: `ticket_rate:${channel.id}:3`, label: "3⭐" },
                        { type: 2, style: 3, custom_id: `ticket_rate:${channel.id}:4`, label: "4⭐" },
                        { type: 2, style: 4, custom_id: `ticket_rate:${channel.id}:5`, label: "5⭐" }
                    ]
                }
            ]
        });
    } catch {
        // DM bloqueada: não bloqueia o fechamento do ticket.
    }
}

module.exports = {
    MODES,
    normalizeMode,
    modeLabel,
    isStaff,
    resolveCategory,
    createTicketContainer,
    applyClosed,
    applyReopened,
    addMember,
    removeMember,
    buildTranscript,
    sendTicketTranscript
};
