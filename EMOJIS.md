# Emojis personalizados da Nina

44 ícones `ui_*` (128x128 PNG) em `assets/emojis/`, usados nos embeds, botões e menus.

## Colocar no Developer Portal (Application Emojis)

1. No `.env` precisam existir `TOKEN` e `CLIENT_ID`.
2. Rode: `npm run emojis`
   - envia só os que ainda não existem (`npm run emojis -- --force` apaga e reenvia todos).
3. Reinicie a Nina. No log deve aparecer `✨ Emojis personalizados carregados: 44/44`.

Conferir no portal: discord.com/developers/applications → seu app → aba **Emojis**.

## Como funciona no código

- `src/utils/emojis.js`: no `ClientReady` busca os emojis da aplicação e `e("ban")` devolve o custom;
  se não existir, cai no Unicode (nada quebra).
- `src/utils/ui.js`: design system (cores, rodapé, `ui.success/error/warn/info`, `ui.modEmbed`, barras, moeda...).
- Expressões da Nina (`Nina_feliz`, `Nina_triste`...) continuam no `NinaEmojiManager` e aparecem via `ui.mood("feliz")`.

## Editar/adicionar ícones

Edite `scripts/generateEmojis.py` (precisa de `pip install pillow`), rode `npm run emojis:build`
e depois `npm run emojis -- --force`. Para um ícone novo, adicione também o fallback em `src/utils/emojis.js`.
