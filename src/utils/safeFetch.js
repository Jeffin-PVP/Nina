/*
=========================
    FETCH SEGURO (anti-SSRF)
=========================
Usado para baixar imagens a partir de URLs informadas por usuários
(ex.: fundo do cartão de boas-vindas). Garante que:
 - só http/https são aceitos;
 - o host não resolve para IP privado/loopback/link-local (inclui metadata da nuvem);
 - redirecionamentos são revalidados a cada salto;
 - há timeout e limite de tamanho.
*/

const dns = require("node:dns").promises;
const net = require("node:net");

function isPrivateIPv4(ip) {

    const p = ip.split(".").map(Number);

    if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;

    const [a, b] = p;

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );

}

// Expande um IPv6 para 8 grupos de 16 bits (aceita "::" e sufixo IPv4 decimal)
function expandIPv6(ip) {

    let v = ip.toLowerCase().split("%")[0];

    const v4 = v.match(/(\d+\.\d+\.\d+\.\d+)$/);

    if (v4) {

        const o = v4[1].split(".").map(Number);

        v = v.slice(0, -v4[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);

    }

    const [head, tail] = v.split("::");
    const h = head ? head.split(":") : [];
    const t = tail !== undefined && tail ? tail.split(":") : [];
    const falta = 8 - h.length - t.length;

    const grupos = tail === undefined ? h : [...h, ...Array(Math.max(falta, 0)).fill("0"), ...t];

    return grupos.map(g => parseInt(g || "0", 16));

}

function isPrivateIPv6(ip) {

    const g = expandIPv6(ip);

    if (g.length !== 8 || g.some(n => Number.isNaN(n))) return true;

    const zerosAteOQuinto = g.slice(0, 5).every(n => n === 0);

    // :: (não especificado) e ::1 (loopback)
    if (g.slice(0, 7).every(n => n === 0) && (g[7] === 0 || g[7] === 1)) return true;

    // IPv4 mapeado (::ffff:a.b.c.d) ou compatível (::a.b.c.d): checa o IPv4 embutido
    if (zerosAteOQuinto && (g[5] === 0xffff || g[5] === 0)) {

        return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);

    }

    // NAT64 (64:ff9b::/96) com IPv4 embutido
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(n => n === 0)) {

        return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);

    }

    const primeiro = g[0];

    return (
        (primeiro & 0xfe00) === 0xfc00 || // fc00::/7 (ULA)
        (primeiro & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
        (primeiro & 0xff00) === 0xff00    // ff00::/8 (multicast)
    );

}

function isPrivateIp(ip) {

    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);

    return true;

}

function parseHttpUrl(raw) {

    let url;

    try {
        url = new URL(String(raw));
    } catch {
        throw new Error("URL inválida.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("A URL precisa começar com http:// ou https://.");
    }

    if (url.username || url.password) {
        throw new Error("URLs com usuário/senha não são permitidas.");
    }

    return url;

}

/** Validação síncrona (para checar o que o usuário digitou antes de salvar). */
function validateHttpUrl(raw) {

    const url = parseHttpUrl(raw);
    const host = url.hostname.replace(/^\[|\]$/g, "");

    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
        throw new Error("Esse endereço não é permitido.");
    }

    if (net.isIP(host) && isPrivateIp(host)) {
        throw new Error("Esse endereço não é permitido.");
    }

    if (String(raw).length > 2000) {
        throw new Error("URL longa demais.");
    }

    return url;

}

async function assertPublicHost(url) {

    const host = url.hostname.replace(/^\[|\]$/g, "");

    if (net.isIP(host)) {

        if (isPrivateIp(host)) throw new Error("Endereço não permitido.");
        return;

    }

    const results = await dns.lookup(host, { all: true });

    if (!results.length || results.some(r => isPrivateIp(r.address))) {
        throw new Error("Endereço não permitido.");
    }

}

/**
 * Baixa um arquivo (imagem) com proteções. Retorna um Buffer.
 */
async function fetchBuffer(rawUrl, { timeoutMs = 8000, maxBytes = 8 * 1024 * 1024, maxRedirects = 3 } = {}) {

    let url = validateHttpUrl(rawUrl);

    for (let salto = 0; salto <= maxRedirects; salto++) {

        await assertPublicHost(url);

        const resposta = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (resposta.status >= 300 && resposta.status < 400 && resposta.headers.get("location")) {

            url = validateHttpUrl(new URL(resposta.headers.get("location"), url).toString());
            continue;

        }

        if (!resposta.ok) throw new Error(`Falha ao baixar imagem (HTTP ${resposta.status})`);

        const tipo = resposta.headers.get("content-type") || "";

        if (tipo && !tipo.toLowerCase().startsWith("image/")) {
            throw new Error("O endereço não aponta para uma imagem.");
        }

        const declarado = Number(resposta.headers.get("content-length") || 0);

        if (declarado > maxBytes) throw new Error("Imagem grande demais.");

        const chunks = [];
        let total = 0;

        for await (const chunk of resposta.body) {

            total += chunk.length;

            if (total > maxBytes) throw new Error("Imagem grande demais.");

            chunks.push(chunk);

        }

        return Buffer.concat(chunks);

    }

    throw new Error("Redirecionamentos demais.");

}

module.exports = {
    fetchBuffer,
    validateHttpUrl,
    isPrivateIp
};
