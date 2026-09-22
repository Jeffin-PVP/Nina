const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("ping")

        .setDescription("Mostra a latência do bot."),

    async execute(interaction) {

        const sent = await interaction.reply({ content: "🏓 Calculando...", fetchReply: true });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const apiPing = interaction.client.ws.ping;

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🏓 Pong!")
            .addFields(
                { name: "Latência da mensagem", value: `${roundtrip}ms`, inline: true },
                { name: "Latência da API (WebSocket)", value: `${apiPing}ms`, inline: true }
            );

        return interaction.editReply({ content: null, embeds: [embed] });

    }

};
