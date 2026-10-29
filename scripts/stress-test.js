'use strict';

/*
 * Teste de carga HTTP seguro para a rota pública /health da Nina.
 * Não executa comandos do Discord, não envia mensagens e não precisa do token.
 * Execute preferencialmente em janela curta e aumente a carga gradualmente.
 * Node.js 18+ (usa fetch nativo).
 */
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const baseUrl = (process.env.NINA_TEST_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const durationSeconds = clampInt(process.env.NINA_TEST_DURATION, 15, 5, 60);
const levels = (process.env.NINA_TEST_LEVELS || '5,10,25')
    .split(',').map(v => Number.parseInt(v.trim(), 10))
    .filter(v => Number.isInteger(v) && v > 0 && v <= 50);
const pauseSeconds = clampInt(process.env.NINA_TEST_PAUSE, 5, 1, 30);

function clampInt(value, fallback, min, max) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function oneRequest() {
    const start = performance.now();
    try {
        const response = await fetch(`${baseUrl}/health`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'user-agent': 'Nina-Load-Test/1.0' }
        });
        await response.arrayBuffer();
        return { ms: performance.now() - start, ok: response.ok, status: response.status };
    } catch (error) {
        return { ms: performance.now() - start, ok: false, error: error.name || 'RequestError' };
    }
}

async function runLevel(concurrency, seconds) {
    const endAt = Date.now() + seconds * 1000;
    const samples = [];
    let completed = 0;
    let failures = 0;
    let active = 0;

    async function worker() {
        while (Date.now() < endAt) {
            active++;
            const result = await oneRequest();
            active--;
            completed++;
            samples.push(result.ms);
            if (!result.ok) failures++;
        }
    }

    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const elapsedSeconds = (performance.now() - started) / 1000;
    samples.sort((a, b) => a - b);
    const percentile = p => samples.length ? samples[Math.min(samples.length - 1, Math.ceil(p * samples.length) - 1)] : 0;
    return {
        concurrency,
        durationSeconds: Number(elapsedSeconds.toFixed(2)),
        requests: completed,
        requestsPerSecond: Number((completed / elapsedSeconds).toFixed(2)),
        failures,
        failureRatePercent: completed ? Number((failures / completed * 100).toFixed(2)) : 0,
        latencyMs: {
            min: Number((samples[0] || 0).toFixed(1)),
            avg: Number((samples.reduce((a, b) => a + b, 0) / (samples.length || 1)).toFixed(1)),
            p95: Number(percentile(0.95).toFixed(1)),
            max: Number((samples[samples.length - 1] || 0).toFixed(1))
        }
    };
}

(async () => {
    console.log('Nina — teste de carga HTTP na rota /health');
    console.log(`Alvo: ${baseUrl}`);
    console.log(`Duração por nível: ${durationSeconds}s; níveis: ${levels.join(', ') || '(nenhum válido)'}`);
    console.log('Este teste não simula comandos do Discord nem mede diretamente CPU/RAM do container.');

    const health = await oneRequest();
    if (!health.ok) {
        console.error(`Não foi possível acessar ${baseUrl}/health (status ${health.status || health.error}).`);
        console.error('Confira NINA_TEST_URL e se a API da Nina está online.');
        process.exitCode = 1;
        return;
    }

    const results = [];
    for (const level of levels) {
        console.log(`\nIniciando ${level} solicitações concorrentes por ${durationSeconds}s...`);
        const result = await runLevel(level, durationSeconds);
        results.push(result);
        console.log(JSON.stringify(result, null, 2));
        if (result.failureRatePercent >= 2 || result.latencyMs.p95 >= 2000) {
            console.warn('Sinal de alerta: erros >= 2% ou p95 >= 2s. Próximo nível não será executado.');
            break;
        }
        await sleep(pauseSeconds * 1000);
    }

    const output = {
        createdAt: new Date().toISOString(),
        target: `${baseUrl}/health`,
        note: 'Mede apenas a rota HTTP /health. CPU/RAM devem ser lidos nos logs [PERF] e/ou no painel da hospedagem.',
        results
    };
    const outputPath = path.resolve(process.cwd(), `nina-stress-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nRelatório salvo em: ${outputPath}`);
})().catch(error => {
    console.error('Falha no teste:', error);
    process.exitCode = 1;
});
