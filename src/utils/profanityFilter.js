/*
 * Filtro de palavrões (sem dependências do Discord, fácil de testar).
 *
 * Normalização: minúsculas, sem acentos, símbolos viram espaço, letras
 * repetidas colapsam em UMA ("caraaaalho" -> "caralho") e leetspeak básico
 * (m3rd4 -> merda). A lista de palavras passa pela MESMA normalização, então
 * os dois lados sempre batem.
 */

// Lista básica embutida. Cada servidor completa com /automod palavras adicionar.
const PALAVROES_PADRAO = [
    "porra", "caralho", "merda", "bosta", "cacete", "desgraca",
    "puta", "fdp", "foda-se", "fodase", "arrombado", "cuzao", "otario"
];

function colapsar(texto) {
    return texto.replace(/(.)\1+/g, "$1");
}

function normalizar(texto) {

    return colapsar(
        String(texto || "")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
            .replace(/[^a-z0-9\s]/g, " ")                      // pontuação/símbolos viram espaço
            .replace(/\s+/g, " ")
    )
        .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
        .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
        .replace(/\s+/g, " ")
        .trim();

}

// "c a r a l h o" / "p.o.r.r.a" -> junta sequências de letras soltas: ["caralho"]
function sequenciasSoltas(textoNormalizado) {

    const tokens = textoNormalizado.split(" ");
    const sequencias = [];
    let atual = [];

    const fechar = () => {
        if (atual.length >= 3) sequencias.push(colapsar(atual.join("")));
        atual = [];
    };

    for (const token of tokens) {
        if (token.length === 1) atual.push(token);
        else fechar();
    }

    fechar();

    return sequencias;

}

function contemPalavrao(conteudo, palavras) {

    const texto = normalizar(conteudo);

    if (!texto) return false;

    const soltas = sequenciasSoltas(texto);

    return palavras.some(palavra => {

        const p = normalizar(palavra);

        if (!p) return false;

        // palavra inteira no texto (só [a-z0-9 ] sobra após normalizar: regex seguro)
        if (new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(texto)) return true;

        // tentativa de burlar espaçando as letras
        const semEspacos = p.replace(/ /g, "");

        return semEspacos.length >= 4 && soltas.some(s => s.includes(semEspacos));

    });

}

module.exports = { PALAVROES_PADRAO, normalizar, contemPalavrao };
