const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lembrete")
        .setDescription("Agenda um lembrete para você ou para o canal atual.")
        .addStringOption(option => option.setName("mensagem").setDescription("Mensagem do lembrete.").setRequired(true))
        .addIntegerOption(option => option.setName("tempo").setDescription("Tempo em minutos até o lembrete.").setRequired(true).setMinValue(1).setMaxValue(43200))
        .addBooleanOption(option => option.setName("dm").setDescription("Enviar por DM em vez do canal atual.").setRequired(false)),

    async execute(interaction) {
        const messageText = interaction.options.getString("mensagem", true);
        const minutes = interaction.options.getInteger("tempo", true);
        const sendDm = interaction.options.getBoolean("dm") ?? false;

        const target = sendDm ? interaction.user : interaction.channel;

        setTimeout(async () => {
            try {
                await target.send({ content: `⏰ Lembrete: ${messageText}` });
            } catch {
                // ignora falhas de envio
            }
        }, minutes * 60 * 1000);

        return interaction.reply({
            content: `⏰ Lembrete agendado para **${minutes} minutos**.`,
            ephemeral: true
        });
    }
};
