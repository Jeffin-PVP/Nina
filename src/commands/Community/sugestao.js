const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("sugestao")
        .setDescription("Envie uma sugestão para a equipe do servidor.")
        .addStringOption(option => option.setName("titulo").setDescription("Título da sugestão.").setRequired(true))
        .addStringOption(option => option.setName("descricao").setDescription("Descreva sua ideia.").setRequired(true).setMaxLength(2000)),

    async execute(interaction) {
        const title = interaction.options.getString("titulo", true);
        const description = interaction.options.getString("descricao", true);

        const message = await interaction.reply({
            content: `💡 **Sugestão enviada**\n\n**${title}**\n${description}`,
            fetchReply: true
        });

        await message.react("👍");
        await message.react("👎");

        await interaction.followUp({
            content: `✅ Sua sugestão foi registrada e está em análise.`,
            ephemeral: true
        });
    }
};
