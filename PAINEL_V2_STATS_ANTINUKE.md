# Nina — Painel V2: Stats + Anti-Nuke

## Implementado

- `/stats` com ativação/desativação individual dos 9 contadores.
- Contadores em canais de voz bloqueados dentro da categoria `📊・Estatísticas`.
- Atualização periódica dos contadores.
- Atualização por eventos de entrada/saída, voz, presença, canais e cargos.
- `/antinuke` com limites por janela e ação `ban`/`strip`.
- Detecção via Audit Log para canais, cargos, bans, kicks, bots e webhooks.
- Integração do Anti-Nuke com Logs.
- `/config` com categorias Stats e Anti-Nuke.
- Painel web com páginas Stats e Anti-Nuke.
- Painel de Embeds ampliado com URL/ícone de autor e ícone de rodapé.
- Testes automatizados para os repositórios novos.

## Importante

O contador Online/Offline usa `GuildPresences`. É necessário ativar **Presence Intent** no Discord Developer Portal.

O Anti-Nuke precisa de permissões suficientes para consultar Audit Log, gerenciar cargos e aplicar banimento quando essa ação estiver configurada.
