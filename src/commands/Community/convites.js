const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("convites")
        .setDescription("Mostra os convites mais usados do servidor."),

    async execute(interaction) {
        const invites = await interaction.guild.invites.fetch().catch(() => new Map());
        const entries = [...invites.values()].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));

        if (!entries.length) {
            return interaction.reply({ content: "Nenhum convite foi encontrado neste servidor.", ephemeral: true });
        }

        const lines = entries.slice(0, 10).map((invite, index) => {
            const code = invite.code || "?";
            const creator = invite.inviter ? `<@${invite.inviter.id}>` : "Desconhecido";
            return `${index + 1}. **${code}** • ${creator} • ${invite.uses ?? 0} usos`;
        });

        return interaction.reply({ content: `📨 **Convites do servidor**\n\n${lines.join("\n")}` });
    }
};
