const groq = require("./groq");

const systemPrompt = require("./systemPrompt");

const ToolManager = require("./ToolManager");

const ConversationMemory = require("./ConversationMemory");
const NinaEmojiManager = require("./NinaEmojiManager");

const MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ROUNDS = 6;

class AIManager {

    /*
    =====================================
        CONTEXTO -> TEXTO
    =====================================
    */

    static buildContextBlock(context) {

        if (!context) return "";

        return `
Contexto atual (use para responder de forma consciente de onde você está, mas nunca repita isso literalmente para o usuário):

- Servidor: ${context.server.name} (ID: ${context.server.id}, ${context.server.memberCount} membros)
- Canal atual: #${context.channel.name} (ID: ${context.channel.id})
- Quem está falando com você: ${context.author.displayName} (@${context.author.username}, ID: ${context.author.id})
- Cargos de quem está falando: ${context.author.roles.length ? context.author.roles.join(", ") : "Nenhum"}
`;

    }

    /*
    =====================================
        CHAT NORMAL (com tool-calling nativo)
    =====================================
    */

    static async chat({ message, question, context }) {

        const channelId = message.channel.id;

        const contextBlock = this.buildContextBlock(context);

        const messages = [

            {
                role: "system",
                content: `${systemPrompt}\n${contextBlock}`
            },

            // Histórico curto da conversa neste canal
            ...ConversationMemory.get(channelId),

            {
                role: "user",
                content: question
            }

        ];

        const tools = ToolManager.getTools();

        let finalContent = null;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {

            const response = await groq.chat.completions.create({

                model: MODEL,

                temperature: 0.3,

                messages,

                tools,

                tool_choice: "auto"

            });

            const choice = response.choices[0].message;

            // A IA decidiu responder direto, sem (mais) ferramentas
            if (!choice.tool_calls || choice.tool_calls.length === 0) {

                finalContent = choice.content;
                break;

            }

            // Guarda a mensagem do assistente (com as tool_calls) no histórico da requisição
            messages.push(choice);

            console.log(`\n====== RODADA ${round + 1}: ${choice.tool_calls.length} ferramenta(s) ======`);

            for (const toolCall of choice.tool_calls) {

                const toolName = toolCall.function.name;

                let args = {};

                try {

                    args = toolCall.function.arguments
                        ? JSON.parse(toolCall.function.arguments)
                        : {};

                } catch (err) {

                    console.error(`[AIManager] Argumentos inválidos para ${toolName}:`, toolCall.function.arguments);

                }

                console.log(`→ ${toolName}`, args);

                const result = await ToolManager.execute(toolName, message, args);

                console.log(`← resultado:`, result);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result ?? { success: false, error: "Sem retorno." })
                });

            }

        }

        // Estourou o limite de rodadas sem uma resposta final — força uma última chamada sem tools
        if (finalContent === null) {

            const response = await groq.chat.completions.create({

                model: MODEL,

                temperature: 0.2,

                messages: [
                    ...messages,
                    {
                        role: "system",
                        content: "Responda agora ao usuário usando apenas as informações já obtidas. Não peça para usar mais ferramentas."
                    }
                ]

            });

            finalContent = response.choices[0].message.content;

        }

        const processed = NinaEmojiManager.apply(finalContent);
        finalContent = processed.emoji
            ? `${processed.content} ${processed.emoji}`.trim()
            : processed.content;

        // Atualiza a memória de conversa do canal sem guardar o marcador técnico.
        ConversationMemory.push(channelId, "user", question);
        ConversationMemory.push(channelId, "assistant", finalContent);

        return finalContent;

    }

    /*
    =====================================
        IA PARA USER INSTALL
    =====================================

        Esta rota não usa ferramentas do servidor.
        Isso permite que /ia perguntar funcione mesmo
        quando a Nina não está instalado no servidor.
    */

    static async askUser({ interaction, question }) {

        const channelId = interaction.channelId || interaction.channel?.id || `user:${interaction.user.id}`;

        const guildName = interaction.guild?.name || "conversa privada";

        const contextBlock = `
Contexto limitado desta interação:
- Local: ${guildName}
- Usuário: ${interaction.user.username}

IMPORTANTE:
- Esta conversa usa o modo de instalação pessoal (User Install).
- Não presuma que a Nina está instalado no servidor.
- Não tente consultar membros, canais, cargos, permissões, regras ou outros dados do servidor.
- Não execute ações administrativas.
- Responda somente à pergunta do usuário usando o conhecimento disponível e o histórico desta conversa.
`;

        const messages = [
            {
                role: "system",
                content: `${systemPrompt}\n${contextBlock}`
            },
            ...ConversationMemory.get(channelId),
            {
                role: "user",
                content: question
            }
        ];

        const response = await groq.chat.completions.create({
            model: MODEL,
            temperature: 0.3,
            messages
        });

        let finalContent = response.choices?.[0]?.message?.content?.trim();

        if (!finalContent) {
            throw new Error("A IA retornou uma resposta vazia.");
        }

        const processed = NinaEmojiManager.apply(finalContent);
        finalContent = processed.emoji
            ? `${processed.content} ${processed.emoji}`.trim()
            : processed.content;

        ConversationMemory.push(channelId, "user", question);
        ConversationMemory.push(channelId, "assistant", finalContent);

        return finalContent;

    }

    /*
    =====================================
        GERADOR DE EMBEDS
    =====================================
    */

    static async generateEmbed(prompt) {

        const response =
            await groq.chat.completions.create({

                model: MODEL,

                temperature: 0.15,

                response_format: {
                    type: "json_object"
                },

                messages: [

                    {

                        role: "system",

                        content: `
Você é um especialista em criar Embeds para Discord.

Sua resposta deve ser APENAS um JSON válido.

Formato:

{
  "title": "",
  "description": "",
  "color": "#5865F2",

  "author": {
    "name": "",
    "iconURL": "",
    "url": ""
  },

  "footer": {
    "text": "",
    "iconURL": ""
  },

  "thumbnail": "",

  "image": "",

  "timestamp": false,

  "fields": [

    {

      "name": "",

      "value": "",

      "inline": false

    }

  ]

}

Regras:

- Nunca escreva markdown.
- Nunca utilize \`\`\`json.
- Nunca explique nada.
- Apenas JSON válido.
- Se um campo não for necessário, deixe vazio.
`

                    },

                    {

                        role: "user",

                        content: prompt

                    }

                ]

            });

        let content =
            response.choices[0]
                .message.content
                .trim();

        content = content

            .replace(/```json/gi, "")

            .replace(/```/g, "")

            .trim();

        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");

        if (start !== -1 && end !== -1) {

            content = content.substring(
                start,
                end + 1
            );

        }

        try {

            return JSON.parse(content);

        } catch (err) {

            console.error("Erro ao converter JSON:");
            console.error(content);

            throw err;

        }

    }

}

module.exports = AIManager;
