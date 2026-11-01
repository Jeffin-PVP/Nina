const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const ModerationRepository = require("../../database/repositories/ModerationRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("casos")
        .setDescription("Consulta os casos registrados no servidor.")
        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro específico para consultar (opcional).")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser("membro");

            if (targetUser) {
                const cases = await ModerationRepository.getUserCases({
                    guildId: interaction.guild.id,
                    userId: targetUser.id
                });

                const embed = new EmbedBuilder()
                    .setColor(ui.COLORS.mod)
                    .setTitle(`🧾 Histórico de casos • ${targetUser.tag}`)
                    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                    .setDescription(`Total de registros: **${cases.length}**`)
                    .setFooter({ text: `Servidor: ${interaction.guild.name}` });

                if (!cases.length) {
                    embed.addFields({
                        name: "📌 Registros",
                        value: "Nenhum caso encontrado para este membro."
                    });
                } else {
                    embed.addFields({
                        name: "📌 Casos recentes",
                        value: cases.slice(0, 10).map(caseItem => {
                            const metadata = caseItem.metadata_json ? JSON.parse(caseItem.metadata_json || "{}") : {};
                            const extra = metadata.duration ? ` • ${metadata.duration}` : "";
                            return `**#${caseItem.case_number}** • ${caseItem.type.toUpperCase()}${extra}\n> ${caseItem.reason}`;
                        }).join("\n\n")
                    });
                }

                return interaction.editReply({ embeds: [embed] });
            }

            const cases = await ModerationRepository.getGuildCases({
                guildId: interaction.guild.id,
                limit: 15
            });

            const embed = new EmbedBuilder()
                .setColor(ui.COLORS.mod)
                .setTitle("🧾 Casos do servidor")
                .setDescription(`Últimos ${cases.length} registros de moderação.`)
                .setFooter({ text: `Servidor: ${interaction.guild.name}` });

            if (!cases.length) {
                embed.addFields({
                    name: "📌 Registros",
                    value: "Nenhum caso registrado ainda."
                });
            } else {
                const byType = cases.reduce((acc, item) => {
                    acc[item.type] = (acc[item.type] || 0) + 1;
                    return acc;
                }, {});

                embed.addFields({
                    name: "📊 Resumo",
                    value: Object.entries(byType)
                        .map(([type, count]) => `**${type.toUpperCase()}**: ${count}`)
                        .join(" • ") || "Nenhum dado",
                    inline: false
                }, {
                    name: "📌 Últimos casos",
                    value: cases.slice(0, 8).map(caseItem => `**#${caseItem.case_number}** • ${caseItem.type.toUpperCase()} • <@${caseItem.user_id}> • ${caseItem.reason}`).join("\n")
                });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return interaction.editReply({
                embeds: [ui.error("Ocorreu um erro ao consultar os casos.", undefined, interaction)]
            });
        }
    }
};
