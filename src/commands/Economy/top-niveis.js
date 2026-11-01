const { SlashCommandBuilder } = require("discord.js");

const EconomyRepository = require("../../database/repositories/EconomyRepository");
const ui = require("../../utils/ui");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top-niveis")
        .setDescription("Mostra os usuários com maior nível no servidor."),

    async execute(interaction) {
        const ranking = await EconomyRepository.getGuildLevelLeaderboard(interaction.guild.id, 10);

        if (!ranking.length) {
            return interaction.reply({
                embeds: [ui.info("Ainda não há membros com XP neste servidor.", "Ranking de níveis vazio", interaction)]
            });
        }

        const lines = [];

        for (let index = 0; index < ranking.length; index++) {
            const entry = ranking[index];
            const member = await interaction.guild.members.fetch(entry.user_id).catch(() => null);
            const displayName = member?.displayName ?? member?.user?.username ?? `Usuário ${entry.user_id.slice(-4)}`;
            const medal = MEDALS[index] ?? `#${index + 1}`;

            lines.push(`${medal} **${displayName}** • Nível ${entry.level} • ${entry.xp} XP`);
        }

        const embed = ui.titled(
            ui.COLORS.economy,
            "trophy",
            "Top níveis do servidor",
            lines.join("\n"),
            interaction
        );

        return interaction.reply({ embeds: [embed] });
    }
};
