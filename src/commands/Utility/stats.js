const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ui = require("../../utils/ui");
const ServerStatsManager = require("../../managers/ServerStatsManager");
const ServerStatsRepository = require("../../database/repositories/ServerStatsRepository");

const COUNTER_CHOICES = [
    ["Membros", "members"],
    ["Bots", "bots"],
    ["Online", "online"],
    ["Offline", "offline"],
    ["Em call", "voice"],
    ["Canais", "channels"],
    ["Categorias", "categories"],
    ["Cargos", "roles"],
    ["Servidores", "servers"]
];

function statusText(config) {
    return COUNTER_CHOICES.map(([label, key]) =>
        `${config[`${key}_enabled`] ? "🟢" : "🔴"} ${label}`
    ).join("\n");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Gerencia os contadores de estatísticas do servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName("ativar")
            .setDescription("Cria e ativa os contadores."))
        .addSubcommand(sub => sub
            .setName("desativar")
            .setDescription("Desativa e remove os contadores."))
        .addSubcommand(sub => sub
            .setName("atualizar")
            .setDescription("Atualiza os números dos contadores agora."))
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("Mostra quais contadores estão ativos."))
        .addSubcommand(sub => sub
            .setName("contador")
            .setDescription("Ativa ou desativa um contador individual.")
            .addStringOption(option => option
                .setName("nome")
                .setDescription("Contador que deseja configurar.")
                .setRequired(true)
                .addChoices(...COUNTER_CHOICES.map(([name, value]) => ({ name, value }))))
            .addBooleanOption(option => option
                .setName("ativo")
                .setDescription("Se o contador deve aparecer.")
                .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (subcommand === "ativar") {
            await interaction.deferReply({ ephemeral: true });
            await ServerStatsManager.enable(guild);
            return interaction.editReply("📊 **Estatísticas ativadas!** Os contadores foram criados/atualizados.");
        }

        if (subcommand === "desativar") {
            await interaction.deferReply({ ephemeral: true });
            await ServerStatsManager.disable(guild, { remove: true });
            return interaction.editReply("🗑️ **Estatísticas desativadas.** Os contadores foram removidos.");
        }

        if (subcommand === "atualizar") {
            await interaction.deferReply({ ephemeral: true });
            await ServerStatsManager.updateGuild(guild);
            return interaction.editReply("🔄 **Contadores atualizados.**");
        }

        if (subcommand === "contador") {
            await interaction.deferReply({ ephemeral: true });
            const nome = interaction.options.getString("nome", true);
            const ativo = interaction.options.getBoolean("ativo", true);
            await ServerStatsManager.setCounter(guild, nome, ativo);
            return interaction.editReply(`${ativo ? "🟢" : "🔴"} O contador **${ServerStatsManager.COUNTERS[nome].label}** foi ${ativo ? "ativado" : "desativado"}.`);
        }

        const config = await ServerStatsRepository.get(guild.id);
        return ui.respond(
            interaction,
            ui.panel({
                color: config.enabled ? ui.COLORS.success : ui.COLORS.neutral,
                emoji: "chart",
                title: "Estatísticas do servidor",
                description: config.enabled
                    ? "Os contadores estão ativos. Use `/stats contador` para alterar cada um individualmente."
                    : "Os contadores estão desativados. Use `/stats ativar` para criá-los.",
                fields: [
                    ui.field("config", "Status", config.enabled ? "🟢 Ativo" : "🔴 Desativado"),
                    ui.field("chart", "Contadores", statusText(config), false)
                ],
                source: interaction
            }),
            { ephemeral: true }
        );
    }
};
