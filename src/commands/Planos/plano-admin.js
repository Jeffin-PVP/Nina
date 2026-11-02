const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const ui = require("../../utils/ui");
const PlanManager = require("../../managers/PlanManager");
const PlanRepository = require("../../database/repositories/PlanRepository");
const { PlanError } = PlanManager;
const { PLANS, isValidPlan } = require("../../config/plans");

/*
 Gestão de planos pelo dono da Nina (OWNER_ID). O painel admin faz o mesmo pela web.
 Respostas sempre efêmeras (códigos e IDs não vazam para o canal).
*/

const PLAN_CHOICES = [
    { name: "Free", value: "free" },
    { name: "Basic", value: "basic" },
    { name: "Pro", value: "pro" }
];

const PAID_CHOICES = PLAN_CHOICES.filter(c => c.value !== "free");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("plano-admin")
        .setDescription("Gerenciamento de planos (somente dono da Nina).")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName("dar")
            .setDescription("Libera um plano para um servidor.")
            .addStringOption(o => o.setName("servidor").setDescription("ID do servidor.").setRequired(true))
            .addStringOption(o => o.setName("plano").setDescription("Plano a liberar.").setRequired(true).addChoices(...PLAN_CHOICES))
            .addIntegerOption(o => o.setName("dias").setDescription("Duração em dias (vazio = sem vencimento).").setMinValue(1).setMaxValue(3650)))
        .addSubcommand(sub => sub
            .setName("remover")
            .setDescription("Remove o plano de um servidor (volta ao Free).")
            .addStringOption(o => o.setName("servidor").setDescription("ID do servidor.").setRequired(true)))
        .addSubcommand(sub => sub
            .setName("info")
            .setDescription("Mostra o plano e o histórico de um servidor.")
            .addStringOption(o => o.setName("servidor").setDescription("ID do servidor.").setRequired(true)))
        .addSubcommand(sub => sub
            .setName("gerar-codigo")
            .setDescription("Gera códigos de ativação.")
            .addStringOption(o => o.setName("plano").setDescription("Plano do código.").setRequired(true).addChoices(...PAID_CHOICES))
            .addIntegerOption(o => o.setName("dias").setDescription("Dias de plano que o código dá (vazio = sem vencimento).").setMinValue(1).setMaxValue(3650))
            .addIntegerOption(o => o.setName("usos").setDescription("Quantos servidores podem usar cada código (padrão 1).").setMinValue(1).setMaxValue(10000))
            .addIntegerOption(o => o.setName("quantidade").setDescription("Quantos códigos gerar (padrão 1, máx. 20).").setMinValue(1).setMaxValue(20))
            .addStringOption(o => o.setName("nota").setDescription("Anotação interna (ex.: nome do comprador).").setMaxLength(100)))
        .addSubcommand(sub => sub
            .setName("revogar-codigo")
            .setDescription("Invalida um código de ativação.")
            .addStringOption(o => o.setName("codigo").setDescription("Código a invalidar.").setRequired(true))),

    async execute(interaction) {
        const ownerId = process.env.OWNER_ID;
        if (!ownerId || interaction.user.id !== String(ownerId)) {
            return ui.fail(interaction, "Este comando é exclusivo do dono da Nina.", "Acesso negado");
        }

        const sub = interaction.options.getSubcommand();

        try {
            if (sub === "dar") return await this.dar(interaction);
            if (sub === "remover") return await this.remover(interaction);
            if (sub === "info") return await this.info(interaction);
            if (sub === "gerar-codigo") return await this.gerar(interaction);
            if (sub === "revogar-codigo") return await this.revogar(interaction);
        } catch (error) {
            if (error instanceof PlanError) return ui.fail(interaction, error.message);
            console.error("[Planos] Erro no /plano-admin:", error);
            return ui.fail(interaction, "Erro inesperado. Veja o console do bot.");
        }
    },

    guildId(interaction) {
        const id = interaction.options.getString("servidor", true).trim();
        if (!/^\d{17,20}$/.test(id)) throw new PlanError("ID de servidor inválido.");
        return id;
    },

    async dar(interaction) {
        const guildId = this.guildId(interaction);
        const plan = interaction.options.getString("plano", true);
        const days = interaction.options.getInteger("dias");
        const result = await PlanManager.grant({ guildId, plan, days, source: "manual", actor: interaction.user.id });
        const when = result.expiresAt ? `vence ${ui.ts(result.expiresAt, "D")}` : "sem vencimento";
        return ui.ok(interaction, `Servidor \`${guildId}\` agora está no plano ${PlanManager.planLabel(result.id)} (${when}).`, "Plano liberado");
    },

    async remover(interaction) {
        const guildId = this.guildId(interaction);
        const removed = await PlanManager.revoke({ guildId, actor: interaction.user.id, reason: "remoção manual" });
        return removed
            ? ui.ok(interaction, `Servidor \`${guildId}\` voltou ao plano Free.`, "Plano removido")
            : ui.nothing(interaction, "Esse servidor não tinha plano ativo.");
    },

    async info(interaction) {
        const guildId = this.guildId(interaction);
        const info = await PlanManager.describe(guildId);
        const events = await PlanRepository.listEvents(guildId, 8);
        const history = events.length
            ? events.map(ev => `${ui.ts(Number(ev.created_at), "d")} · **${ev.action}**${ev.plan ? ` (${ev.plan})` : ""}${ev.details ? ` — ${ui.clip(ev.details, 60)}` : ""}`).join("\n")
            : "Sem histórico.";
        const overrides = Object.entries(info.overrides);

        return ui.respond(interaction, ui.panel({
            color: PLANS[info.plan].color,
            emoji: "sparkle",
            title: `Servidor ${guildId}`,
            description: `Plano: ${PlanManager.planLabel(info.plan)}\nStatus: \`${info.status}\`\nVencimento: ${info.expiresAt ? ui.ts(info.expiresAt, "F") : "—"}`,
            fields: [
                ...(overrides.length ? [{ name: "Overrides", value: overrides.map(([k, v]) => `\`${k}\` = ${v}`).join("\n"), inline: false }] : []),
                { name: "Histórico", value: history, inline: false }
            ],
            source: interaction
        }), { ephemeral: true });
    },

    async gerar(interaction) {
        const plan = interaction.options.getString("plano", true);
        if (!isValidPlan(plan)) throw new PlanError("Plano inválido.");
        const codes = await PlanManager.createCode({
            plan,
            durationDays: interaction.options.getInteger("dias"),
            maxUses: interaction.options.getInteger("usos") ?? 1,
            quantity: interaction.options.getInteger("quantidade") ?? 1,
            note: interaction.options.getString("nota"),
            actor: interaction.user.id
        });
        return ui.ok(interaction, codes.map(c => `\`${c}\``).join("\n"), `${codes.length} código(s) do plano ${PLANS[plan].name}`);
    },

    async revogar(interaction) {
        const code = PlanManager.normalizeCode(interaction.options.getString("codigo", true));
        const ok = await PlanRepository.revokeCode(code);
        return ok
            ? ui.ok(interaction, `Código \`${code}\` invalidado.`)
            : ui.fail(interaction, "Código não encontrado.");
    }
};
