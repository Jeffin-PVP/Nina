# Nina — sistema de emoções

A Nina agora pode escolher uma emoção através do marcador técnico `[[NINA_EMOTION:...]]`.
O marcador é removido antes da mensagem ser enviada ao Discord e substituído pelo emoji personalizado correspondente.

## Teste rápido

1. Garanta que a Nina tenha acesso aos emojis personalizados usados.
2. Inicie com `npm start`.
3. Mencione a Nina e peça algo que provoque uma reação.

Se a Nina responder com um marcador literal, verifique `src/ai/systemPrompt.js` e `src/ai/NinaEmojiManager.js`.
