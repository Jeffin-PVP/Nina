const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");
const LevelManager = require("../../managers/LevelManager");
const RankCardManager = require("../../managers/RankCardManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Mostra o cartão de nível e a posição do membro no servidor.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Membro para consultar.")
                .setRequired(false)
        ),

    async execute(interaction) {
        // Gerar o card leva tempo: confirma a interação antes (limite de 3s do Discord).
        await interaction.deferReply();

        const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const profile = await EconomyManager.getProfile(interaction.guild.id, targetUser.id);
        const rankInfo = await LevelManager.getUserRank(interaction.guild.id, targetUser.id);

        const cardBuffer = await RankCardManager.generateRankCard({
            member: targetMember ?? {
                user: targetUser,
                displayHexColor: "#5865F2",
                guild: interaction.guild
            },
            profile,
            position: rankInfo.position,
            totalUsers: rankInfo.total,
            guild: interaction.guild
        });

        const attachment = new AttachmentBuilder(cardBuffer, { name: `rank-${targetUser.id}.png` });

        return interaction.editReply({ files: [attachment] });
    }
};
