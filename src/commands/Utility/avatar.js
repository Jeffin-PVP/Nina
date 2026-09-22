const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("avatar")

        .setDescription("Mostra o avatar de um membro em tamanho grande.")

        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro a consultar (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("membro") ?? interaction.user;

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`🖼️ Avatar de ${user.tag}`)
            .setImage(user.displayAvatarURL({ size: 1024 }));

        return interaction.reply({ embeds: [embed] });

    }

};
