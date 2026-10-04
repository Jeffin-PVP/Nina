const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { validateHttpUrl, isPrivateIp, fetchBuffer } = require("../src/utils/safeFetch");

test("aceita URLs http/https públicas", () => {
    assert.doesNotThrow(() => validateHttpUrl("https://exemplo.com/imagem.png"));
    assert.doesNotThrow(() => validateHttpUrl("http://exemplo.com/a.jpg"));
});

test("rejeita protocolos que não sejam http/https", () => {
    for (const url of ["file:///etc/passwd", "ftp://exemplo.com/a.png", "javascript:alert(1)", "gopher://x"]) {
        assert.throws(() => validateHttpUrl(url), url);
    }
});

test("rejeita localhost, IPs privados e metadata de nuvem", () => {
    for (const url of [
        "http://localhost/a.png",
        "http://127.0.0.1/a.png",
        "http://10.0.0.5/a.png",
        "http://192.168.1.1/a.png",
        "http://172.16.0.1/a.png",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/a.png",
        "http://[::ffff:127.0.0.1]/a.png",
        "https://user:senha@exemplo.com/a.png"
    ]) {
        assert.throws(() => validateHttpUrl(url), url);
    }
});

test("isPrivateIp classifica corretamente", () => {
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("1.1.1.1"), false);
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("100.64.0.1"), true);
    assert.equal(isPrivateIp("fd00::1"), true);
    assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("fetchBuffer não conecta em servidor local (SSRF)", async () => {
    let acessado = false;
    const server = http.createServer((req, res) => { acessado = true; res.end("segredo"); });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();

    try {
        await assert.rejects(() => fetchBuffer(`http://127.0.0.1:${port}/x.png`));
        assert.equal(acessado, false);
    } finally {
        server.close();
    }
});

test("IPv6 mapeado/NAT64 com IPv4 privado é bloqueado (forma normalizada pelo URL)", () => {
    for (const ip of ["::ffff:7f00:1", "::ffff:a00:1", "64:ff9b::7f00:1", "fe80::1", "ff02::1", "::"]) {
        assert.equal(isPrivateIp(ip), true, ip);
    }
    for (const ip of ["::ffff:808:808", "2001:4860:4860::8888"]) {
        assert.equal(isPrivateIp(ip), false, ip);
    }
});

test("fetchBuffer: baixa imagem pública, recusa não-imagem e arquivo grande", async () => {
    const original = global.fetch;

    try {
        global.fetch = async () => new Response(Buffer.from("PNGDATA"), { status: 200, headers: { "content-type": "image/png" } });
        const ok = await fetchBuffer("http://8.8.8.8/a.png");
        assert.equal(ok.toString(), "PNGDATA");

        global.fetch = async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
        await assert.rejects(() => fetchBuffer("http://8.8.8.8/a.png"), /imagem/);

        global.fetch = async () => new Response(Buffer.alloc(2000), { status: 200, headers: { "content-type": "image/png" } });
        await assert.rejects(() => fetchBuffer("http://8.8.8.8/a.png", { maxBytes: 1000 }), /grande/);

        // redirecionamento para IP interno é revalidado e bloqueado
        global.fetch = async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
        await assert.rejects(() => fetchBuffer("http://8.8.8.8/a.png"));
    } finally {
        global.fetch = original;
    }
});
