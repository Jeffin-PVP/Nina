const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags
} = require("discord.js");

const AIManager = require("../../ai/AIManager");

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
            return interaction.reply({
                content: "❌ Você precisa escrever uma pergunta.",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        try {

            const response = await AIManager.askUser({
                interaction,
                question
            });

            if (!response) {
                return interaction.editReply(
                    "❌ A IA não retornou uma resposta.",
                );
            }

            // Discord limita mensagens a 2000 caracteres.
            const chunks = [];

            for (let i = 0; i < response.length; i += 1900) {
                chunks.push(response.slice(i, i + 1900));
            }

            await interaction.editReply(chunks.shift() || "❌ Sem resposta.");

            for (const chunk of chunks) {
                await interaction.followUp(chunk);
            }

        } catch (error) {

            console.error("[IA] Erro no /ia perguntar:", error);

            await interaction.editReply(
                "❌ Não consegui falar com a IA agora. Tente novamente em alguns instantes."
            );

        }

    }

};
