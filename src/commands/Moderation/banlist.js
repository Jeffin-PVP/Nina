const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("banlist")

        .setDescription("Lista os usuários banidos do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const bans = await interaction.guild.bans.fetch().catch(() => null);

        if (!bans || bans.size === 0) {

            return interaction.editReply({
                content: "📭 Nenhum usuário banido neste servidor."
            });

        }

        const list = bans
            .first(25)
            .map(ban => `\`${ban.user.id}\` — ${ban.user.tag}${ban.reason ? ` (${ban.reason})` : ""}`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`🔨 Usuários Banidos (${bans.size})`)
            .setDescription(list)
            .setFooter({
                text: bans.size > 25
                    ? `Mostrando 25 de ${bans.size}. Use /unban com o ID.`
                    : "Use /unban com o ID para desbanir."
            });

        return interaction.editReply({ embeds: [embed] });

    }

};
