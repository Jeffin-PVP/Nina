const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const ModerationRepository = require("../../database/repositories/ModerationRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("historico")
        .setDescription("Mostra o histórico completo de moderação de um membro.")
        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Usuário cuja linha do tempo será consultada.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser("membro");
            const cases = await ModerationRepository.getUserCases({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            const embed = new EmbedBuilder()
                .setColor(ui.COLORS.mod)
                .setTitle(`🧾 Histórico • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setDescription(`**${cases.length}** caso(s) registrados no servidor.`)
                .setFooter({ text: `Servidor: ${interaction.guild.name}` });

            if (!cases.length) {
                embed.addFields({
                    name: "📌 Histórico",
                    value: "Nenhuma ação de moderação registrada para este usuário."
                });
            } else {
                embed.addFields({
                    name: "📌 Registros",
                    value: cases.map(caseItem => {
                        const metadata = caseItem.metadata_json ? JSON.parse(caseItem.metadata_json || "{}") : {};
                        const extra = metadata.duration ? ` • ${metadata.duration}` : "";
                        return `**#${caseItem.case_number}** • ${caseItem.type.toUpperCase()}${extra} • <@${caseItem.moderator_id}>\n${caseItem.reason}`;
                    }).join("\n\n")
                });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return interaction.editReply({
                embeds: [ui.error("Ocorreu um erro ao buscar o histórico do membro.", undefined, interaction)]
            });
        }
    }
};
