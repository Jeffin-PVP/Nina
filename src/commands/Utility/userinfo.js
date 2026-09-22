const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("userinfo")

        .setDescription("Mostra informações sobre um membro.")

        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro a consultar (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("membro") ?? interaction.user;
        const member = interaction.options.getMember("membro") ?? interaction.member;

        const roles = member?.roles?.cache
            ?.filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => `${role}`) ?? [];

        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor && member.displayHexColor !== "#000000" ? member.displayHexColor : "#5865F2")
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "ID", value: `\`${user.id}\``, inline: true },
                { name: "Conta criada", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {

            embed.addFields(
                { name: "Entrou no servidor", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Desconhecido", inline: true },
                { name: `Cargos (${roles.length})`, value: roles.length ? roles.slice(0, 20).join(", ") : "Nenhum" }
            );

            if (member.premiumSinceTimestamp) {

                embed.addFields({
                    name: "Impulsionando desde",
                    value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`,
                    inline: true
                });

            }

        }

        return interaction.reply({ embeds: [embed] });

    }

};
