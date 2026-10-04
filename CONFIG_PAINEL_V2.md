# Nina — Painel de Configuração V2

## Melhorias

- Corrigido o botão **Fechar**: o painel agora tenta apagar a resposta efêmera em vez de apenas limpar os componentes.
- AutoMod ganhou controles individuais para Spam, Emojis, Palavrões, Menções, Convites, Anti-Raid e Anti-Scam.
- Mantidos os modais de limites do Spam, Anti-Raid e Anti-Scam.
- Boas-vindas ganhou configuração de **imagem de fundo por URL** e opção para remover o fundo.
- Boas-vindas agora exibe no painel qual fundo está configurado.
- Autoroles ganhou configuração direta de cargos de entrada, self-roles e cargos por nível.
- Validação de hierarquia da Nina foi aplicada às configurações de autorole.
- Os comandos antigos continuam disponíveis para configurações avançadas.

## Imagem de fundo

O Discord não permite anexar um arquivo diretamente dentro de um modal. Por isso o painel V2 usa uma URL `http://` ou `https://` da imagem. O comando antigo `/boasvindas imagem` continua aceitando upload de anexo.

## Validação

- Sintaxe JavaScript: todos os arquivos JS válidos.
- Testes existentes: 4/4 passando.
