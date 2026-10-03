const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

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
                embeds: [ui.info("Nenhum usuário banido neste servidor.", "Banlist vazia", interaction)]
            });

        }

        const list = bans
            .first(25)
            .map(ban => `\`${ban.user.id}\` — ${ban.user.tag}${ban.reason ? ` (${ban.reason})` : ""}`)
            .join("\n");

        const embed = ui.titled(ui.COLORS.mod, "ban", `Usuários banidos (${bans.size})`, list, interaction)
            .setFooter({
                text: bans.size > 25
                    ? `Mostrando 25 de ${bans.size}. Use /unban com o ID.`
                    : "Use /unban com o ID para desbanir."
            });

        return interaction.editReply({ embeds: [embed] });

    }

};
