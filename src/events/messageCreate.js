const AIManager = require("../ai/AIManager");
const ContextProvider = require("../ai/ContextProvider");
const LevelManager = require("../managers/LevelManager");
const AutomodManager = require("../managers/AutomodManager");
const NinaEmojiManager = require("../ai/NinaEmojiManager");

module.exports = {

    name: "messageCreate",

    async execute(message) {

        if (message.author.bot) return;

        if (!message.guild) return;

        // AutoMod: se a mensagem for barrada (spam/emoji/palavrão/menção/convite),
        // não processa XP nem resposta de IA em cima dela
        const tratadaPeloAutomod = await AutomodManager.checkMessage(message).catch(error => {

            console.error("[AutoMod] Erro ao verificar mensagem:", error);
            return false;

        });

        if (tratadaPeloAutomod) return;

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
                "❌ Ocorreu um erro ao conversar com a IA."
            );

        }

    }

};