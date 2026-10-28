const { E } = require("../../config/emojiRegistry");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    AttachmentBuilder
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

function delta(pct) {
    if (pct === null || pct === undefined) return "";
    return ` (${pct > 0 ? "▲ +" : pct < 0 ? "▼ " : "• "}${pct}%)`;
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
                .setChoices(...PERIOD_CHOICES)))
        .addSubcommand(sub => sub
            .setName("voz")
            .setDescription("Canais de voz e membros com mais tempo em call.")
            .addIntegerOption(option => option
                .setName("periodo")
                .setDescription("Período de análise.")
                .setChoices(...PERIOD_CHOICES)))
        .addSubcommand(sub => sub
            .setName("horarios")
            .setDescription("Horários e dias da semana de maior atividade.")
            .addIntegerOption(option => option
                .setName("periodo")
                .setDescription("Período de análise.")
                .setChoices(...PERIOD_CHOICES)))
        .addSubcommand(sub => sub
            .setName("exportar")
            .setDescription("Exporta os dados diários em CSV.")
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
            if (subcommand === "exportar") {
                const csv = await AnalyticsRepository.exportCsv(interaction.guild.id, days);
                const file = new AttachmentBuilder(Buffer.from("\uFEFF" + csv, "utf8"), { name: `analytics-${days}d.csv` });
                return interaction.editReply({ content: `📄 Exportação dos últimos **${days} dias**.`, files: [file] });
            }
            const data = await AnalyticsRepository.getAnalytics(interaction.guild.id, days, interaction.guild);
            const s = data.summary;
            const embed = new EmbedBuilder()
                .setColor(0xf569ff)
                .setTitle(`${E("stats")} Nina Analytics · ${days} dias`)
                .setFooter({ text: `Período: ${data.period.start} até ${data.period.end} · Os dados começam após a instalação` })
                .setTimestamp();

            if (subcommand === "geral") {
                embed.setDescription("Resumo da atividade registrada pela Nina. Mensagens e métricas não são retroativas.")
                    .addFields(
                        { name: `${E("membros")} Membros atuais`, value: s.currentMembers.toLocaleString("pt-BR"), inline: true },
                        { name: `${E("chat")} Mensagens`, value: s.messages.toLocaleString("pt-BR") + delta(data.changes.messages), inline: true },
                        { name: "🟢 Membros ativos", value: s.activeMembers.toLocaleString("pt-BR") + delta(data.changes.activeMembers), inline: true },
                        { name: `${E("ui_chart")} Entradas`, value: s.joins.toLocaleString("pt-BR") + delta(data.changes.joins), inline: true },
                        { name: "📉 Saídas", value: s.leaves.toLocaleString("pt-BR") + delta(data.changes.leaves), inline: true },
                        { name: `${E("ui_plus")} Crescimento líquido`, value: `${s.netGrowth >= 0 ? "+" : ""}${s.netGrowth}`, inline: true },
                        { name: `${E("voz")} Tempo em voz`, value: formatDuration(s.voiceMinutes) + delta(data.changes.voiceMinutes), inline: true },
                        { name: `${E("shield")} Advertências`, value: s.warnings.toLocaleString("pt-BR"), inline: true },
                        { name: "⚡ Engajamento", value: `${s.engagementRate}% dos membros`, inline: true }
                    );
                const lastDays = data.series.slice(-7);
                embed.addFields({
                    name: "📅 Atividade diária (últimos dias do período)",
                    value: lastDays.map(day => `**${day.date.slice(5)}**  ${bar(day.messages, Math.max(...lastDays.map(x => x.messages), 1))}  ${day.messages}`).join("\n").slice(0, 1024)
                });
                if (data.insights.length) {
                    const icon = { good: "🟢", warn: "🟠", info: "🔹" };
                    embed.addFields({ name: "💡 Insights", value: data.insights.map(i => `${icon[i.type] || "🔹"} ${i.text}`).join("\n").slice(0, 1024) });
                }
            } else if (subcommand === "voz") {
                const ch = data.topVoiceChannels.map((r, i) => `**${i + 1}.** <#${r.channelId}> — **${formatDuration(Math.floor(r.voiceSeconds / 60))}**`).join("\n");
                const mb = data.topVoiceMembers.map((r, i) => `**${i + 1}.** <@${r.userId}> — **${formatDuration(Math.floor(r.voiceSeconds / 60))}**`).join("\n");
                embed.setDescription(ch || mb ? null : "Ainda não há atividade de voz registrada neste período.");
                if (ch) embed.addFields({ name: `${E("voz")} Canais de voz`, value: ch.slice(0, 1024) });
                if (mb) embed.addFields({ name: "🏅 Membros em call", value: mb.slice(0, 1024) });
            } else if (subcommand === "horarios") {
                const top = [...data.hours].filter(h => h.messages > 0).sort((a, b) => b.messages - a.messages).slice(0, 5);
                const maxH = Math.max(...top.map(h => h.messages), 1);
                const maxW = Math.max(...data.weekdays.map(w => w.avgMessages), 1);
                embed.setDescription(top.length ? "Horários no fuso de Brasília." : "Ainda não há mensagens registradas neste período.");
                if (top.length) {
                    embed.addFields(
                        { name: `${E("clock")} Horários de pico`, value: top.map(h => `**${String(h.hour).padStart(2, "0")}h**  ${bar(h.messages, maxH)}  ${h.messages}`).join("\n") },
                        { name: "📆 Média por dia da semana", value: data.weekdays.map(w => `**${w.name.slice(0, 3)}**  ${bar(w.avgMessages, maxW)}  ${w.avgMessages}`).join("\n") }
                    );
                }
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
