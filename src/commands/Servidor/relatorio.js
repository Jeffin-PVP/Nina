const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const { TABLE, DAYS, sendReport } = require("../../managers/WeeklyReportManager");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("relatorio")
        .setDescription("Relatório semanal automático de atividade e moderação.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName("config").setDescription("Ativa o relatório semanal em um canal.")
            .addChannelOption(o => o.setName("canal").setDescription("Canal da equipe onde o relatório será enviado.").setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addIntegerOption(o => o.setName("dia").setDescription("Dia da semana do envio, às 9h de Brasília (padrão: segunda).")
                .addChoices(...DAYS.map((name, value) => ({ name, value })))))
        .addSubcommand(sub => sub.setName("enviar").setDescription("Envia o relatório agora no canal configurado."))
        .addSubcommand(sub => sub.setName("status").setDescription("Mostra a configuração atual."))
        .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa o relatório semanal.")),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor**.", "Sem permissão");
        }
        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === "config") {
            const channel = interaction.options.getChannel("canal");
            const day = interaction.options.getInteger("dia") ?? 1;
            const perms = channel.permissionsFor(guild.members.me);
            if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks)) {
                return ui.fail(interaction, `Em ${channel} eu preciso de: ver o canal, enviar mensagens e incorporar links.`, "Faltam permissões");
            }
            await Repo.setConfig(TABLE, guild.id, { enabled: 1, channel_id: channel.id, day });
            return ui.ok(interaction, `O relatório será enviado em ${channel} toda **${DAYS[day].toLowerCase()}**, às **9h** (Brasília).\nUse \`/relatorio enviar\` para ver um agora.`, "Relatório semanal ativado");
        }

        const config = await Repo.getConfig(TABLE, guild.id);

        if (sub === "desativar") {
            await Repo.setConfig(TABLE, guild.id, { enabled: 0 });
            return ui.ok(interaction, "Relatório semanal desativado.", "Desativado");
        }

        if (sub === "enviar") {
            if (!config.channel_id) return ui.caution(interaction, "Configure antes com `/relatorio config`.", "Não configurado");
            await interaction.deferReply({ ephemeral: true });
            try {
                await sendReport(guild, config.channel_id);
            } catch {
                return ui.fail(interaction, "Não consegui enviar. Verifique se o canal ainda existe e se tenho permissão.", "Falha ao enviar");
            }
            return ui.respond(interaction, ui.success(`Relatório enviado em <#${config.channel_id}>.`, "Enviado", interaction));
        }

        return ui.respond(interaction, ui.panel({
            color: config.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "calendar",
            title: "Relatório semanal",
            description: config.enabled ? "Ativo." : "Desativado. Use `/relatorio config`.",
            fields: config.channel_id ? [
                ui.field("channel", "Canal", `<#${config.channel_id}>`),
                ui.field("calendar", "Envio", `${DAYS[config.day]}, 9h (Brasília)`),
                ui.field("clock", "Último envio", config.last_sent || "*nunca*")
            ] : [],
            source: interaction
        }), { ephemeral: true });
    }
};
