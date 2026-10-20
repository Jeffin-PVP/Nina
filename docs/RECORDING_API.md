# Gravação de calls — contrato da API de IA

A Nina **não grava áudio em disco nem no banco**. Os pacotes Opus saem da memória
direto para a API de IA (separada), que armazena, mixa e transcreve. No SQLite da Nina
ficam só metadados (quem gravou, canal, horários, status, participantes).

## Variáveis de ambiente (Nina)

```env
RECORDING_API_URL=https://ia.seudominio.com   # URL base da API de IA
RECORDING_API_KEY=token-longo-e-secreto       # enviado como Bearer em toda chamada
NINA_TIMEZONE=America/Sao_Paulo               # fuso das datas na transcrição (opcional)
RECORDING_MAX_BUFFER_MB=48                    # teto de áudio em RAM se a API cair (opcional)
```

## Dependências novas (não há package.json no zip)

```bash
npm i @discordjs/voice @snazzah/davey libsodium-wrappers
```

- A Nina só **recebe** Opus, não decodifica: não precisa de `opusscript`/`@discordjs/opus`.
- O Discord exige criptografia DAVE em chamadas de voz; use um `@discordjs/voice`
  recente (com suporte a DAVE) junto com `@snazzah/davey`.
- Intent `GuildVoiceStates` já está ativo no `index.js`.
- Permissões do bot no canal: **Ver canal**, **Conectar** e (para o aviso) **Enviar mensagens**.

## Autenticação

`Authorization: Bearer <RECORDING_API_KEY>` em todas as rotas. Erros em JSON: `{ "error": "mensagem" }`.

## Rotas

| Método | Rota | Descrição |
|---|---|---|
| POST | `/v1/recordings` | Abre a gravação. Corpo: `{ guild_id, channel_id, channel_name, started_at (ISO), codec:"opus", sample_rate:48000, channels:2 }`. Resposta: `{ "id": "..." }` |
| POST | `/v1/recordings/:id/chunks?user_id=ID` | Lote de pacotes Opus de **um** usuário (binário, abaixo). Resposta 2xx sem corpo |
| POST | `/v1/recordings/:id/finish` | Corpo: `{ ended_at, participants:[{id,username,globalName,nickname}] }`. Inicia a mixagem. 202 |
| GET | `/v1/recordings/:id` | `{ status, transcript_status, duration_ms, size_bytes }` |
| GET | `/v1/recordings/:id/audio` | Áudio mixado (`audio/ogg`, `audio/mpeg`...) com `Content-Length` |
| POST | `/v1/recordings/:id/transcribe` | Corpo `{ language:"pt" }`. 202; roda em segundo plano |
| GET | `/v1/recordings/:id/transcript` | `{ status, segments:[{ user_id, start_ms, end_ms, text }] }` |
| DELETE | `/v1/recordings/:id` | Apaga áudio e transcrição. 404 se já não existir |

Valores de status: `status` ∈ `processing | ready | failed`;
`transcript_status` ∈ `none | pending | ready | failed`.

### Formato do corpo de `/chunks`

`Content-Type: application/octet-stream`, frames repetidos em big-endian:

```
uint32  offset_ms   ms desde o started_at da gravação (chegada do pacote)
uint16  length      tamanho do pacote Opus
bytes   opus_packet pacote Opus (48 kHz, estéreo), exatamente como veio do Discord
```

A Nina envia lotes a cada ~10 s (ou 256 KB). Pacotes só chegam enquanto a pessoa fala,
então os **intervalos entre `offset_ms` são silêncio**: a API deve posicionar cada pacote
no tempo e preencher os vazios ao mixar. Um mesmo lote pode ser reenviado se uma tentativa falhar,
então ignore pacotes duplicados (mesmo `user_id` + `offset_ms`).

### Transcrição por usuário

Transcreva **cada usuário em uma faixa separada** e devolva `segments` com `user_id` e
`start_ms` relativo ao início da gravação. A Nina monta o `.txt` final: ordena por horário
absoluto (`started_at + start_ms`) e escreve **nome público, nickname, ID e a fala**.

## O que a Nina faz / não faz

- Nina → API: nunca grava em disco; buffer na RAM com teto (`RECORDING_MAX_BUFFER_MB`).
- Isolamento: toda consulta ao banco exige `guild_id`; cada servidor só vê as próprias gravações.
- Download no Discord: anexa se couber no limite do servidor (10/50/100 MB por boost);
  se não couber, orienta a baixar pelo painel web (que repassa o áudio em stream, sem disco).
- Reinício do bot: gravações "em andamento" são finalizadas na API no boot (perde no máximo ~10 s).

## Pontos legais (LGPD / termos do Discord)

- A Nina avisa no chat do canal quando a gravação começa e termina.
- Apagar a gravação (painel web → Excluir) remove áudio e transcrição na API **e** o registro local.
- Defina na sua API uma política de retenção (ex.: apagar após N dias) e criptografia em repouso.
- Gravar voz de terceiros exige base legal/consentimento onde você opera; considere colocar
  um aviso nas regras dos servidores e nos termos do bot.
