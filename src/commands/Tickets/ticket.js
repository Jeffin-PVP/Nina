const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

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

                return interaction.reply({
                    content: "⚠️ Você precisa de **Gerenciar Servidor** para configurar os tickets.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const channel = interaction.options.getChannel("canal");
            const role = interaction.options.getRole("cargo-suporte");

            const botPermissions = channel.permissionsFor(guild.members.me);

            if (
                !botPermissions.has(PermissionFlagsBits.ViewChannel) ||
                !botPermissions.has(PermissionFlagsBits.SendMessagesInThreads) ||
                !botPermissions.has(PermissionFlagsBits.CreatePrivateThreads)
            ) {

                return interaction.reply({
                    content: "❌ Preciso de permissão para ver o canal, criar tópicos privados e enviar mensagens em tópicos ali.",
                    flags: MessageFlags.Ephemeral
                });

            }

            await TicketRepository.setConfig(guild.id, {
                parent_channel_id: channel.id,
                support_role_id: role?.id ?? null,
                enabled: 1
            });

            return interaction.reply({
                content: `✅ Tickets configurados! Novos tópicos serão criados em ${channel}${role ? `, com acesso para ${role}` : ""}.\nUse \`/ticket painel\` no canal onde quer o botão de abrir ticket.`,
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            PAINEL
        =========================
        */

        if (sub === "painel") {

            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {

                return interaction.reply({
                    content: "⚠️ Você precisa de **Gerenciar Servidor** para enviar o painel.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const config = await TicketRepository.getConfig(guild.id);

            if (!config.parent_channel_id) {

                return interaction.reply({
                    content: "⚠️ Configure o sistema primeiro com `/ticket setup`.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const titulo = interaction.options.getString("titulo") || "🎫 Central de Suporte";
            const descricao = interaction.options.getString("descricao") ||
                "Clique no botão abaixo para abrir um ticket com a nossa equipe.";

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(titulo)
                .setDescription(descricao);

            const row = new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                    .setCustomId("ticket_open")
                    .setLabel("Abrir Ticket")
                    .setEmoji("🎫")
                    .setStyle(ButtonStyle.Primary)

            );

            await interaction.channel.send({ embeds: [embed], components: [row] });

            return interaction.reply({
                content: "✅ Painel enviado!",
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            FECHAR (via comando)
        =========================
        */

        if (sub === "fechar") {

            const ticket = await TicketRepository.getByThread(interaction.channel.id);

            if (!ticket) {

                return interaction.reply({
                    content: "⚠️ Este comando só funciona dentro de um tópico de ticket.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const config = await TicketRepository.getConfig(guild.id);
            const isOwner = ticket.user_id === interaction.user.id;
            const isStaff =
                interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads) ||
                (config.support_role_id && interaction.member.roles.cache.has(config.support_role_id));

            if (!isOwner && !isStaff) {

                return interaction.reply({
                    content: "⚠️ Você não tem permissão para fechar este ticket.",
                    flags: MessageFlags.Ephemeral
                });

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

            await interaction.reply({
                content: `🔒 Ticket fechado por ${interaction.user}.`,
                components: [ticketActionRow("closed")]
            });

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

                return interaction.reply({
                    content: "⚠️ Este comando só funciona dentro de um tópico de ticket.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const config = await TicketRepository.getConfig(guild.id);
            const isStaff =
                interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads) ||
                (config.support_role_id && interaction.member.roles.cache.has(config.support_role_id));

            if (!isStaff) {

                return interaction.reply({
                    content: "⚠️ Só a equipe de suporte pode gerenciar membros do ticket.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const target = interaction.options.getUser("usuario");

            if (sub === "adicionar") {

                await interaction.channel.members.add(target.id);

                return interaction.reply({
                    content: `✅ ${target} foi adicionado ao ticket.`
                });

            }

            await interaction.channel.members.remove(target.id);

            return interaction.reply({
                content: `✅ ${target} foi removido do ticket.`
            });

        }

        /*
        =========================
            LISTAR
        =========================
        */

        if (sub === "listar") {

            const openTickets = await TicketRepository.listOpen(guild.id);

            if (!openTickets.length) {

                return interaction.reply({
                    content: "📭 Nenhum ticket aberto no momento.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const description = openTickets
                .map(ticket => {

                    const number = String(ticket.number).padStart(4, "0");
                    const claimed = ticket.claimed_by ? ` — assumido por <@${ticket.claimed_by}>` : "";

                    return `**#${number}** — <#${ticket.thread_id}> — aberto por <@${ticket.user_id}>${claimed}`;

                })
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(`🎫 Tickets Abertos (${openTickets.length})`)
                .setDescription(description);

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        }

    }

};
