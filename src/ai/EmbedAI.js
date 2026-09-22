const Groq = require("groq-sdk");

const embedPrompt =
    require("./prompts/embedPrompt");

const groq = new Groq({

    apiKey: process.env.GROQ_API_KEY

});

class EmbedAI {

    static async generate(prompt) {

        const response = await groq.chat.completions.create({

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