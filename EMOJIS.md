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


## Padrão visual dos comandos (`src/utils/ui.js`)

Todo comando responde com embeds do design system, nunca com texto puro:

| Helper | Para quê |
| --- | --- |
| `ui.ok / ui.fail / ui.caution / ui.nothing(interaction, texto, título)` | Resposta rápida (sucesso, erro, aviso, lista vazia), já efêmera |
| `ui.panel({ color, emoji, title, description, fields, thumbnail, image, footer, source })` | Embed completo num só lugar |
| `ui.field(emoji, nome, valor, inline)` | Campo com ícone (corta valores acima de 1024 caracteres) |
| `ui.respond(interaction, embed, { ephemeral, components, files })` | Escolhe `reply`, `editReply` ou `followUp` conforme o estado da interação |
| `ui.toggle(bool)` / `ui.bullets([...])` / `ui.code(x)` / `ui.clip(texto, max)` | Estado 🟢/🔴, listas, destaque e limite de tamanho |

Cores: `ui.COLORS.success | error | warn | info | brand | economy | neutral`.
Botões e menus usam `component("nome")` (emoji personalizado com fallback Unicode).
