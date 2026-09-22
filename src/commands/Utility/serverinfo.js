const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("serverinfo")

        .setDescription("Mostra informações sobre o servidor."),

    async execute(interaction) {

        const { guild } = interaction;

        await guild.fetch();

        const owner = await guild.fetchOwner().catch(() => null);

        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const roles = guild.roles.cache.size - 1; // exclui @everyone

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: "ID", value: `\`${guild.id}\``, inline: true },
                { name: "Dono", value: owner ? `${owner.user.tag}` : "Desconhecido", inline: true },
                { name: "Criado em", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Membros", value: `${guild.memberCount}`, inline: true },
                { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0} (nível ${guild.premiumTier})`, inline: true },
                { name: "Cargos", value: `${roles}`, inline: true },
                { name: "Canais de texto", value: `${textChannels}`, inline: true },
                { name: "Canais de voz", value: `${voiceChannels}`, inline: true },
                { name: "Emojis", value: `${guild.emojis.cache.size}`, inline: true }
            )
            .setFooter({ text: `Nível de verificação: ${guild.verificationLevel}` });

        if (guild.description) {
            embed.setDescription(guild.description);
        }

        return interaction.reply({ embeds: [embed] });

    }

};
