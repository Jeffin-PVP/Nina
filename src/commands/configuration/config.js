const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const GuildRepository = require("../../database/repositories/GuildRepository");
const TicketRepository = require("../../database/repositories/TicketRepository");
const AutoroleRepository = require("../../database/repositories/AutoroleRepository");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("config")

        .setDescription("Configurações gerais do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>

            sub
                .setName("status")
                .setDescription("Mostra um resumo de todas as configurações do bot.")

        )

        .addSubcommand(sub =>

            sub
                .setName("economia")
                .setDescription("Ativa ou desativa o sistema de economia (moedas, XP, jogos).")
                .addBooleanOption(o => o.setName("ativado").setDescription("Ligar ou desligar.").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("moderacao")
                .setDescription("Ativa ou desativa as ferramentas de moderação da IA e dos comandos.")
                .addBooleanOption(o => o.setName("ativado").setDescription("Ligar ou desligar.").setRequired(true))

        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        if (sub === "economia") {

            const enabled = interaction.options.getBoolean("ativado");

            await GuildRepository.setEconomyEnabled(guild.id, enabled);

            return ui.respond(interaction, ui.panel({
                color: enabled ? ui.COLORS.success : ui.COLORS.neutral,
                emoji: "coin",
                title: `Economia ${enabled ? "ativada" : "desativada"}`,
                description: enabled
                    ? "Moedas, XP e jogos já estão liberados neste servidor."
                    : "Moedas, XP e jogos foram pausados. Nada se perde: os saldos ficam guardados.",
                fields: [ui.field("config", "Estado", ui.toggle(enabled), false)],
                source: interaction
            }), { ephemeral: true });

        }

        if (sub === "moderacao") {

            const enabled = interaction.options.getBoolean("ativado");

            await GuildRepository.setModerationEnabled(guild.id, enabled);

            return ui.respond(interaction, ui.panel({
                color: enabled ? ui.COLORS.success : ui.COLORS.warn,
                emoji: "shield",
                title: `Moderação ${enabled ? "ativada" : "desativada"}`,
                description: enabled
                    ? "Os comandos e a IA já podem banir, expulsar e silenciar membros."
                    : "Comandos e IA **não vão** banir, expulsar ou silenciar até você reativar.",
                fields: [ui.field("config", "Estado", ui.toggle(enabled), false)],
                source: interaction
            }), { ephemeral: true });

        }

        if (sub === "status") {

            const settings = await GuildRepository.getSettings(guild.id);
            const ticketConfig = await TicketRepository.getConfig(guild.id);
            const joinRoles = await AutoroleRepository.getJoinRoles(guild.id);
            const selfRoles = await AutoroleRepository.listSelfRoles(guild.id);
            const levelRoles = await AutoroleRepository.listLevelRoles(guild.id);

            const count = list => list.length ? `${ui.num(list.length)} configurado(s)` : "Nenhum";

            const embed = ui.panel({
                color: ui.COLORS.info,
                emoji: "config",
                title: "Configurações do servidor",
                description: `Resumo do que está ligado em **${guild.name}**.`,
                thumbnail: guild.iconURL({ size: 256 }),
                fields: [
                    ui.field("coin", "Economia", ui.toggle(settings.economy_enabled, "Ativada", "Desativada")),
                    ui.field("shield", "Moderação", ui.toggle(settings.moderation_enabled, "Ativada", "Desativada")),
                    ui.field("trophy", "Aviso de level-up", ui.toggle(settings.levelup_enabled)),
                    ui.field("log", "Canal de logs", settings.log_channel ? `<#${settings.log_channel}>` : "*Não configurado*"),
                    ui.field("ticket", "Tickets", ticketConfig.parent_channel_id
                        ? `🟢 <#${ticketConfig.parent_channel_id}>`
                        : "🔴 Não configurado"),
                    ui.field("user", "Cargos de entrada", count(joinRoles)),
                    ui.field("role", "Self-roles", count(selfRoles)),
                    ui.field("star", "Cargos por nível", count(levelRoles))
                ],
                footer: "Ajuste cada área com /logs, /ticket, /autorole e /config",
                source: interaction
            });

            return ui.respond(interaction, embed, { ephemeral: true });

        }

    }

};
