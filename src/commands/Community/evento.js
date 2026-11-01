const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("evento")
        .setDescription("Cria um evento agendado no servidor.")
        .addStringOption(option => option.setName("nome").setDescription("Nome do evento.").setRequired(true))
        .addIntegerOption(option => option.setName("horas").setDescription("A partir de quantas horas no futuro.").setRequired(true).setMinValue(1).setMaxValue(720))
        .addStringOption(option => option.setName("descricao").setDescription("Descrição do evento.").setRequired(false))
        .addChannelOption(option => option.setName("canal").setDescription("Canal para o evento (opcional)").setRequired(false)),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
            return interaction.reply({ content: "Você precisa de **Gerenciar Eventos** para criar eventos.", ephemeral: true });
        }

        const name = interaction.options.getString("nome", true);
        const description = interaction.options.getString("descricao") || "Evento organizado pela Nina.";
        const hours = interaction.options.getInteger("horas", true);
        const channel = interaction.options.getChannel("canal") || interaction.channel;
        const startTime = new Date(Date.now() + hours * 60 * 60 * 1000);

        try {
            const event = await interaction.guild.scheduledEvents.create({
                name,
                description,
                scheduledStartTime: startTime,
                privacyLevel: 2,
                entityType: 2,
                channel: channel.type === 0 ? channel : null,
                reason: `Evento criado por ${interaction.user.tag}`
            });

            return interaction.reply({ content: `✅ Evento criado: ${event.url || event.name}` });
        } catch (error) {
            console.error("[Evento]", error);
            return interaction.reply({ content: "Não consegui criar o evento. Verifique as permissões e o canal.", ephemeral: true });
        }
    }
};
