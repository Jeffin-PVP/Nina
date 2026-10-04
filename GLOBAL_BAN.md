# Banimento global de usuários

Implementado na Nina:

- Tabela MySQL `global_bans`.
- `GlobalBanRepository` para persistência.
- `GlobalBanManager` com cache em memória.
- Usuários banidos não podem usar slash commands nem interações da Nina.
- Usuários banidos não recebem XP e não acionam a IA por menção.
- Se o usuário banido for dono de um servidor onde a Nina está, ela sai desse servidor.
- Dashboard do dono com lista, banimento e desbanimento global.
- O ID do usuário é validado como Snowflake Discord.
- A Nina não pode ser banida pelo próprio dashboard.

O banimento global **não expulsa automaticamente o usuário dos servidores** onde ele não é dono; a regra implementada é bloquear o uso da Nina.
