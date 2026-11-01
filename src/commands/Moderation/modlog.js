const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const ui = require("../../utils/ui");
const ModerationRepository = require("../../database/repositories/ModerationRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("modlog")
        .setDescription("Mostra a atividade dos moderadores na última semana.")
        .addIntegerOption(option =>
            option
                .setName("dias")
                .setDescription("Quantidade de dias para considerar no relatório.")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(30)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const days = interaction.options.getInteger("dias") ?? 7;
            const summary = await ModerationRepository.getModeratorSummary({
                guildId: interaction.guild.id,
                days
            });

            const embed = new EmbedBuilder()
                .setColor(ui.COLORS.mod)
                .setTitle(`📊 Modlog • últimos ${days} dias`)
                .setDescription("Resumo de ações por moderador.")
                .setFooter({ text: `Servidor: ${interaction.guild.name}` });

            if (!summary.length) {
                embed.addFields({
                    name: "📌 Atividade",
                    value: "Nenhuma ação de moderação foi registrada neste período."
                });
            } else {
                embed.addFields({
                    name: "📌 Resumo",
                    value: summary.slice(0, 10).map(row => {
                        const moderator = `<@${row.moderator_id}>`;
                        return `${moderator} • ${row.total_actions} ações • ${row.warns} warns • ${row.timeouts} timeouts • ${row.kicks} kicks • ${row.bans} bans`;
                    }).join("\n")
                });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return interaction.editReply({
                embeds: [ui.error("Ocorreu um erro ao gerar o modlog.", undefined, interaction)]
            });
        }
    }
};
