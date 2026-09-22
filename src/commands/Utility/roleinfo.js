const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("roleinfo")

        .setDescription("Mostra informações sobre um cargo.")

        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo a consultar.")
                .setRequired(true)
        ),

    async execute(interaction) {

        const role = interaction.options.getRole("cargo");

        const embed = new EmbedBuilder()
            .setColor(role.color || "#5865F2")
            .setTitle(`🎭 ${role.name}`)
            .addFields(
                { name: "ID", value: `\`${role.id}\``, inline: true },
                { name: "Cor", value: role.hexColor, inline: true },
                { name: "Posição", value: `${role.position}`, inline: true },
                { name: "Membros", value: `${role.members.size}`, inline: true },
                { name: "Mencionável", value: role.mentionable ? "Sim" : "Não", inline: true },
                { name: "Exibido separadamente", value: role.hoist ? "Sim" : "Não", inline: true },
                { name: "Gerenciado por integração", value: role.managed ? "Sim" : "Não", inline: true },
                { name: "Criado em", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
            );

        return interaction.reply({ embeds: [embed] });

    }

};
