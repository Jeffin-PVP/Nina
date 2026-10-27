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
const { closeTicket } = require("../../interactions/tickets/buttonHandler");
const TicketManager = require("../../managers/TicketManager");

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
                        .setDescription("Canal pai dos tópicos (modo tópico). No modo canal é opcional.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option
                        .setName("cargo-suporte")
                        .setDescription("Cargo que poderá ver e gerenciar os tickets.")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("modo")
                        .setDescription("Como cada ticket é criado (padrão: tópico privado).")
                        .addChoices(
                            { name: "Tópico privado", value: "thread" },
                            { name: "Canal privado", value: "channel" }
                        )
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName("categoria")
                        .setDescription("Categoria onde os canais de ticket serão criados (modo canal).")
                        .addChannelTypes(ChannelType.GuildCategory)
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
                .setDescription("Fecha o ticket atual (use dentro do ticket).")

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
        const ticketLabel = mode => TicketManager.modeLabel(mode);

        /* SETUP */
        if (sub === "setup") {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
                return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor** para configurar os tickets.", "Sem permissão");
            }

            const current = await TicketRepository.getConfig(guild.id);
            const channel = interaction.options.getChannel("canal");
            const category = interaction.options.getChannel("categoria");
            const role = interaction.options.getRole("cargo-suporte");
            const mode = TicketManager.normalizeMode(interaction.options.getString("modo") || current.mode);
            const me = guild.members.me;

            if (mode === "thread") {
                const parent = channel || guild.channels.cache.get(current.parent_channel_id);
                if (!parent) return ui.caution(interaction, "No modo **tópico privado** informe o `canal` pai dos tópicos.", "Canal obrigatório");
                const perms = parent.permissionsFor(me);
                if (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessagesInThreads) || !perms.has(PermissionFlagsBits.CreatePrivateThreads)) {
                    return ui.fail(interaction, `Em ${parent} eu preciso de:\n${ui.bullets(["Ver o canal", "Criar tópicos privados", "Enviar mensagens em tópicos"])}`, "Faltam permissões");
                }
            } else {
                const cat = category || guild.channels.cache.get(current.category_id) || channel?.parent;
                if (!cat) return ui.caution(interaction, "No modo **canal privado** informe a `categoria` onde os tickets serão criados.", "Categoria obrigatória");
                const perms = cat.permissionsFor(me);
                if (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.ManageChannels)) {
                    return ui.fail(interaction, `Em **${cat.name}** eu preciso de:\n${ui.bullets(["Ver o canal", "Gerenciar canais", "Gerenciar permissões"])}`, "Faltam permissões");
                }
            }

            const values = { mode, enabled: 1 };
            if (channel) values.parent_channel_id = channel.id;
            if (category) values.category_id = category.id;
            if (role) values.support_role_id = role.id;
            await TicketRepository.setConfig(guild.id, values);
            const saved = await TicketRepository.getConfig(guild.id);

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "ticket",
                title: "Tickets configurados!",
                description: "Tudo pronto. Agora use `/ticket painel` no canal onde quer o botão de abrir ticket.",
                fields: [
                    ui.field("ticket", "Modo", ticketLabel(saved.mode)),
                    ui.field("channel", mode === "thread" ? "Tópicos criados em" : "Canais criados na categoria",
                        mode === "thread" ? `<#${saved.parent_channel_id}>` : (TicketManager.resolveCategory(guild, saved)?.name || "*não definida*")),
                    ui.field("shield", "Equipe de suporte", saved.support_role_id ? `<@&${saved.support_role_id}>` : "*Somente quem gerencia tópicos/canais*")
                ],
                source: interaction
            }), { ephemeral: true });
        }

        /* PAINEL */
        if (sub === "painel") {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
                return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor** para enviar o painel.", "Sem permissão");
            }
            if (!guild) return interaction.reply({ content: "Este comando só pode ser usado em servidores.", ephemeral: true });
            const config = await TicketRepository.getConfig(guild.id);
            if (!TicketRepository.isConfigured({ ...config, enabled: 1 })) {
                return ui.caution(interaction, "Configure o sistema primeiro com `/ticket setup`.", "Tickets não configurados");
            }
            const titulo = interaction.options.getString("titulo") || "Central de Suporte";
            const descricao = interaction.options.getString("descricao") || "Clique no botão abaixo para abrir um ticket com a nossa equipe.";
            const embed = ui.panel({
                color: ui.COLORS.info,
                emoji: "ticket",
                title: titulo,
                description: descricao,
                thumbnail: guild.iconURL({ size: 256 }),
                source: interaction
            });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ticket_open").setLabel("Abrir Ticket").setEmoji(component("ticket")).setStyle(ButtonStyle.Primary)
            );
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return ui.ok(interaction, `O painel de tickets foi enviado em ${interaction.channel}.`, "Painel enviado");
        }

        /* FECHAR */
        if (sub === "fechar") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este comando só funciona dentro de um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            const isOwner = ticket.user_id === interaction.user.id;
            if (!isOwner && !TicketManager.isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só quem abriu o ticket ou a equipe de suporte pode fechá-lo.", "Sem permissão");
            }
            return closeTicket(interaction, ticket);
        }

        /* ADICIONAR / REMOVER */
        if (sub === "adicionar" || sub === "remover") {
            const ticket = await TicketRepository.getByThread(interaction.channel.id);
            if (!ticket) return ui.caution(interaction, "Este comando só funciona dentro de um ticket.", "Não é um ticket");
            const config = await TicketRepository.getConfig(guild.id);
            if (!TicketManager.isStaff(interaction.member, config)) {
                return ui.caution(interaction, "Só a equipe de suporte pode gerenciar os membros do ticket.", "Sem permissão");
            }
            const target = interaction.options.getUser("usuario");
            try {
                if (sub === "adicionar") {
                    await TicketManager.addMember(interaction.channel, target.id);
                    return ui.respond(interaction, ui.success(`${target} foi adicionado ao ticket.`, "Membro adicionado", interaction));
                }
                if (target.id === ticket.user_id) {
                    return ui.caution(interaction, "Não dá para remover quem abriu o ticket. Feche o ticket se o atendimento acabou.", "Ação inválida");
                }
                await TicketManager.removeMember(interaction.channel, target.id);
                return ui.respond(interaction, ui.success(`${target} foi removido do ticket.`, "Membro removido", interaction));
            } catch (error) {
                console.error("[Tickets] Falha ao alterar membro:", error);
                return ui.fail(interaction, "Não consegui alterar os membros deste ticket. Verifique minhas permissões.", "Falha");
            }
        }

        /* LISTAR */
        if (sub === "listar") {
            const openTickets = await TicketRepository.listOpen(guild.id);
            if (!openTickets.length) return ui.nothing(interaction, "Nenhum ticket aberto no momento.", "Sem tickets abertos");
            const description = openTickets.map(ticket => {
                const number = String(ticket.number).padStart(4, "0");
                const claimed = ticket.claimed_by ? ` — assumido por <@${ticket.claimed_by}>` : "";
                return `${e("ticket")} **#${number}** • <#${ticket.thread_id}>\n┗ aberto por <@${ticket.user_id}>${claimed}`;
            }).join("\n");
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
