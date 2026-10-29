'use strict';

// Monitor leve e opcional para diagnóstico de desempenho da Nina.
// Ative com NINA_PERF_MONITOR=true. Não registra tokens nem dados de usuários.
function startPerformanceMonitor({ intervalMs = 30_000 } = {}) {
    if (String(process.env.NINA_PERF_MONITOR).toLowerCase() !== 'true') {
        return null;
    }

    let previousCpu = process.cpuUsage();
    let previousTime = process.hrtime.bigint();
    let peakRss = process.memoryUsage().rss;
    let peakHeap = process.memoryUsage().heapUsed;
    let maxEventLoopDelayMs = 0;
    let lastTick = Date.now();

    const timer = setInterval(() => {
        const now = Date.now();
        const elapsedMs = Math.max(1, now - lastTick);
        const delay = Math.max(0, elapsedMs - intervalMs);
        maxEventLoopDelayMs = Math.max(maxEventLoopDelayMs, delay);
        lastTick = now;

        const cpu = process.cpuUsage(previousCpu);
        const elapsedNs = process.hrtime.bigint() - previousTime;
        const elapsedUs = Number(elapsedNs / 1000n) || 1;
        // Aproximação da utilização de CPU do processo: 100% equivale a um núcleo.
        const cpuPercent = ((cpu.user + cpu.system) / elapsedUs) * 100;
        previousCpu = process.cpuUsage();
        previousTime = process.hrtime.bigint();

        const mem = process.memoryUsage();
        peakRss = Math.max(peakRss, mem.rss);
        peakHeap = Math.max(peakHeap, mem.heapUsed);

        const mb = bytes => (bytes / 1024 / 1024).toFixed(1);
        console.log('[PERF]', JSON.stringify({
            timestamp: new Date().toISOString(),
            cpuProcessPercent: Number(cpuPercent.toFixed(1)),
            rssMB: Number(mb(mem.rss)),
            rssPeakMB: Number(mb(peakRss)),
            heapUsedMB: Number(mb(mem.heapUsed)),
            heapPeakMB: Number(mb(peakHeap)),
            heapTotalMB: Number(mb(mem.heapTotal)),
            externalMB: Number(mb(mem.external)),
            arrayBuffersMB: Number(mb(mem.arrayBuffers || 0)),
            eventLoopDelayApproxMs: Math.round(delay),
            eventLoopDelayMaxApproxMs: Math.round(maxEventLoopDelayMs),
            uptimeSeconds: Math.round(process.uptime())
        }));
    }, intervalMs);

    timer.unref?.();
    console.log(`[PERF] Monitor ativado; intervalo de ${intervalMs} ms.`);

    return {
        stop() {
            clearInterval(timer);
            console.log('[PERF] Monitor encerrado.');
        }
    };
}

module.exports = { startPerformanceMonitor };
