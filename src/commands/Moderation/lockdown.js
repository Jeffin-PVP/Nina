const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const LockdownManager = require("../../managers/LockdownManager");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lockdown")
        .setDescription("Inicia, encerra ou consulta o lockdown configurado.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub
            .setName("iniciar")
            .setDescription("Bloqueia os canais e categorias configurados no /config.")
            .addStringOption(option => option
                .setName("motivo")
                .setDescription("Motivo do lockdown.")
                .setMaxLength(500)
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName("encerrar")
            .setDescription("Restaura as permissões anteriores dos canais.")
            .addStringOption(option => option
                .setName("motivo")
                .setDescription("Motivo do encerramento.")
                .setMaxLength(500)
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("Mostra o estado e o escopo configurado do lockdown.")),

    async execute(interaction) {
        if (!interaction.guild) {
            return ui.caution(interaction, "Este comando só pode ser usado em um servidor.", "Servidor necessário");
        }

        const action = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (action === "status") {
            const config = await LockdownManager.getConfig(guildId);
            return ui.respond(interaction, ui.panel({
                color: config.active ? ui.COLORS.error : ui.COLORS.info,
                emoji: config.active ? "lock" : "unlock",
                title: `Lockdown ${config.active ? "ativo" : "inativo"}`,
                description: [
                    `Sistema: **${config.enabled ? "ativado" : "desativado"}**`,
                    `Canais selecionados: **${config.channel_ids.length}**`,
                    `Categorias selecionadas: **${config.category_ids.length}**`,
                    `Cargos com acesso: **${config.allowed_role_ids.length}**`,
                    `Cargos sem acesso: **${config.denied_role_ids.length}**`
                ].join("\n"),
                source: interaction
            }), { ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const reason = interaction.options.getString("motivo")
                || (action === "iniciar" ? "Lockdown iniciado pelo comando." : "Lockdown encerrado pelo comando.");
            const result = action === "iniciar"
                ? await LockdownManager.lock(interaction.guild, reason)
                : await LockdownManager.restore(interaction.guild, reason);

            const locked = action === "iniciar";
            return interaction.editReply({
                embeds: [ui.panel({
                    color: locked ? ui.COLORS.error : ui.COLORS.success,
                    emoji: locked ? "lock" : "unlock",
                    title: locked ? "Lockdown iniciado" : "Lockdown encerrado",
                    description: locked
                        ? `${result.lockedChannels} canais foram bloqueados.`
                        : `${result.restoredChannels} canais tiveram as permissões restauradas.`,
                    source: interaction
                })]
            });
        } catch (error) {
            console.error(`[Lockdown:${guildId}] Falha ao executar ${action}:`, error);
            return interaction.editReply({
                embeds: [ui.error(error.message, "Falha no lockdown", interaction)]
            });
        }
    }
};
