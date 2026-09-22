const StatsHistoryRepository = require("../database/repositories/StatsHistoryRepository");

const INTERVALO_MS = 60 * 60 * 1000; // checa a cada 1h se o dia mudou

function dataDeHoje() {

    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD

}

async function tirarRetrato(client) {

    if (!client.isReady()) return;

    const servers = client.guilds.cache.size;
    const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    await StatsHistoryRepository.recordSnapshot(dataDeHoje(), servers, members);

}

function start(client) {

    // Registra um retrato assim que o bot conecta, e depois 1x por hora
    // (só grava de verdade quando a data muda, graças ao "ON CONFLICT" na tabela)
    tirarRetrato(client).catch(() => {});

    setInterval(() => {

        tirarRetrato(client).catch(() => {});

    }, INTERVALO_MS);

}

module.exports = { start };
