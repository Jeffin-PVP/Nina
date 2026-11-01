const { SlashCommandBuilder } = require("discord.js");
const AiRepository = require("../../database/repositories/AiRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("aniversario")
        .setDescription("Registra a data de aniversário de um membro deste servidor.")
        .addStringOption(option => option.setName("data").setDescription("Data no formato DD/MM. Ex.: 12/09").setRequired(true))
        .addUserOption(option => option.setName("usuario").setDescription("Usuário para registrar (opcional)").setRequired(false)),

    async execute(interaction) {
        const raw = interaction.options.getString("data", true).trim();
        const match = /^\d{1,2}\/\d{1,2}$/.exec(raw);
        if (!match) {
            return interaction.reply({ content: "Use o formato DD/MM, por exemplo: 12/09.", ephemeral: true });
        }

        const [dayText, monthText] = raw.split("/");
        const day = Number(dayText);
        const month = Number(monthText);

        if (day < 1 || day > 31 || month < 1 || month > 12) {
            return interaction.reply({ content: "Data inválida. Use um dia de 1 a 31 e um mês de 1 a 12.", ephemeral: true });
        }

        const user = interaction.options.getUser("usuario") ?? interaction.user;
        await AiRepository.setBirthday(interaction.guild.id, user.id, month, day);

        return interaction.reply({
            content: `🎉 Aniversário registrado para ${user}: **${raw}**.`,
            ephemeral: true
        });
    }
};
