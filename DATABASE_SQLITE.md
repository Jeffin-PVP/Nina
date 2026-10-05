# Banco SQLite da Nina

A Nina agora usa SQLite nativo do Node.js (`node:sqlite`).

## Localização

O banco fica fora de `src/`:

```text
data/nina.db
```

O diretório `data/` é criado automaticamente na inicialização.

## Configuração

Não é mais necessário `DATABASE_URL`, `mysql2` ou um servidor MySQL para o banco local da Nina.

## Persistência

Em produção, o diretório `data/` precisa estar em um armazenamento persistente da hospedagem. Se o container for recriado sem volume persistente, o arquivo `nina.db` também será perdido.

## SQLite

A conexão usa WAL, foreign keys e `busy_timeout` para lidar melhor com as leituras/escritas do bot. O `database.js` mantém a interface `run`, `get` e `all`, então os comandos continuam usando os repositories existentes.
