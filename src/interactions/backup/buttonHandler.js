const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const BackupManager = require("../../managers/BackupManager");

module.exports = {
    async execute(interaction) {
        const [, action, a, b] = interaction.customId.split(":");
        const ownerId = action === "confirm" ? b : a;
        if (interaction.user.id !== ownerId) {
            return interaction.reply({ content: "Só quem iniciou a restauração pode confirmar.", ephemeral: true });
        }
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "Você precisa de **Administrador**.", ephemeral: true });
        }
        if (action === "cancel") {
            return interaction.update({ embeds: [new EmbedBuilder().setColor(0x99aab5).setDescription("Restauração cancelada.")], components: [] });
        }

        const backup = await Repo.getBackup(interaction.guild.id, Number(a));
        if (!backup) return interaction.update({ content: "Esse backup não existe mais.", embeds: [], components: [] });

        await interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription("♻️ Restaurando… isso pode levar alguns minutos.")], components: [] });
        let lastEdit = 0;
        try {
            const stats = await BackupManager.restore(interaction.guild, backup.data, async text => {
                if (Date.now() - lastEdit < 4000) return;
                lastEdit = Date.now();
                await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(`♻️ Restaurando… ${text}`)] }).catch(() => null);
            });
            const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ Restauração concluída")
                .setDescription(
                    `**${backup.name}**\n` +
                    `• Cargos criados: **${stats.rolesCreated}**\n• Categorias criadas: **${stats.categoriesCreated}**\n• Canais criados: **${stats.channelsCreated}**\n` +
                    `• Já existiam (ignorados): **${stats.skipped}**\n• Falhas: **${stats.failed}**` +
                    (stats.failed ? "\n\nFalhas costumam ser falta de permissão, limite de canais/cargos ou canais de Comunidade em servidor sem esse recurso." : "")
                );
            return interaction.editReply({ embeds: [embed] }).catch(() => null);
        } catch (error) {
            console.error("[Backup] Falha na restauração:", error);
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle("Falha na restauração").setDescription(error.message || "Erro inesperado.")] }).catch(() => null);
        }
    }
};
