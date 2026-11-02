const AiProviderManager = require("./AiProviderManager");

const embedPrompt =
    require("./prompts/embedPrompt");


class EmbedAI {

    static async generate(prompt, guildId = null) {

        const response = await AiProviderManager.complete(guildId, "embed", {

            model: "openai/gpt-oss-120b",

            temperature: 0.7,

            messages: [

                {
                    role: "system",
                    content: embedPrompt
                },

                {
                    role: "user",
                    content: prompt
                }

            ]

        });

        let content =
            response.choices[0].message.content.trim();

        /*
        =========================
            Remove ```json
        =========================
        */

        content = content

            .replace(/^```json/i, "")

            .replace(/^```/i, "")

            .replace(/```$/i, "")

            .trim();

        /*
        =========================
            Converte em objeto
        =========================
        */

        try {

            return JSON.parse(content);

        } catch (err) {

            console.error("JSON inválido:");

            console.log(content);

            throw new Error(

                "A IA retornou um JSON inválido."

            );

        }

    }

}

module.exports = EmbedAI;