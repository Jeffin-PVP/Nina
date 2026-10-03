const {
    SlashCommandBuilder,
    ChannelType
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const VERIFICATION = ["Nenhuma", "Baixa", "Média", "Alta", "Muito alta"];

// Boosts necessários para cada nível do servidor
const BOOST_GOALS = [0, 2, 7, 14];

module.exports = {

    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Mostra informações sobre o servidor."),

    async execute(interaction) {

        const { guild } = interaction;

        await guild.fetch();

        const owner = await guild.fetchOwner().catch(() => null);

        const channels = guild.channels.cache;
        const text = channels.filter(c => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)).size;
        const voice = channels.filter(c => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)).size;
        const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

        const boosts = guild.premiumSubscriptionCount ?? 0;
        const tier = guild.premiumTier ?? 0;
        const goal = BOOST_GOALS[Math.min(tier + 1, 3)];

        const boostText = tier >= 3
            ? `Nível **3** (máximo) • ${boosts} boosts`
            : `Nível **${tier}** • ${boosts}/${goal}\n\`${ui.bar(boosts, goal)}\``;

        const embed = ui.titled(ui.COLORS.brand, "server", guild.name, guild.description, interaction)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: `${e("crown")} Dono`, value: owner ? `${owner.user}` : "Desconhecido", inline: true },
                { name: `${e("calendar")} Criado`, value: ui.ts(guild.createdTimestamp, "D"), inline: true },
                { name: `${e("id")} ID`, value: `\`${guild.id}\``, inline: true },
                { name: `${e("user")} Membros`, value: ui.num(guild.memberCount), inline: true },
                { name: `${e("role")} Cargos`, value: ui.num(guild.roles.cache.size - 1), inline: true },
                { name: `${e("sparkle")} Emojis`, value: ui.num(guild.emojis.cache.size), inline: true },
                {
                    name: `${e("channel")} Canais (${channels.size})`,
                    value: `Texto: **${text}** • Voz: **${voice}** • Categorias: **${categories}**`
                },
                { name: `${e("boost")} Boosts`, value: boostText, inline: true },
                { name: `${e("shield")} Verificação`, value: VERIFICATION[guild.verificationLevel] ?? "—", inline: true }
            );

        if (guild.bannerURL()) {

            embed.setImage(guild.bannerURL({ size: 1024 }));

        }

        return interaction.reply({ embeds: [embed] });

    }

};
