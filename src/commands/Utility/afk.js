const { SlashCommandBuilder } = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const { cleanReason } = require("../../managers/AfkManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("afk")
        .setDescription("Marca você como ausente. A Nina avisa quem te mencionar.")
        .setDMPermission(false)
        .addStringOption(option => option
            .setName("motivo")
            .setDescription("Por que você está ausente (opcional).")
            .setMaxLength(100)),

    cooldown: 5,

    async execute(interaction) {
        const reason = cleanReason(interaction.options.getString("motivo"));
        await Repo.setAfk(interaction.guild.id, interaction.user.id, reason);
        return interaction.reply({
            content: `💤 **${interaction.member?.displayName ?? interaction.user.username}** agora está AFK${reason ? `: ${reason}` : "."}\nQuando você voltar a falar no servidor, o AFK sai sozinho.`,
            allowedMentions: { parse: [] }
        });
    }
};
