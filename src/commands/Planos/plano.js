const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const ui = require("../../utils/ui");
const PlanManager = require("../../managers/PlanManager");
const { PlanError } = PlanManager;
const { PLANS, PLAN_ORDER, CATALOG } = require("../../config/plans");
const { fmtValue, comparisonByGroup, fmtPrice } = require("../../utils/planFormat");
const LINKS = require("../../config/links");

// Limites mostrados no /plano status (os mais relevantes no dia a dia)
const STATUS_KEYS = [
    "ai_user_daily", "ai_guild_daily", "recording_max_minutes", "backups_max",
    "server_builder_month", "anti_scam_images", "analytics_days"
];

const SOURCE_LABELS = { manual: "Liberado pela equipe", code: "Código de ativação", payment: "Pagamento", gift: "Cortesia" };

module.exports = {

    data: new SlashCommandBuilder()
        .setName("plano")
        .setDescription("Veja o plano do servidor, compare os planos ou ative um código.")
        .setDMPermission(false)
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("Mostra o plano atual deste servidor e seus limites."))
        .addSubcommand(sub => sub
            .setName("comparar")
            .setDescription("Compara os planos Free, Basic e Pro."))
        .addSubcommand(sub => sub
            .setName("ativar")
            .setDescription("Ativa um código de plano neste servidor.")
            .addStringOption(o => o
                .setName("codigo")
                .setDescription("Código recebido (ex.: NINA-XXXX-XXXX-XXXX).")
                .setRequired(true)
                .setMaxLength(40))),

    async execute(interaction) {
        // Sistema desligado: ninguém é limitado e não há o que ativar/comparar ainda.
        if (!(await PlanManager.isEnabled())) {
            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.brand,
                emoji: "sparkle",
                title: "Planos em breve",
                description: "O sistema de planos ainda não foi ativado. Por enquanto, **todos os recursos da Nina estão liberados** neste servidor.",
                source: interaction
            }), { ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        if (sub === "comparar") return this.comparar(interaction);
        if (sub === "ativar") return this.ativar(interaction);
        return this.status(interaction);
    },

    async status(interaction) {
        const plan = await PlanManager.getPlan(interaction.guildId);
        const limits = await PlanManager.effectiveLimits(interaction.guildId);

        const lines = STATUS_KEYS.map(key => `• ${CATALOG[key].label}: **${fmtValue(key, limits[key])}**`);

        const expiry = plan.expiresAt
            ? `${ui.ts(plan.expiresAt, "D")} (${ui.ts(plan.expiresAt)})`
            : (plan.active ? "Sem vencimento" : "—");

        const embed = ui.panel({
            color: plan.def.color,
            emoji: "sparkle",
            title: `Plano do servidor: ${plan.def.name}`,
            description: plan.def.tagline,
            fields: [
                ui.field("sparkle", "Plano", `${plan.def.emoji} **${plan.def.name}**`, true),
                ui.field("clock", "Vencimento", expiry, true),
                ...(plan.source ? [ui.field("sparkle", "Origem", SOURCE_LABELS[plan.source] || plan.source, true)] : []),
                { name: "Seus limites", value: lines.join("\n"), inline: false }
            ],
            footer: "Use /plano comparar para ver todos os planos",
            source: interaction
        });

        return ui.respond(interaction, embed, { ephemeral: true });
    },

    async comparar(interaction) {
        const groups = comparisonByGroup();
        const header = PLAN_ORDER.map(id => `${PLANS[id].emoji} **${PLANS[id].name}** — ${fmtPrice(PLANS[id].price)}`).join("\n");

        const embed = ui.panel({
            color: ui.COLORS.brand,
            emoji: "sparkle",
            title: "Planos da Nina",
            description: `${header}\n\nCada linha mostra os valores na ordem **Free · Basic · Pro**.`,
            fields: Object.entries(groups).map(([name, items]) => ({
                name,
                value: ui.clip(items.join("\n"), 1024),
                inline: false
            })),
            source: interaction
        });

        return ui.respond(interaction, embed, { ephemeral: true });
    },

    async ativar(interaction) {
        const member = interaction.member;
        const allowed = member?.permissions?.has(PermissionFlagsBits.Administrator) ||
            member?.permissions?.has(PermissionFlagsBits.ManageGuild);

        if (!allowed) {
            return ui.fail(interaction, "Você precisa de **Administrador** ou **Gerenciar Servidor** para ativar um plano.", "Sem permissão");
        }

        const code = interaction.options.getString("codigo", true);

        try {
            const plan = await PlanManager.redeem({ code, guildId: interaction.guildId, userId: interaction.user.id });
            const when = plan.expiresAt ? `Vence ${ui.ts(plan.expiresAt, "D")}.` : "Sem vencimento.";
            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "sparkle",
                title: "Plano ativado!",
                description: `O servidor agora está no plano ${PlanManager.planLabel(plan.id)}. ${when}`,
                source: interaction
            }));
        } catch (error) {
            if (error instanceof PlanError) return ui.fail(interaction, error.message, "Não foi possível ativar");
            console.error("[Planos] Erro ao ativar código:", error);
            return ui.fail(interaction, "Algo deu errado ao ativar o código. Tente novamente em instantes.");
        }
    }
};
