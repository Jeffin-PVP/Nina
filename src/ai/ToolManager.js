const tools = require("../tools");
const GuildRepository = require("../database/repositories/GuildRepository");

class ToolManager {


    /**
     * Executa uma ferramenta.
     * @param {string} toolName
     * @param {import("discord.js").Message} message
     * @param {Object} args
     */
    static async execute(toolName, message, args = {}) {


        const tool = tools[toolName];


        if (!tool) {

            throw new Error(
                `Ferramenta "${toolName}" não encontrada.`
            );

        }


        // Apenas servidores
        if (tool.guildOnly && !message.guild) {

            throw new Error(
                "Esta ferramenta só pode ser utilizada em servidores."
            );

        }


        // Módulo de moderação desativado no servidor
        if (
            tool.category === "Moderation" &&
            message.guild
        ) {

            const moderationEnabled =
                await GuildRepository.isModerationEnabled(message.guild.id);

            if (!moderationEnabled) {

                throw new Error(
                    "O módulo de moderação está desativado neste servidor. Ative com /config moderacao ativado:true"
                );

            }

        }


        // Apenas dono do bot
        if (tool.ownerOnly) {


            const ownerId = process.env.OWNER_ID;


            if (!ownerId) {

                throw new Error(
                    "OWNER_ID não configurado no .env."
                );

            }


            if (message.author.id !== ownerId) {

                throw new Error(
                    "Você não possui permissão para utilizar esta ferramenta."
                );

            }

        }


        // Verificação de permissões
        if (
            tool.permissions &&
            tool.permissions.length > 0
        ) {


            const missing = tool.permissions.filter(permission =>

                !message.member.permissions.has(permission)

            );


            if (missing.length > 0) {

                throw new Error(
                    `Permissões necessárias: ${missing.join(", ")}`
                );

            }

        }


        try {


            return await tool.execute(
                message,
                args
            );


        } catch (error) {


            console.error(
                `[ToolManager] Erro em ${tool.name}:`,
                error
            );


            return {

                success: false,

                error: error.message

            };


        }


    }



    /**
     * Busca um membro do servidor.
     */
    static async getMember(message, userId) {


        if (!message.guild) {

            return null;

        }


        return await message.guild.members.fetch(userId)
            .catch(() => null);


    }



    /**
     * Verifica se o bot pode agir contra um membro.
     */
    static checkHierarchy(message, targetMember) {


        const botMember = message.guild.members.me;



        if (!targetMember) {

            return {

                allowed: false,

                reason: "Usuário não encontrado."

            };

        }



        // Não agir contra o próprio bot
        if (targetMember.id === botMember.id) {

            return {

                allowed: false,

                reason: "Não posso agir contra mim mesmo."

            };

        }



        // Não agir contra o dono do servidor
        if (targetMember.id === message.guild.ownerId) {

            return {

                allowed: false,

                reason: "Não posso agir contra o dono do servidor."

            };

        }



        // Verifica hierarquia de cargos
        if (

            targetMember.roles.highest.position >=
            botMember.roles.highest.position

        ) {


            return {

                allowed: false,

                reason:
                    "Não posso agir contra alguém com cargo igual ou superior ao meu."

            };


        }



        return {

            allowed: true

        };


    }



    /**
     * Retorna todas as ferramentas carregadas.
     */
    static getTools() {

        return Object.values(tools).map(tool => ({

            type: "function",

            function: {

                name: tool.name,

                description: tool.description,

                parameters: tool.parameters

            }

        }));

    }



    /**
     * Lista apenas os nomes.
     */
    static getNames() {

        return Object.keys(tools);

    }



    /**
     * Verifica se uma ferramenta existe.
     */
    static has(toolName) {

        return Object.prototype.hasOwnProperty.call(
            tools,
            toolName
        );

    }


}


module.exports = ToolManager;