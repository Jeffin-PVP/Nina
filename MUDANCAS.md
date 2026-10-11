# Mudanças desta versão

## AutoMod nativo (selo "Uses AutoMod")
- `src/managers/NativeAutomodSync.js` (novo): cria/atualiza 5 regras nativas do Discord por servidor
  (Palavrões, Convites, Menções, Spam, Listas do Discord) a partir da config do `/automod`.
- Sincroniza sozinho: ao entrar num servidor, no start do bot (um servidor a cada 2,5s) e sempre que
  a config muda (`AutomodRepository.update` agenda, com debounce de 3s).
- `src/events/autoModerationActionExecution.js` (novo): registra o warn e o log quando uma regra nativa age.
- `index.js`: intent `AutoModerationExecution` adicionada; cache de regras nativas liberado.
- Para desligar: `NATIVE_AUTOMOD=off` no `.env`.
- Requer permissão **Gerenciar Servidor** para a Nina em cada servidor.
- O selo exige 100 regras somando todos os servidores (≈ 20 servidores com 5 regras cada).

## Bugs corrigidos
- Filtro de palavrão: `caraaaalho`, `porraaaa` não eram pegos; `c a r a l h o` e `p.o.r.r.a` passavam.
  Lógica movida para `src/utils/profanityFilter.js` com testes (`tests/profanityFilter.test.js`).
- Ação "notificar" sem "apagar" dizia que a mensagem foi removida.
- Anti-raid: restaura o estado anterior do @everyone ao destravar (coluna `prev_send`, migração automática),
  reconhece raid ativo após reinício e usa `bannable` no modo `ban_new`.
- `index.js`: log "IA: Conectada" agora reflete se `GROQ_API_KEY` existe.
- API: CORS restrito ao `PUBLIC_URL`; `/api/status` público não expõe mais memória nem versão do Node.

## Não alterado (decisão sua)
- `process.on("uncaughtException")` continua só registrando o erro; o ideal é registrar e reiniciar.
- Sessões do painel continuam em memória (todos deslogam ao reiniciar).


## Correções de revisão (erros encontrados e corrigidos)
- `src/api/server.js`: `routes`, `dashboardRoutes` e `panelRoutes` agora são chamados com `(client)` (antes toda a API travava); CORS realmente restrito ao `PUBLIC_URL`; `TRUST_PROXY` opcional para o IP real atrás de proxy.
- `src/database/database.js`: SIGINT/SIGTERM agora fecham o banco e encerram o processo.
- `unveil.js`: usa `Events.ClientReady` (o evento `ready` é depreciado).
- Economia: `addWallet/removeWallet/addBank/removeBank/addXP` atômicos; `transfer`, `removeMoney`, `deposit` e `withdraw` com débito condicional (sem duplicar moedas); `/daily` e `/work` com coleta atômica; `coinflip`/`slots` só rodam se a aposta foi debitada; `getUser` com `INSERT OR IGNORE`.
