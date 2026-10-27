const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");
const TicketRepository = require("../../database/repositories/TicketRepository");
const TicketManager = require("../../managers/TicketManager");
const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");
const ui = require("../../utils/ui");
const { component } = require("../../utils/emojis");

const isStaff = TicketManager.isStaff;

const userTarget = id => ({ id, tag: `<@${id}>`, username: `<@${id}>` });

function ticketActionRow(state) {
    const row = new ActionRowBuilder();
    if (state === "open") {
        row.addComponents(
            new ButtonBuilder().setCustomId("ticket_claim").setLabel("Assumir").setEmoji(component("shield")).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("ticket_close").setLabel("Fechar").setEmoji(component("lock")).setStyle(ButtonStyle.Danger)
        );
    } else {
        row.addComponents(
            new ButtonBuilder().setCustomId("ticket_reopen").setLabel("Reabrir").setEmoji(component("unlock")).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("ticket_delete").setLabel("Deletar").setEmoji(component("purge")).setStyle(ButtonStyle.Danger)
        );
    }
    return row;
}

// Fechamento compartilhado entre o botão e o comando /ticket fechar. O chamador já validou permissões.
async function closeTicket(interaction, ticket) {
    const { guild, channel } = interaction;
    await TicketRepository.close(channel.id, interaction.user.id);
    const paddedNumber = String(ticket.number).padStart(4, "0");
    await LogManager.send({
        type: LogTypes.TICKET_CLOSE,
        guild,
        target: userTarget(ticket.user_id),
        executor: interaction.user,
        extra: { number: paddedNumber }
    });
    await ui.respond(interaction, ui.panel({
        color: ui.COLORS.neutral,
        emoji: "lock",
        title: `Ticket #${paddedNumber} fechado`,
        description: `Fechado por ${interaction.user}.\nA equipe pode reabri-lo pelos botões abaixo.`,
        source: interaction
    }), { components: [ticketActionRow("closed")] });
    await TicketManager.applyClosed(channel, ticket);
}

module.exports = {
    ticketActionRow,
    closeTicket,

    async execute(interaction) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("ticket_")) return;

        const { customId, guild } = interaction;

        /* ABRIR TICKET */
        if (customId === "ticket_open") {
            const config = await TicketRepository.getConfig(guild.id);
            if (!TicketRepository.isConfigured(config)) {
                return ui.caution(interaction, "O sistema de tickets não está configurado neste servidor.", "Tickets indisponíveis");
            }

            const existing = await TicketRepository.getOpenByUser(guild.id, interaction.user.id);
            if (existing) {
                return ui.caution(interaction, `Você já tem um ticket aberto: <#${existing.thread_id}>`, "Ticket já aberto");
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const number = await TicketRepository.nextNumber(guild.id);
            const paddedNumber = String(number).padStart(4, "0");

            const created = await TicketManager.createTicketContainer({ guild, config, user: interaction.user, paddedNumber });
            if (!created.ok) {
                return ui.respond(interaction, ui.error(created.message, "Ticket não criado", interaction));
            }
            const ticketChannel = created.channel;

            await TicketRepository.createTicket({
                guildId: guild.id,
                number,
                threadId: ticketChannel.id,
                parentChannelId: created.parentId,
                userId: interaction.user.id
            });

            const welcomeEmbed = ui.panel({
                color: ui.COLORS.info,
                emoji: "ticket",
                title: `Ticket #${paddedNumber}`,
                description:
                    `Olá ${interaction.user}! Descreva o motivo do seu ticket com o máximo de detalhes.\n` +
                    `A equipe de suporte foi notificada${config.support_role_id ? ` (<@&${config.support_role_id}>)` : ""} e vai te atender em breve.`,
                thumbnail: interaction.user.displayAvatarURL({ size: 128 }),
                fields: [
                    ui.field("user", "Aberto por", `${interaction.user}`),
                    ui.field("calendar", "Abertura", ui.ts(Date.now(), "f"))
                ],
                source: interaction
            });

            await ticketChannel.send({
                content: config.support_role_id ? `<@&${config.support_role_id}>` : undefined,
                embeds: [welcomeEmbed],
                components: [ticketActionRow("open")]
            });

            await LogManager.send({
                type: LogTypes.TICKET_CREATE,
                guild,
                target: interaction.user,
                channel: ticketChannel,
                extra: { number: paddedNumber }
            });

            return ui.respond(interaction, ui.success(`Seu ticket foi criado: <#${ticketChannel.id}>`, "Ticket criado", interaction));
        }

        /* ASSUMIR TICKET */
        if (customId === "ticket_claim") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este canal não é um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            if (!isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só a equipe de suporte pode assumir tickets.", "Sem permissão");
            }
            await TicketRepository.claim(interaction.channel.id, interaction.user.id);
            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "shield",
                title: "Ticket assumido",
                description: `${interaction.user} vai cuidar deste atendimento.`,
                source: interaction
            }));
        }

        /* FECHAR TICKET */
        if (customId === "ticket_close") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este canal não é um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            const isOwner = ticket.user_id === interaction.user.id;
            if (!isOwner && !isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só quem abriu o ticket ou a equipe de suporte pode fechá-lo.", "Sem permissão");
            }
            await interaction.deferReply();
            return closeTicket(interaction, ticket);
        }

        /* REABRIR TICKET */
        if (customId === "ticket_reopen") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este canal não é um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            if (!isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só a equipe de suporte pode reabrir tickets.", "Sem permissão");
            }
            await TicketManager.applyReopened(interaction.channel, ticket);
            await TicketRepository.reopen(interaction.channel.id);
            const paddedNumber = String(ticket.number).padStart(4, "0");
            await LogManager.send({
                type: LogTypes.TICKET_REOPEN,
                guild,
                target: userTarget(ticket.user_id),
                executor: interaction.user,
                extra: { number: paddedNumber }
            });
            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "unlock",
                title: `Ticket #${paddedNumber} reaberto`,
                description: `Reaberto por ${interaction.user}.`,
                source: interaction
            }), { components: [ticketActionRow("open")] });
        }

        /* DELETAR TICKET */
        if (customId === "ticket_delete") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este canal não é um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            if (!isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só a equipe de suporte pode deletar tickets.", "Sem permissão");
            }
            const paddedNumber = String(ticket.number).padStart(4, "0");
            await LogManager.send({
                type: LogTypes.TICKET_DELETE,
                guild,
                target: userTarget(ticket.user_id),
                executor: interaction.user,
                extra: { number: paddedNumber }
            });
            await TicketRepository.remove(interaction.channel.id);
            await ui.respond(interaction, ui.panel({
                color: ui.COLORS.error,
                emoji: "purge",
                title: "Deletando ticket...",
                description: `Este ${interaction.channel.isThread?.() ? "tópico" : "canal"} será removido em instantes.`,
                source: interaction
            }));
            await interaction.channel.delete().catch(() => null);
            return;
        }
    }
};
