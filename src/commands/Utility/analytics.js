const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");
const AnalyticsRepository = require("../../database/repositories/AnalyticsRepository");

const PERIOD_CHOICES = [
    { name: "Últimos 7 dias", value: 7 },
    { name: "Últimos 14 dias", value: 14 },
    { name: "Últimos 30 dias", value: 30 },
    { name: "Últimos 90 dias", value: 90 }
];

function formatDuration(minutes) {
    const n = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(n / 60);
    const rest = n % 60;
    return hours ? `${hours}h ${rest}min` : `${rest}min`;
}

function bar(value, max) {
    const width = max > 0 ? Math.max(1, Math.round((value / max) * 8)) : 1;
    return "▰".repeat(width) + "▱".repeat(8 - width);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("analytics")
        .setDescription("Consulte as estatísticas e a atividade deste servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName("geral")
            .setDescription("Resumo do crescimento e da atividade do servidor.")
            .addIntegerOption(option => option
                .setName("periodo")
                .setDescription("Período de análise.")
                .setChoices(...PERIOD_CHOICES)))
        .addSubcommand(sub => sub
            .setName("canais")
            .setDescription("Mostra os canais com mais mensagens.")
            .addIntegerOption(option => option
                .setName("periodo")
                .setDescription("Período de análise.")
                .setChoices(...PERIOD_CHOICES)))
        .addSubcommand(sub => sub
            .setName("membros")
            .setDescription("Mostra os membros mais ativos.")
            .addIntegerOption(option => option
                .setName("periodo")
                .setDescription("Período de análise.")
                .setChoices(...PERIOD_CHOICES))),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "Este comando só pode ser usado em um servidor.", ephemeral: true });
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: "Você precisa da permissão **Gerenciar Servidor** para consultar o Analytics.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
            const subcommand = interaction.options.getSubcommand();
            const days = interaction.options.getInteger("periodo") || 7;
            const data = await AnalyticsRepository.getAnalytics(interaction.guild.id, days, interaction.guild);
            const s = data.summary;
            const embed = new EmbedBuilder()
                .setColor(0xf569ff)
                .setTitle(`📊 Nina Analytics · ${days} dias`)
                .setFooter({ text: `Período: ${data.period.start} até ${data.period.end} · Os dados começam após a instalação` })
                .setTimestamp();

            if (subcommand === "geral") {
                embed.setDescription("Resumo da atividade registrada pela Nina. Mensagens e métricas não são retroativas.")
                    .addFields(
                        { name: "👥 Membros atuais", value: s.currentMembers.toLocaleString("pt-BR"), inline: true },
                        { name: "💬 Mensagens", value: s.messages.toLocaleString("pt-BR"), inline: true },
                        { name: "🟢 Membros ativos", value: s.activeMembers.toLocaleString("pt-BR"), inline: true },
                        { name: "📈 Entradas", value: s.joins.toLocaleString("pt-BR"), inline: true },
                        { name: "📉 Saídas", value: s.leaves.toLocaleString("pt-BR"), inline: true },
                        { name: "➕ Crescimento líquido", value: `${s.netGrowth >= 0 ? "+" : ""}${s.netGrowth}`, inline: true },
                        { name: "🎙️ Tempo em voz", value: formatDuration(s.voiceMinutes), inline: true },
                        { name: "🛡️ Advertências", value: s.warnings.toLocaleString("pt-BR"), inline: true }
                    );
                const lastDays = data.series.slice(-7);
                embed.addFields({
                    name: "📅 Atividade diária (últimos dias do período)",
                    value: lastDays.map(day => `**${day.date.slice(5)}**  ${bar(day.messages, Math.max(...lastDays.map(x => x.messages), 1))}  ${day.messages}`).join("\n").slice(0, 1024)
                });
            } else if (subcommand === "canais") {
                const rows = data.topChannels;
                embed.setDescription(rows.length
                    ? rows.map((row, i) => `**${i + 1}.** <#${row.channelId}> — **${row.messages.toLocaleString("pt-BR")}** mensagens`).join("\n")
                    : "Ainda não há mensagens registradas neste período.");
            } else {
                const rows = data.topMembers;
                embed.setDescription(rows.length
                    ? rows.map((row, i) => `**${i + 1}.** <@${row.userId}> — **${row.messages.toLocaleString("pt-BR")}** mensagens`).join("\n")
                    : "Ainda não há membros ativos registrados neste período.");
            }
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("[Analytics] Falha no slash command:", error);
            return interaction.editReply({ content: "Não consegui carregar as estatísticas agora. Verifique o console da Nina." });
        }
    }
};
