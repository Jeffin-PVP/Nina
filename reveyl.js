const { Events } = require('discord.js');

const BASE_URL =
    'https://reveyl.shardweb.app/api/bots/1551732753047879860';

async function enviarServerCount(client) {
    const token = process.env.REVEYL_TOKEN;

    if (!token) {
        console.error('[Reveyl] REVEYL_TOKEN não configurado no .env');
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/stats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token,
            },
            body: JSON.stringify({
                server_count: client.guilds.cache.size,
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok === false) {
            console.error('[Reveyl] Erro:', response.status, data);
            return;
        }

        console.log(
            `[Reveyl] Server count enviado: ${client.guilds.cache.size}`
        );
    } catch (error) {
        console.error('[Reveyl] Falha ao enviar estatísticas:', error);
    }
}

function iniciarReveyl(client) {
    client.once(Events.ClientReady, () => {
        enviarServerCount(client);

        setInterval(() => {
            enviarServerCount(client);
        }, 24 * 60 * 60 * 1000);
    });
}

module.exports = { iniciarReveyl, enviarServerCount };