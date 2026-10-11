/**
 * COG: Unveil Stats
 * Envia 1x por dia a quantidade de servidores do Gaviux para o site Unveil
 * (POST /api/bots/<ID>/stats), para o número no site ficar sempre certo.
 *
 * - Só o shard principal envia (evita envio duplicado com 2+ shards).
 * - Usa a soma de TODOS os shards (getTotalGuilds), não só o cache local.
 *
 * .env:
 *   UNVEIL_TOKEN=token_do_bot_no_unveil
 *   UNVEIL_BOT_ID=1507709918319345694   (opcional; este é o padrão)
 */

'use strict';

const { isMainShard, isSharded, getTotalGuilds } = require('../utils/shardUtils');

const BOT_ID = process.env.UNVEIL_BOT_ID || '1507709918319345694';
const URL_STATS = `https://unveil.shardweb.app/api/bots/${BOT_ID}/stats`;
const INTERVALO_MS = 24 * 60 * 60 * 1000;

async function enviar(client) {
  const token = process.env.UNVEIL_TOKEN;
  if (!token) {
    console.warn('[UnveilStats] UNVEIL_TOKEN não definido no .env — envio ignorado.');
    return;
  }

  try {
    const total = await getTotalGuilds(client);
    if (!Number.isInteger(total) || total < 1) return;

    const res = await fetch(URL_STATS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ server_count: total }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) console.log(`✅ [UnveilStats] ${total} servidor(es) enviado(s) ao Unveil.`);
    else console.warn(`⚠️  [UnveilStats] Unveil respondeu ${res.status}.`);
  } catch (err) {
    console.error('[UnveilStats] Falha ao enviar:', err.message);
  }
}

module.exports = {
  events: [
    {
      name: 'clientReady',
      once: true,
      execute: async (client) => {
        if (!isMainShard(client)) return;

        // Com shards, espera os outros subirem para a soma sair completa.
        if (isSharded(client)) await new Promise((r) => setTimeout(r, 45_000));

        await enviar(client);
        setInterval(() => enviar(client), INTERVALO_MS).unref();
      },
    },
  ],
};
