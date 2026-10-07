const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const AntiNukeRepository = require("../../database/repositories/AntiNukeRepository");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antinuke")
        .setDescription("Configura a proteção Anti-Nuke da Nina.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub.setName("ativar").setDescription("Ativa o Anti-Nuke."))
        .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa o Anti-Nuke."))
        .addSubcommand(sub => sub.setName("status").setDescription("Mostra a configuração atual."))
        .addSubcommand(sub => sub
            .setName("configurar")
            .setDescription("Ajusta os limites básicos do Anti-Nuke.")
            .addIntegerOption(o => o.setName("janela").setDescription("Janela em segundos (5 a 60).").setMinValue(5).setMaxValue(60).setRequired(true))
            .addIntegerOption(o => o.setName("canais").setDescription("Ações em canais para disparar.").setMinValue(2).setMaxValue(20).setRequired(true))
            .addIntegerOption(o => o.setName("cargos").setDescription("Ações em cargos para disparar.").setMinValue(2).setMaxValue(20).setRequired(true))
            .addIntegerOption(o => o.setName("membros").setDescription("Bans/kicks para disparar.").setMinValue(2).setMaxValue(20).setRequired(true))
            .addStringOption(o => o.setName("acao").setDescription("Ação contra o atacante.").setRequired(true).addChoices(
                { name: "Banir + remover cargos", value: "ban" },
                { name: "Somente remover cargos", value: "strip" }
            ))),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === "ativar" || sub === "desativar") {
            await AntiNukeRepository.setEnabled(guildId, sub === "ativar");
            return ui.respond(interaction, ui.success(
                `O Anti-Nuke foi **${sub === "ativar" ? "ativado" : "desativado"}**.`,
                "Anti-Nuke",
                interaction
            ), { ephemeral: true });
        }

        if (sub === "configurar") {
            await AntiNukeRepository.update(guildId, {
                window_seconds: interaction.options.getInteger("janela", true),
                channel_limit: interaction.options.getInteger("canais", true),
                role_limit: interaction.options.getInteger("cargos", true),
                member_limit: interaction.options.getInteger("membros", true),
                action: interaction.options.getString("acao", true)
            });
            return ui.respond(interaction, ui.success("Os limites do Anti-Nuke foram atualizados.", "Anti-Nuke", interaction), { ephemeral: true });
        }

        const c = await AntiNukeRepository.get(guildId);
        return ui.respond(interaction, ui.panel({
            color: c.enabled ? ui.COLORS.error : ui.COLORS.neutral,
            emoji: "shield",
            title: "Anti-Nuke",
            description: c.enabled ? "🟢 Proteção ativa." : "🔴 Proteção desativada.",
            fields: [
                ui.field("clock", "Janela", `${c.window_seconds}s`),
                ui.field("channel", "Canais", `${c.channel_limit}`),
                ui.field("role", "Cargos", `${c.role_limit}`),
                ui.field("user", "Bans/Kicks", `${c.member_limit}`),
                ui.field("config", "Ação", c.action === "ban" ? "Banir + remover cargos" : "Remover cargos")
            ],
            source: interaction
        }), { ephemeral: true });
    }
};
