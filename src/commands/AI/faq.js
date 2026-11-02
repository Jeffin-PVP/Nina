const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const ui = require("../../utils/ui");
const AiRepository = require("../../database/repositories/AiRepository");
const PlanManager = require("../../managers/PlanManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("faq")
        .setDescription("Gerencie as respostas automáticas da IA do servidor.")
        .addSubcommand(sub =>
            sub.setName("adicionar")
                .setDescription("Adicionar uma resposta automática para a IA.")
                .addStringOption(option => option.setName("pergunta").setDescription("Pergunta que a IA deve reconhecer.").setRequired(true))
                .addStringOption(option => option.setName("resposta").setDescription("Resposta que a IA deve devolver.").setRequired(true).setMaxLength(2000))
        )
        .addSubcommand(sub =>
            sub.setName("listar")
                .setDescription("Listar as FAQs cadastradas deste servidor.")
        )
        .addSubcommand(sub =>
            sub.setName("remover")
                .setDescription("Remover uma FAQ cadastrada.")
                .addIntegerOption(option => option.setName("id").setDescription("ID da FAQ para remover.").setRequired(true))
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
            return ui.caution(interaction, "Você precisa de **Gerenciar Servidor** para gerenciar a FAQ da IA.", "Sem permissão");
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "adicionar") {
            const question = interaction.options.getString("pergunta", true).trim();
            const answer = interaction.options.getString("resposta", true).trim();
            // Plano: limite de perguntas no FAQ (editar uma pergunta existente não conta).
            if (!(await AiRepository.faqExists(interaction.guild.id, question))) {
                const max = await PlanManager.limit(interaction.guild.id, "ai_faq_entries");
                const total = await AiRepository.countFaq(interaction.guild.id);
                if (total >= max) {
                    return ui.respond(interaction, PlanManager.limitEmbed("ai_faq_entries", total, max, interaction), { ephemeral: true });
                }
            }
            await AiRepository.upsertFaq(interaction.guild.id, question, answer, interaction.user.id);
            return ui.respond(interaction, ui.success(`FAQ salva para a pergunta: **${question}**`, "FAQ cadastrada", interaction));
        }

        if (subcommand === "remover") {
            const id = interaction.options.getInteger("id", true);
            await AiRepository.deleteFaq(interaction.guild.id, id);
            return ui.respond(interaction, ui.success(`FAQ #${id} removida.`, "FAQ removida", interaction));
        }

        const rows = await AiRepository.listFaq(interaction.guild.id);
        if (!rows.length) {
            return ui.respond(interaction, ui.info("Ainda não há FAQs cadastradas neste servidor.", "FAQ vazia", interaction));
        }

        const text = rows.map(row => `**#${row.id}** • ${row.question}\n${row.answer.slice(0, 160)}${row.answer.length > 160 ? "..." : ""}`).join("\n\n");
        return interaction.reply({ embeds: [ui.titled(ui.COLORS.brand, "book", "FAQ da IA", text, interaction)] });
    }
};
