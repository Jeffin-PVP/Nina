# Teste de desempenho da Nina

## O que foi adicionado
- `src/monitoring/performanceMonitor.js`: monitor opcional que registra linhas `[PERF]` a cada 30 segundos com CPU aproximada do processo, RSS, heap, memória externa e atraso aproximado do event loop.
- `scripts/stress-test.js`: teste de carga gradual exclusivamente na rota HTTP pública `/health`. Não envia mensagens, comandos ou interações à API do Discord.

## 1. Ativar o monitor
Na hospedagem, adicione a variável de ambiente:

`NINA_PERF_MONITOR=true`

Reinicie a Nina e observe os logs por 3–5 minutos sem carga. Desative depois definindo `false` ou removendo a variável.

## 2. Executar o teste de carga
O script exige Node.js 18+ (para `fetch` nativo) e usa somente módulos nativos. Execute de uma máquina que consiga alcançar a API:

```bash
NINA_TEST_URL=https://SEU-DOMINIO NINA_TEST_DURATION=15 NINA_TEST_LEVELS=5,10,25 node scripts/stress-test.js
```

No PowerShell:

```powershell
$env:NINA_TEST_URL="https://SEU-DOMINIO"
$env:NINA_TEST_DURATION="15"
$env:NINA_TEST_LEVELS="5,10,25"
node scripts/stress-test.js
```

Para testar uma Nina local, use `http://127.0.0.1:3000`. O teste para de subir de nível se a taxa de falhas chegar a 2% ou o p95 atingir 2 segundos. O limite de concorrência é 50 e a duração máxima por nível é 60 segundos.

## Limitações importantes
- Esse teste mede a disponibilidade e latência da rota `/health`; não representa uma simulação de comandos Discord nem revela sozinho o limite total da Nina.
- A CPU reportada é aproximada e pode ultrapassar 100% quando o processo usa mais de um núcleo. O uso do container e os limites impostos pela hospedagem devem ser conferidos no painel da hospedagem.
- Não execute contra uma URL de terceiros sem autorização. Comece com níveis baixos e pare se a hospedagem mostrar erros, reinícios ou consumo excessivo.
- O ZIP de origem não inclui `package.json`, `.env` ou `reveyl.js`; esses itens não foram inventados nem substituídos. Aplique os arquivos adicionados ao repositório/projeto completo que já possui esses arquivos.
