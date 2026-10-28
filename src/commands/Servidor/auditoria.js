const { E: NinaE } = require("../../config/emojiRegistry");
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { audit, SEVERITY } = require("../../managers/SecurityAuditManager");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("auditoria")
        .setDescription("Analisa as permissões do servidor e aponta riscos de segurança.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    cooldown: 30,

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor**.", "Sem permissão");
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const result = await audit(interaction.guild);
            const color = result.score >= 90 ? 0x57f287 : result.score >= 75 ? 0xa3e635 : result.score >= 55 ? 0xfaa61a : 0xed4245;
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle("🔎 Auditoria de segurança")
                .setDescription(`Pontuação: **${result.score}/100** — ${result.grade}\n${result.findings.length ? `${result.findings.length} ponto(s) encontrado(s).` : `Nenhum risco relevante encontrado. ${NinaE("ui_celebrating")}`}`)
                .setTimestamp();

            for (const f of result.findings.slice(0, 10)) {
                const sev = SEVERITY[f.severity];
                embed.addFields({ name: `${sev.icon} ${sev.label} · ${f.title}`.slice(0, 256), value: f.detail.slice(0, 1024) });
            }
            if (result.findings.length > 10) embed.addFields({ name: "…", value: `E mais ${result.findings.length - 10} ponto(s) de menor prioridade.` });
            const notes = ["Somente leitura: a Nina não altera nenhuma permissão."];
            if (result.partial) notes.push("Nem todos os membros estavam em cache; contagens por cargo podem estar incompletas.");
            embed.setFooter({ text: notes.join(" ") });
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("[Auditoria] Falha:", error);
            return ui.respond(interaction, ui.error("Não consegui concluir a auditoria agora.", "Falha na auditoria", interaction));
        }
    }
};
