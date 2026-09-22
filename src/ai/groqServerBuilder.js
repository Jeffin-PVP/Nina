const Groq = require("groq-sdk");

/*
    Instância separada do Groq, usada SOMENTE pelo comando /criar-servidor.
    Mantê-la isolada da chave usada pelo AIManager (src/ai/groq.js) evita que
    a geração de estruturas de servidor (respostas grandes em JSON) consuma a
    cota da IA conversacional do bot.
*/

module.exports = new Groq({
    apiKey: process.env.GROQ_CRIAR_SERVIDOR_API_KEY
});
