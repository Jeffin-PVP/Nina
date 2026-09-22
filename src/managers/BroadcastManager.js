const { EmbedBuilder } = require("discord.js");

const { encontrarCanalDeAnuncio } = require("../utils/findAnnounceChannel");
const BroadcastRepository = require("../database/repositories/BroadcastRepository");

function buildEmbedComunicado({ title, description, color, footer }) {

    const embed = new EmbedBuilder()
        .setColor(color || "#5865F2")
        .setTitle(title || "📢 Comunicado")
        .setDescription(description)
        .setTimestamp();

    if (footer) embed.setFooter({ text: footer });

    return embed;

}

// Manda o comunicado em todos os servidores em que o bot está.
// Retorna um relatório com quantos deram certo/errado (e por quê).
async function broadcast(client, { title, description, color, footer, kind = "broadcast" }) {

    const embed = buildEmbedComunicado({ title, description, color, footer });

    const resultados = {
        enviados: 0,
        falhas: []
    };

    for (const guild of client.guilds.cache.values()) {

        try {

            const canal = await encontrarCanalDeAnuncio(guild);

            if (!canal) {

                resultados.falhas.push({ guildId: guild.id, guildName: guild.name, motivo: "Nenhum canal disponível." });
                continue;

            }

            await canal.send({ embeds: [embed] });
            resultados.enviados++;

        } catch (error) {

            resultados.falhas.push({ guildId: guild.id, guildName: guild.name, motivo: error.message });

        }

    }

    await BroadcastRepository.log({
        title,
        description,
        color,
        kind,
        sentCount: resultados.enviados,
        failedCount: resultados.falhas.length
    }).catch(() => {});

    return resultados;

}

// Manda o comunicado de reinício e, depois de um pequeno atraso (pra dar tempo
// das mensagens saírem), encerra o processo. Isso SÓ reinicia o bot de verdade
// se ele estiver rodando sob um gerenciador de processo que reinicia sozinho
// quando o processo cai (pm2, systemd com Restart=always, Docker com
// --restart=always, etc). Sem isso, o bot fica desligado até alguém subir de novo.
async function restart(client, { title, description, color, footer, delayMs = 4000 } = {}) {

    const resultados = await broadcast(client, {
        title: title || "🔧 Reiniciando para atualização",
        description: description || "O bot vai reiniciar em instantes. Voltamos logo!",
        color: color || "#FEE75C",
        footer,
        kind: "restart"
    });

    setTimeout(() => {

        console.log("🔁 Reiniciando processo via dashboard...");
        process.exit(0);

    }, delayMs);

    return resultados;

}

module.exports = {
    broadcast,
    restart
};
