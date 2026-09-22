const { ActivityType } = require("discord.js");

const SettingsRepository = require("../database/repositories/SettingsRepository");

const TIPOS_ATIVIDADE = {
    PLAYING: ActivityType.Playing,
    WATCHING: ActivityType.Watching,
    LISTENING: ActivityType.Listening,
    COMPETING: ActivityType.Competing,
    STREAMING: ActivityType.Streaming
};

const INTERVALO_PADRAO_SEGUNDOS = 15;

let client = null;
let lista = [];
let indiceAtual = 0;
let intervalo = null;

async function aplicarIndice(i) {

    if (!client || !client.user || !lista.length) return;

    const item = lista[i % lista.length];
    const tipo = TIPOS_ATIVIDADE[item.type] ?? ActivityType.Watching;

    const options = { type: tipo };

    if (tipo === ActivityType.Streaming) {

        options.url = "https://twitch.tv/discord";

    }

    client.user.setActivity(item.text, options);

}

async function recarregar() {

    lista = await SettingsRepository.listPresence();

    if (indiceAtual >= lista.length) indiceAtual = 0;

    if (lista.length) await aplicarIndice(indiceAtual);
    else if (client?.user) client.user.setActivity(null);

}

async function tick() {

    if (!lista.length) return;

    indiceAtual = (indiceAtual + 1) % lista.length;

    await aplicarIndice(indiceAtual);

}

async function start(discordClient) {

    client = discordClient;

    await recarregar();

    if (intervalo) clearInterval(intervalo);

    const intervaloSegundos = parseInt(await SettingsRepository.get("presence_interval_seconds", INTERVALO_PADRAO_SEGUNDOS), 10)
        || INTERVALO_PADRAO_SEGUNDOS;

    intervalo = setInterval(tick, intervaloSegundos * 1000);

    console.log("🟢 Rotação de status iniciada");

}

module.exports = {
    TIPOS_ATIVIDADE: Object.keys(TIPOS_ATIVIDADE),
    start,
    recarregar
};
