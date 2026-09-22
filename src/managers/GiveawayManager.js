const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const GiveawayRepository = require("../database/repositories/GiveawayRepository");
const LogManager = require("./LogManager");
const LogTypes = require("./LogTypes");

const CHECK_INTERVAL_MS = 10 * 1000; // checa sorteios pra encerrar a cada 10s

/*
=========================
    PARSER DE DURAÇÃO
=========================
*/

// Aceita formatos como "10m", "2h", "1d", "1d12h", "1h30m", etc.
const UNIDADES = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
};

function parseDuracao(texto) {

    const limpo = String(texto || "").trim().toLowerCase().replace(/\s+/g, "");

    if (!limpo) return null;

    const regex = /(\d+)(s|m|h|d|w)/g;
    let total = 0;
    let encontrouAlgo = false;
    let match;

    while ((match = regex.exec(limpo)) !== null) {

        const valor = parseInt(match[1], 10);
        const unidade = match[2];

        total += valor * UNIDADES[unidade];
        encontrouAlgo = true;

    }

    if (!encontrouAlgo) return null;

    return total;

}

function formatarDuracao(ms) {

    const segundosTotais = Math.floor(ms / 1000);

    const dias = Math.floor(segundosTotais / 86400);
    const horas = Math.floor((segundosTotais % 86400) / 3600);
    const minutos = Math.floor((segundosTotais % 3600) / 60);
    const segundos = segundosTotais % 60;

    const partes = [];

    if (dias) partes.push(`${dias}d`);
    if (horas) partes.push(`${horas}h`);
    if (minutos) partes.push(`${minutos}m`);
    if (!dias && !horas && segundos) partes.push(`${segundos}s`);

    return partes.join(" ") || "0s";

}

/*
=========================
    SORTEIO DE VENCEDORES
=========================
*/

function sortearVencedores(pool, quantidade) {

    let restante = [...pool];
    const vencedores = [];

    while (restante.length && vencedores.length < quantidade) {

        const index = Math.floor(Math.random() * restante.length);
        const ganhador = restante[index];

        vencedores.push(ganhador);

        // remove TODAS as entradas desse ganhador (multiplicador gera duplicatas no pool)
        restante = restante.filter(id => id !== ganhador);

    }

    return vencedores;

}

const MULTIPLICADOR_MAXIMO = 10;

// Constrói o "pool" de sorteio duplicando o ID de quem tem cargo com
// multiplicador de entradas (ex: booster vale 2 entradas). Quem já saiu
// do servidor é ignorado (não concorre mais).
async function construirPoolPonderado(guild, participantes, multiplicadores) {

    if (!multiplicadores.length) return [...participantes];

    const pool = [];

    for (const userId of participantes) {

        let multiplicador = 1;

        try {

            const member = await guild.members.fetch(userId);

            for (const m of multiplicadores) {

                if (member.roles.cache.has(m.role_id)) {

                    multiplicador = Math.max(multiplicador, m.multiplier);

                }

            }

        } catch {
            continue; // saiu do servidor
        }

        multiplicador = Math.min(multiplicador, MULTIPLICADOR_MAXIMO);

        for (let i = 0; i < multiplicador; i++) pool.push(userId);

    }

    return pool;

}

/*
=========================
    EMBEDS
=========================
*/

function buildBotaoParticipar(giveawayId, encerrado = false) {

    const row = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId(`giveaway_entrar_${giveawayId}`)
            .setLabel(encerrado ? "Sorteio encerrado" : "Participar")
            .setEmoji("🎉")
            .setStyle(encerrado ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(encerrado)

    );

    return row;

}

function buildEmbedAtivo(giveaway, totalParticipantes) {

    const fimSegundos = Math.floor(giveaway.ends_at / 1000);

    const linhas = [
        `🎁 **Prêmio:** ${giveaway.prize}`,
        `🏆 **Vencedores:** ${giveaway.winners_count}`,
        `👤 **Anfitrião:** <@${giveaway.host_id}>`,
        `👥 **Participantes:** ${totalParticipantes}`,
        `⏰ **Termina:** <t:${fimSegundos}:R> (<t:${fimSegundos}:f>)`
    ];

    if (giveaway.required_role_id) {

        linhas.splice(3, 0, `🔒 **Cargo necessário:** <@&${giveaway.required_role_id}>`);

    }

    return new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("🎉 SORTEIO 🎉")
        .setDescription(linhas.join("\n"))
        .setFooter({ text: `ID do sorteio: ${giveaway.id}` })
        .setTimestamp(giveaway.ends_at);

}

function buildEmbedEncerrado(giveaway, vencedoresIds, totalParticipantes) {

    const fimSegundos = Math.floor(giveaway.ends_at / 1000);

    const linhaVencedores = vencedoresIds.length
        ? vencedoresIds.map(id => `<@${id}>`).join(", ")
        : "Ninguém participou 😕";

    const linhas = [
        `🎁 **Prêmio:** ${giveaway.prize}`,
        `🏆 **Vencedor(es):** ${linhaVencedores}`,
        `👤 **Anfitrião:** <@${giveaway.host_id}>`,
        `👥 **Participantes:** ${totalParticipantes}`,
        `⏰ **Encerrado:** <t:${fimSegundos}:f>`
    ];

    return new EmbedBuilder()
        .setColor(vencedoresIds.length ? "#FEE75C" : "#99AAB5")
        .setTitle("🎉 SORTEIO ENCERRADO 🎉")
        .setDescription(linhas.join("\n"))
        .setFooter({ text: `ID do sorteio: ${giveaway.id}` })
        .setTimestamp();

}

/*
=========================
    ENCERRAR SORTEIO
=========================
*/

async function encerrarSorteio(client, giveaway) {

    await GiveawayRepository.setStatus(giveaway.id, "ended");

    const participantes = await GiveawayRepository.listEntries(giveaway.id);

    let canal = null;

    try {

        canal = await client.channels.fetch(giveaway.channel_id);

    } catch {
        canal = null;
    }

    const multiplicadores = canal ? await GiveawayRepository.listMultipliers(giveaway.guild_id) : [];
    const pool = canal ? await construirPoolPonderado(canal.guild, participantes, multiplicadores) : participantes;
    const vencedores = sortearVencedores(pool, giveaway.winners_count);

    const embedFinal = buildEmbedEncerrado(giveaway, vencedores, participantes.length);

    if (canal) {

        if (giveaway.message_id) {

            try {

                const mensagem = await canal.messages.fetch(giveaway.message_id);

                await mensagem.edit({
                    embeds: [embedFinal],
                    components: [buildBotaoParticipar(giveaway.id, true)]
                });

            } catch {
                // mensagem original pode ter sido apagada, segue só anunciando no canal
            }

        }

        if (vencedores.length) {

            await canal.send({
                content: `🎉 Parabéns ${vencedores.map(id => `<@${id}>`).join(", ")}! Você(s) ganhou/ganharam **${giveaway.prize}**!`
            }).catch(() => {});

        } else {

            await canal.send({
                content: `😕 O sorteio de **${giveaway.prize}** terminou, mas ninguém participou.`
            }).catch(() => {});

        }

        await LogManager.send({
            type: LogTypes.GIVEAWAY_END,
            guild: canal.guild,
            extra: { prize: giveaway.prize, winners: vencedores, participants: participantes.length }
        }).catch(() => {});

    }

    return { vencedores, participantes };

}

/*
=========================
    REROLL
=========================
*/

async function rerollSorteio(client, giveawayId, quantidade, executor) {

    const giveaway = await GiveawayRepository.get(giveawayId);

    if (!giveaway) {

        return { sucesso: false, motivo: "Sorteio não encontrado." };

    }

    if (giveaway.status !== "ended") {

        return { sucesso: false, motivo: "Esse sorteio ainda não terminou." };

    }

    const participantes = await GiveawayRepository.listEntries(giveaway.id);

    if (!participantes.length) {

        return { sucesso: false, motivo: "Não há participantes para sortear novamente." };

    }

    let canal = null;

    try {
        canal = await client.channels.fetch(giveaway.channel_id);
    } catch {
        canal = null;
    }

    const multiplicadores = canal ? await GiveawayRepository.listMultipliers(giveaway.guild_id) : [];
    const pool = canal ? await construirPoolPonderado(canal.guild, participantes, multiplicadores) : participantes;
    const vencedores = sortearVencedores(pool, quantidade || giveaway.winners_count);

    if (canal) {

        await canal.send({
            content: `🔁 Novo sorteio para **${giveaway.prize}**! Parabéns ${vencedores.map(id => `<@${id}>`).join(", ")}!`
        }).catch(() => {});

        await LogManager.send({
            type: LogTypes.GIVEAWAY_REROLL,
            guild: canal.guild,
            executor: executor || client.user,
            extra: { prize: giveaway.prize, winners: vencedores }
        }).catch(() => {});

    }

    return { sucesso: true, vencedores };

}

/*
=========================
    SCHEDULER
=========================
*/

let intervalo = null;

function start(client) {

    if (intervalo) return;

    intervalo = setInterval(async () => {

        try {

            const pendentes = await GiveawayRepository.listDue(Date.now());

            for (const giveaway of pendentes) {

                await encerrarSorteio(client, giveaway);

            }

        } catch (error) {

            console.error("❌ Erro ao processar sorteios pendentes:", error);

        }

    }, CHECK_INTERVAL_MS);

    console.log("🎉 Scheduler de sorteios iniciado");

}

module.exports = {
    parseDuracao,
    formatarDuracao,
    buildBotaoParticipar,
    buildEmbedAtivo,
    buildEmbedEncerrado,
    encerrarSorteio,
    rerollSorteio,
    construirPoolPonderado,
    MULTIPLICADOR_MAXIMO,
    start
};
