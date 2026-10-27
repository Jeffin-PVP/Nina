const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const { TABLE, ACTIONS } = require("../../managers/AccountFilterManager");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("contasnovas")
        .setDescription("Filtro de contas recém-criadas que tentam entrar no servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName("config").setDescription("Ativa e configura o filtro.")
            .addIntegerOption(o => o.setName("dias").setDescription("Idade mínima da conta, em dias.").setRequired(true).setMinValue(1).setMaxValue(90))
            .addStringOption(o => o.setName("acao").setDescription("O que fazer com contas abaixo do mínimo.").setRequired(true)
                .addChoices(
                    { name: "Apenas alertar a equipe", value: "alert" },
                    { name: "Castigo até a conta atingir a idade mínima", value: "timeout" },
                    { name: "Expulsar automaticamente", value: "kick" }))
            .addChannelOption(o => o.setName("canal").setDescription("Canal dos alertas (recomendado).").addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName("status").setDescription("Mostra a configuração atual."))
        .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa o filtro.")),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor**.", "Sem permissão");
        }
        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === "config") {
            const action = interaction.options.getString("acao");
            const channel = interaction.options.getChannel("canal");
            const me = guild.members.me;
            if (action === "timeout" && !me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return ui.fail(interaction, "Para aplicar castigo eu preciso da permissão **Castigar Membros**.", "Faltam permissões");
            }
            if (action === "kick" && !me.permissions.has(PermissionFlagsBits.KickMembers)) {
                return ui.fail(interaction, "Para expulsar eu preciso da permissão **Expulsar Membros**.", "Faltam permissões");
            }
            if (channel) {
                const perms = channel.permissionsFor(me);
                if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks)) {
                    return ui.fail(interaction, `Em ${channel} eu preciso de: ver o canal, enviar mensagens e incorporar links.`, "Faltam permissões");
                }
            }
            const values = { enabled: 1, min_age_days: interaction.options.getInteger("dias"), action };
            if (channel) values.alert_channel_id = channel.id;
            await Repo.setConfig(TABLE, guild.id, values);
            const saved = await Repo.getConfig(TABLE, guild.id);
            return ui.ok(interaction,
                `Contas com menos de **${saved.min_age_days} dias** → ${ACTIONS[saved.action]}.\nAlertas: ${saved.alert_channel_id ? `<#${saved.alert_channel_id}>` : "*nenhum canal definido*"}`,
                "Filtro ativado");
        }

        if (sub === "desativar") {
            await Repo.setConfig(TABLE, guild.id, { enabled: 0 });
            return ui.ok(interaction, "Filtro de contas novas desativado.", "Desativado");
        }

        const c = await Repo.getConfig(TABLE, guild.id);
        return ui.respond(interaction, ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "",
            title: "Filtro de contas novas",
            description: c.enabled ? "Ativo." : "Desativado. Use `/contasnovas config`.",
            fields: [
                ui.field("<:clock:1561426917717053530>", "Idade mínima", `${c.min_age_days} dia(s)`),
                ui.field("<:shield:1561427396719284334>", "Ação", ACTIONS[c.action] || c.action),
                ui.field("<:ui_textc:1560327137024544808>", "Alertas", c.alert_channel_id ? `<#${c.alert_channel_id}>` : "*nenhum*")
            ],
            source: interaction
        }), { ephemeral: true });
    }
};
