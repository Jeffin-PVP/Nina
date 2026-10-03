const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {

    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Mostra os usuários mais ricos do servidor."),

    async execute(interaction) {

        const ranking = await EconomyManager.getLeaderboard(interaction.guild.id, 10);

        if (!ranking.length) {

            return interaction.reply({
                embeds: [ui.info("Ainda não há ninguém na economia deste servidor.", "Ranking vazio", interaction)]
            });

        }

        const lines = [];
        let position = 1;
        let top = 0;

        for (const user of ranking) {

            const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);

            if (!member) continue;

            if (position === 1) top = user.total;

            const icon = MEDALS[position - 1] ?? `\`${String(position).padStart(2, "0")}\``;

            lines.push(
                `${icon} **${member.user.displayName ?? member.user.username}**\n` +
                `┗ ${ui.money(user.total)}  \`${ui.bar(user.total, top, 8)}\``
            );

            position++;

        }

        const embed = ui.titled(
            ui.COLORS.economy,
            "trophy",
            "Ranking econômico",
            lines.length ? lines.join("\n") : "Nenhum usuário encontrado.",
            interaction
        );

        if (interaction.guild.iconURL()) embed.setThumbnail(interaction.guild.iconURL({ size: 256 }));

        embed.setFooter({ text: `${interaction.guild.name} • Nina`, iconURL: interaction.client.user.displayAvatarURL() });

        return interaction.reply({ embeds: [embed] });

    }

};
