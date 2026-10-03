const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const ui = require("../../utils/ui");
const { e, component } = require("../../utils/emojis");

const TicketRepository = require("../../database/repositories/TicketRepository");
const { ticketActionRow } = require("../../interactions/tickets/buttonHandler");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("ticket")

        .setDescription("Sistema de tickets do servidor.")

        .addSubcommand(sub =>

            sub
                .setName("setup")
                .setDescription("Configura o sistema de tickets.")
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription("Canal onde os tópicos de ticket serão criados.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("cargo-suporte")
                        .setDescription("Cargo que poderá ver e gerenciar os tickets.")
                        .setRequired(false)
                )

        )

        .addSubcommand(sub =>

            sub
                .setName("painel")
                .setDescription("Envia o painel para abrir tickets no canal atual.")
                .addStringOption(option =>
                    option
                        .setName("titulo")
                        .setDescription("Título do painel.")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("descricao")
                        .setDescription("Descrição do painel.")
                        .setRequired(false)
                )

        )

        .addSubcommand(sub =>

            sub
                .setName("fechar")
                .setDescription("Fecha o ticket atual (use dentro do tópico).")

        )

        .addSubcommand(sub =>

            sub
                .setName("adicionar")
                .setDescription("Adiciona alguém ao ticket atual.")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuário a adicionar.")
                        .setRequired(true)
                )

        )

        .addSubcommand(sub =>

            sub
                .setName("remover")
                .setDescription("Remove alguém do ticket atual.")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuário a remover.")
                        .setRequired(true)
                )

        )

        .addSubcommand(sub =>

            sub
                .setName("listar")
                .setDescription("Lista os tickets abertos no servidor.")

        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        /*
        =========================
            SETUP
        =========================
        */

        if (sub === "setup") {

            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {

                return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor** para configurar os tickets.", "Sem permissão");

            }

            const channel = interaction.options.getChannel("canal");
            const role = interaction.options.getRole("cargo-suporte");

            const botPermissions = channel.permissionsFor(guild.members.me);

            if (
                !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
                !botPermissions.has(PermissionFlagsBits.SendMessagesInThreads) ||
                !botPermissions.has(PermissionFlagsBits.CreatePrivateThreads)
            ) {

                return ui.fail(
                    interaction,
                    `Em ${channel} eu preciso de:\n${ui.bullets(["Ver o canal", "Criar tópicos privados", "Enviar mensagens em tópicos"])}`,
                    "Faltam permissões"
                );

            }

            await TicketRepository.setConfig(guild.id, {
                parent_channel_id: channel.id,
                support_role_id: role?.id ?? null,
                enabled: 1
            });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "ticket",
                title: "Tickets configurados!",
                description: "Tudo pronto. Agora use `/ticket painel` no canal onde quer o botão de abrir ticket.",
                fields: [
                    ui.field("channel", "Tópicos criados em", `${channel}`),
                    ui.field("shield", "Equipe de suporte", role ? `${role}` : "*Somente quem gerencia tópicos*")
                ],
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            PAINEL
        =========================
        */

        if (sub === "painel") {

            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {

                return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor** para enviar o painel.", "Sem permissão");

            }

            const config = await TicketRepository.getConfig(guild.id);

            if (!config.parent_channel_id) {

                return ui.caution(interaction, "Configure o sistema primeiro com `/ticket setup`.", "Tickets não configurados");

            }

            const titulo = interaction.options.getString("titulo") || "Central de Suporte";
            const descricao = interaction.options.getString("descricao") ||
                "Clique no botão abaixo para abrir um ticket com a nossa equipe.";

            const embed = ui.panel({
                color: ui.COLORS.info,
                emoji: "ticket",
                title: titulo,
                description: descricao,
                thumbnail: guild.iconURL({ size: 256 }),
                source: interaction
            });

            const row = new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                    .setCustomId("ticket_open")
                    .setLabel("Abrir Ticket")
                    .setEmoji(component("ticket"))
                    .setStyle(ButtonStyle.Primary)

            );

            await interaction.channel.send({ embeds: [embed], components: [row] });

            return ui.ok(interaction, `O painel de tickets foi enviado em ${interaction.channel}.`, "Painel enviado");

        }

        /*
        =========================
            FECHAR (via comando)
        =========================
        */

        if (sub === "fechar") {

            const ticket = await TicketRepository.getByThread(interaction.channel.id);

            if (!ticket) {

                return ui.caution(interaction, "Este comando só funciona dentro de um tópico de ticket.", "Não é um ticket");

            }

            const config = await TicketRepository.getConfig(guild.id);
            const isOwner = ticket.user_id === interaction.user.id;
            const isStaff =
                interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads) ||
                (config.support_role_id && interaction.member.roles.cache.has(config.support_role_id));

            if (!isOwner && !isStaff) {

                return ui.caution(interaction, "Só quem abriu o ticket ou a equipe de suporte pode fechá-lo.", "Sem permissão");

            }

            const LogManager = require("../../managers/LogManager");
            const LogTypes = require("../../managers/LogTypes");

            await TicketRepository.close(interaction.channel.id, interaction.user.id);

            const paddedNumber = String(ticket.number).padStart(4, "0");

            await LogManager.send({
                type: LogTypes.TICKET_CLOSE,
                guild,
                target: { id: ticket.user_id, tag: `<@${ticket.user_id}>`, username: `<@${ticket.user_id}>` },
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

            await interaction.channel
                .setName(`fechado-${paddedNumber}`.slice(0, 100))
                .catch(() => null);

            await interaction.channel.setArchived(true).catch(() => null);
            await interaction.channel.setLocked(true).catch(() => null);

            return;

        }

        /*
        =========================
            ADICIONAR / REMOVER
        =========================
        */

        if (sub === "adicionar" || sub === "remover") {

            const ticket = await TicketRepository.getByThread(interaction.channel.id);

            if (!ticket) {

                return ui.caution(interaction, "Este comando só funciona dentro de um tópico de ticket.", "Não é um ticket");

            }

            const config = await TicketRepository.getConfig(guild.id);
            const isStaff =
                interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads) ||
                (config.support_role_id && interaction.member.roles.cache.has(config.support_role_id));

            if (!isStaff) {

                return ui.caution(interaction, "Só a equipe de suporte pode gerenciar os membros do ticket.", "Sem permissão");

            }

            const target = interaction.options.getUser("usuario");

            if (sub === "adicionar") {

                await interaction.channel.members.add(target.id);

                return ui.respond(interaction, ui.success(`${target} foi adicionado ao ticket.`, "Membro adicionado", interaction));

            }

            await interaction.channel.members.remove(target.id);

            return ui.respond(interaction, ui.success(`${target} foi removido do ticket.`, "Membro removido", interaction));

        }

        /*
        =========================
            LISTAR
        =========================
        */

        if (sub === "listar") {

            const openTickets = await TicketRepository.listOpen(guild.id);

            if (!openTickets.length) {

                return ui.nothing(interaction, "Nenhum ticket aberto no momento.", "Sem tickets abertos");

            }

            const description = openTickets
                .map(ticket => {

                    const number = String(ticket.number).padStart(4, "0");
                    const claimed = ticket.claimed_by ? ` — assumido por <@${ticket.claimed_by}>` : "";

                    return `${e("ticket")} **#${number}** • <#${ticket.thread_id}>\n┗ aberto por <@${ticket.user_id}>${claimed}`;

                })
                .join("\n");

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.info,
                emoji: "ticket",
                title: `Tickets abertos (${openTickets.length})`,
                description: ui.clip(description, 4000),
                source: interaction
            }), { ephemeral: true });

        }

    }

};
