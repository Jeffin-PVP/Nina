const { ChannelType, PermissionFlagsBits } = require("discord.js");

/*
    Acha o melhor canal de texto pra mandar um anúncio num servidor:
    1) o canal de sistema (se o bot puder usar);
    2) senão, o primeiro canal de texto (por posição) onde o bot tem
       permissão de ver, mandar mensagem e usar embed.
    Retorna null se não achar nenhum.
*/

async function encontrarCanalDeAnuncio(guild) {

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);

    if (!botMember) return null;

    const permissoesNecessarias = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ];

    const podeUsar = (channel) => {

        if (channel.type !== ChannelType.GuildText) return false;

        const permissoes = channel.permissionsFor(botMember);

        return !!permissoes && permissoes.has(permissoesNecessarias);

    };

    if (guild.systemChannel && podeUsar(guild.systemChannel)) {

        return guild.systemChannel;

    }

    const primeiroDisponivel = guild.channels.cache

        .filter(podeUsar)

        .sort((a, b) => a.rawPosition - b.rawPosition)

        .first();

    return primeiroDisponivel || null;

}

module.exports = { encontrarCanalDeAnuncio };
