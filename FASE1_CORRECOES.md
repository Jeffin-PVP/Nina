# Nina — Fase 1 corrigida

## Correções

- Anti-Scam usa `ANTISCAM_GROQ_API_KEY` através de `src/antiScam/groq.js`.
- `economy_transactions` usa `description` no INSERT.
- `SettingsRepository` escapa a coluna reservada `key`.
- Proteção central de hierarquia adicionada ao `ToolManager` para ban, kick, timeout, remoção de timeout e warn.
- Eventos agora possuem isolamento de erros para evitar rejeições não tratadas derrubando handlers.
- Adicionados logs globais para `unhandledRejection` e `uncaughtException`.
- `AutomodManager`, `CooldownManager` e `LevelManager` receberam limpeza periódica de caches em memória.
- Sessões do painel recebem limpeza periódica.
- Pool MySQL recebeu timeout de conexão de 10 segundos.
- Adicionados testes básicos de hierarquia em `tests/moderationSafety.test.js`.
- `npm test` agora executa `node --test`.
- `@napi-rs/canvas` permanece em `0.1.100` com o pacote musl opcional.

## Variáveis

```env
GROQ_API_KEY=SUA_CHAVE_DA_NINA
ANTISCAM_GROQ_API_KEY=SUA_CHAVE_EXCLUSIVA_ANTISCAM
ANTISCAM_MODEL=qwen/qwen3.8-27b
DATABASE_URL=mysql://...
```

Nenhum segredo foi incluído neste pacote.
