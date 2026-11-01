const Groq = require("groq-sdk");

/*
    Cria o cliente Groq só no primeiro uso. Assim, uma chave ausente no .env
    desativa apenas o recurso que depende dela, em vez de derrubar o bot
    inteiro na hora de carregar os módulos. Sem chave, o erro acontece na
    chamada (onde cada recurso já trata falhas) e cada recurso usa a SUA chave,
    sem cair em silêncio na GROQ_API_KEY geral.
*/
module.exports = function lazyGroq(envName) {

    let client = null;

    const get = () => {

        if (!client) {

            const apiKey = process.env[envName];

            if (!apiKey) {
                throw new Error(`${envName} não configurada.`);
            }

            client = new Groq({ apiKey });

        }

        return client;

    };

    return new Proxy({}, { get: (_, prop) => get()[prop] });

};
