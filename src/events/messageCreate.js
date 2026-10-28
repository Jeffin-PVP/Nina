const { E } = require("../config/emojiRegistry");
const AIManager = require("../ai/AIManager");
const ContextProvider = require("../ai/ContextProvider");
const LevelManager = require("../managers/LevelManager");
const AutomodManager = require("../managers/AutomodManager");
const NinaEmojiManager = require("../ai/NinaEmojiManager");
const GlobalBanManager = require("../managers/GlobalBanManager");
const SecurityManager = require("../managers/SecurityManager");
const AnalyticsRepository = require("../database/repositories/AnalyticsRepository");
const AfkManager = require("../managers/AfkManager");

module.exports = {

    name: "messageCreate",

    async execute(message) {

        if (message.author.bot) return;

        if (!message.guild) return;

        // Usuário banido globalmente não pode conversar com a Nina nem gerar XP.
        if (await GlobalBanManager.isBanned(message.author.id)) return;

        // Security Center: TopicGuard, canal-isca e sinais comportamentais.
        // Erros de segurança não devem interromper o restante do bot.
        const tratadaPeloSecurity = await SecurityManager.handleMessage(message).catch(error => {
            console.error("[Security Center] Erro ao verificar mensagem:", error);
            return false;
        });
        if (tratadaPeloSecurity) return;

        // AutoMod: se a mensagem for barrada (spam/emoji/palavrão/menção/convite),
        // não processa XP nem resposta de IA em cima dela
        const tratadaPeloAutomod = await AutomodManager.checkMessage(message).catch(error => {

            console.error("[AutoMod] Erro ao verificar mensagem:", error);
            return false;

        });

        if (tratadaPeloAutomod) return;

        // Analytics: guarda somente contagens agregadas, nunca o conteúdo da mensagem.
        await AnalyticsRepository.recordMessage({
            guildId: message.guild.id,
            channelId: message.channelId,
            channelName: message.channel?.name || "Canal removido",
            userId: message.author.id
        }).catch(error => console.error("[Analytics] Falha ao registrar mensagem:", error));

        // AFK: tira o AFK de quem voltou e avisa quando alguém menciona um usuário ausente.
        await AfkManager.handleMessage(message).catch(error => console.error("[AFK] Falha:", error));

        // Concede XP (com cooldown) independente de mencionar o bot ou não
        await LevelManager.handleMessage(message);

        if (message.mentions.everyone) return;

        if (!message.mentions.has(message.client.user)) return;

        const question = message.content
            .replace(`<@${message.client.user.id}>`, "")
            .replace(`<@!${message.client.user.id}>`, "")
            .trim();

        if (!question) {

            return message.reply(
                `Olá! Como posso ajudar? ${NinaEmojiManager.get("oi")}`
            );

        }

        try {

            await message.channel.sendTyping();

            const context = await ContextProvider.build(message);

            const response = await AIManager.chat({

                message,
                question,
                context

            });

            await message.reply(response);

        } catch (err) {

            console.error(err);

            await message.reply(
                `${E("ui_cancel")} Ocorreu um erro ao conversar com a IA.`
            );

        }

    }

};