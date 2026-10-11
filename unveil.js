
const BASE_URL =
    'https://unveil.shardweb.app/api/bots/1551732753047879860';

async function enviarServerCount(client) {
    const token = process.env.UNVEIL_TOKEN;

    if (!token) {
        console.error('[Unveil] UNVEIL_TOKEN não configurado no .env');
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
            console.error('[Unveil] Erro:', response.status, data);
            return;
        }

        console.log(
            `[Unveil] Server count enviado: ${client.guilds.cache.size}`
        );
    } catch (error) {
        console.error('[Unveil] Falha ao enviar estatísticas:', error);
    }
}

function iniciarUnveil(client) {
    client.once('ready', () => {
        enviarServerCount(client);

        setInterval(() => {
            enviarServerCount(client);
        }, 24 * 60 * 60 * 1000);
    });
}

module.exports = { iniciarUnveil, enviarServerCount };