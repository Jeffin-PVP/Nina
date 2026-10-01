const groq = require("../ai/groq");

const MODEL = process.env.ANTISCAM_MODEL || "qwen/qwen3.8-27b";

const SYSTEM_PROMPT = `Você é o classificador visual Anti-Scam da Nina.

Sua função é analisar imagens enviadas em servidores do Discord e identificar sinais VISUAIS de golpes, phishing ou falsas promessas financeiras.

Categorias possíveis:
- crypto_scam: suposta plataforma de cripto, USDT, BTC etc. com sinais de saque falso, lucro garantido, depósito para liberar saque, comprovante duvidoso ou promessa financeira enganosa.
- phishing: tela/site que tenta obter senha, código, token ou dados pessoais.
- fake_payment: falso comprovante, pagamento ou transferência.
- fake_giveaway: falso prêmio, recompensa ou sorteio usado para induzir a vítima a clicar/pagar/entregar dados.
- fake_investment: promessa visual de investimento/lucro garantido ou esquema financeiro suspeito.
- fake_reward: falsa recompensa, Nitro, gift card ou benefício semelhante.
- other_scam: outro padrão visual claro de golpe.
- legitimate: conteúdo aparentemente legítimo, sem sinais suficientes de golpe.
- uncertain: não há evidência visual suficiente para classificar.

IMPORTANTE:
- Não classifique uma imagem como golpe apenas porque ela contém dinheiro, bancos, criptomoedas ou uma pessoa famosa.
- Procure combinação de sinais: promessas irreais, saques milagrosos, pedidos de pagamento para liberar dinheiro, interfaces suspeitas, urgência, phishing, links ou instruções para entregar credenciais.
- Não invente informações que não aparecem na imagem.
- A classificação é uma indicação automatizada, não uma prova de fraude.
- Responda SOMENTE em JSON válido.`;

async function analisarImagem(urls) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY não configurada.");
    }

    const imagens = urls.slice(0, 3).map(url => ({
        type: "image_url",
        image_url: { url }
    }));

    const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: SYSTEM_PROMPT
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `Analise as imagens e retorne exatamente este formato JSON:
{
  "is_scam_like": false,
  "category": "legitimate",
  "confidence": 0,
  "reasons": ["motivo curto"]
}

confidence deve ser um número entre 0 e 1. Se não houver evidência suficiente, use is_scam_like=false e category="uncertain".`
                    },
                    ...imagens
                ]
            }
        ]
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("O classificador visual não retornou conteúdo.");
    }

    let resultado;

    try {
        resultado = JSON.parse(content);
    } catch {
        throw new Error("O classificador visual retornou JSON inválido.");
    }

    const categorias = new Set([
        "crypto_scam",
        "phishing",
        "fake_payment",
        "fake_giveaway",
        "fake_investment",
        "fake_reward",
        "other_scam",
        "legitimate",
        "uncertain"
    ]);

    const confidence = Math.max(0, Math.min(1, Number(resultado.confidence) || 0));
    const category = categorias.has(resultado.category) ? resultado.category : "uncertain";
    const reasons = Array.isArray(resultado.reasons)
        ? resultado.reasons.map(String).slice(0, 5)
        : [];

    return {
        is_scam_like: Boolean(resultado.is_scam_like) && category !== "legitimate" && category !== "uncertain",
        category,
        confidence,
        reasons
    };
}

module.exports = {
    analisarImagem,
    MODEL
};
