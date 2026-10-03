const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType
} = require("discord.js");

const AIManager = require("../../ai/AIManager");

const ui = require("../../utils/ui");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("ia")
        .setDescription("Use a IA da Nina sem precisar adicionar o bot ao servidor.")
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("perguntar")
                .setDescription("Faça uma pergunta para a IA da Nina.")
                .addStringOption(option =>
                    option
                        .setName("pergunta")
                        .setDescription("O que você quer perguntar para a IA?")
                        .setRequired(true)
                        .setMaxLength(4000)
                )
        ),

    async execute(interaction) {

        const question = interaction.options.getString("pergunta", true).trim();

        if (!question) {
            return ui.fail(interaction, "Você precisa escrever uma pergunta.", "Pergunta vazia");
        }

        await interaction.deferReply();

        try {

            const response = await AIManager.askUser({
                interaction,
                question
            });

            if (!response) {
                return ui.respond(interaction, ui.error("A IA não retornou uma resposta. Tente reformular a pergunta.", "Sem resposta", interaction));
            }

            // Descrição de embed aceita até 4096 caracteres; quebramos um pouco antes.
            const chunks = [];

            for (let i = 0; i < response.length; i += 3900) {
                chunks.push(response.slice(i, i + 3900));
            }

            const first = ui.panel({
                color: ui.COLORS.brand,
                emoji: "ai",
                title: "Nina responde",
                description: chunks.shift() || "Sem resposta.",
                fields: [{
                    name: `${ui.mood("pensativa") || ""} Pergunta`.trim(),
                    value: ui.quote(ui.clip(question, 300))
                }],
                source: interaction
            });

            await interaction.editReply({ embeds: [first] });

            for (const chunk of chunks) {
                await interaction.followUp({
                    embeds: [ui.base(ui.COLORS.brand, interaction).setDescription(chunk)]
                });
            }

        } catch (error) {

            console.error("[IA] Erro no /ia perguntar:", error);

            await ui.respond(interaction, ui.error(
                "Não consegui falar com a IA agora. Tente novamente em alguns instantes.",
                "IA indisponível",
                interaction
            ));

        }

    }

};
