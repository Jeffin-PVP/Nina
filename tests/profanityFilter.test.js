const test = require("node:test");
const assert = require("node:assert/strict");

const { contemPalavrao, normalizar, PALAVROES_PADRAO } = require("../src/utils/profanityFilter");

const lista = PALAVROES_PADRAO;

test("pega palavras simples e com leetspeak", () => {
    assert.equal(contemPalavrao("que merda", lista), true);
    assert.equal(contemPalavrao("m3rd4", lista), true);
    assert.equal(contemPalavrao("FOD4-S3", lista), true);
});

test("pega letras repetidas (bug antigo: caraaaalho passava)", () => {
    assert.equal(contemPalavrao("caraaaaalho", lista), true);
    assert.equal(contemPalavrao("porraaaa", lista), true);
    assert.equal(contemPalavrao("fodaaaa-se", lista), true);
});

test("pega letras espaçadas ou separadas por símbolos", () => {
    assert.equal(contemPalavrao("c a r a l h o", lista), true);
    assert.equal(contemPalavrao("p.o.r.r.a", lista), true);
});

test("não gera falso positivo em frases normais", () => {
    assert.equal(contemPalavrao("vou por ração no prato", lista), false);
    assert.equal(contemPalavrao("a e o u", lista), false);
    assert.equal(contemPalavrao("computador e reputação", lista), false);
    assert.equal(contemPalavrao("tenho 100 reais", lista), false);
});

test("palavras customizadas passam pela mesma normalização", () => {
    assert.equal(contemPalavrao("seu baaaanana", ["banana"]), true);
    assert.equal(contemPalavrao("", ["banana"]), false);
});

test("normalizar é estável", () => {
    assert.equal(normalizar("Cáraaalho!!"), "caralho");
});
