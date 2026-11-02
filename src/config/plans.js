/*
=========================
    PLANOS DA NINA
=========================
ÚNICO arquivo que define o que cada plano oferece. Para mudar um limite,
edite só aqui — bot, painel, dashboard e site leem estes valores.

Valores propostos (revisar/aprovar). Free mantém os limites de IA que já existiam;
Basic e Pro escalam com o custo real de cada recurso (IA e transcrição usam Groq).

Convenções:
  - número  → limite (UNLIMITED = sem limite)
  - boolean → recurso liberado ou não
*/

const UNLIMITED = Infinity;

const PLAN_ORDER = ["free", "basic", "pro"];

/*
 Catálogo: descreve cada chave (nome amigável, grupo e unidade). Serve para
 montar a tabela comparativa no site, no painel e em /plano automaticamente.
*/
const CATALOG = {
    // ---- IA ----
    ai_user_daily: { group: "IA", label: "Mensagens de IA por usuário/dia", unit: "msgs" },
    ai_guild_daily: { group: "IA", label: "Mensagens de IA por servidor/dia", unit: "msgs" },
    ai_ticket_replies: { group: "IA", label: "Respostas da IA por ticket", unit: "respostas" },
    ai_faq_entries: { group: "IA", label: "Perguntas no FAQ da IA", unit: "perguntas" },
    ai_embed_daily: { group: "IA", label: "Embeds por IA (/embedia) por dia", unit: "usos" },

    // ---- Voz ----
    recording_enabled: { group: "Voz", label: "Gravação de voz", type: "boolean" },
    recording_max_minutes: { group: "Voz", label: "Duração máxima por gravação", unit: "min" },
    recording_saved: { group: "Voz", label: "Gravações salvas", unit: "gravações" },
    transcription_enabled: { group: "Voz", label: "Transcrição de gravações", type: "boolean" },
    transcription_minutes_month: { group: "Voz", label: "Minutos de transcrição por mês", unit: "min" },

    // ---- Servidor ----
    backups_max: { group: "Servidor", label: "Backups do servidor", unit: "backups" },
    backup_restore: { group: "Servidor", label: "Restaurar backups", type: "boolean" },
    server_builder_month: { group: "Servidor", label: "/criar-servidor (IA) por mês", unit: "usos" },
    weekly_report: { group: "Servidor", label: "Relatório semanal automático", type: "boolean" },

    // ---- Segurança ----
    anti_scam_images: { group: "Segurança", label: "Anti-scam por imagem (IA)", type: "boolean" },
    topicguard_rules: { group: "Segurança", label: "Regras do TopicGuard", unit: "regras" },

    // ---- Comunidade ----
    giveaways_active: { group: "Comunidade", label: "Sorteios ativos ao mesmo tempo", unit: "sorteios" },
    giveaway_multiplier_max: { group: "Comunidade", label: "Multiplicador máximo de sorteio", unit: "×" },
    selfroles_max: { group: "Comunidade", label: "Cargos no painel de self-role", unit: "cargos" },


    // ---- Analytics ----
    analytics_days: { group: "Analytics", label: "Histórico do analytics", unit: "dias" },
    analytics_csv: { group: "Analytics", label: "Exportar analytics em CSV", type: "boolean" }
};

const PLANS = {
    free: {
        id: "free",
        name: "Free",
        emoji: "🆓",
        color: 0x99aab5,
        price: 0,
        tagline: "Tudo que um servidor precisa para começar.",
        limits: {
            ai_user_daily: 15,
            ai_guild_daily: 200,
            ai_ticket_replies: 8,
            ai_faq_entries: 20,
            ai_embed_daily: 5,
            recording_enabled: true,
            recording_max_minutes: 30,
            recording_saved: 3,
            transcription_enabled: true,
            transcription_minutes_month: 30,
            backups_max: 3,
            backup_restore: true,
            server_builder_month: 0,
            weekly_report: false,
            anti_scam_images: false,
            topicguard_rules: 15,
            giveaways_active: 3,
            giveaway_multiplier_max: 3,
            selfroles_max: 15,
            analytics_days: 14,
            analytics_csv: false
        }
    },

    basic: {
        id: "basic",
        name: "Basic",
        emoji: "⭐",
        color: 0x5865f2,
        price: 5, // R$ por mês
        tagline: "Mais IA, gravações e ferramentas para servidores ativos.",
        limits: {
            ai_user_daily: 40,
            ai_guild_daily: 800,
            ai_ticket_replies: 15,
            ai_faq_entries: 60,
            ai_embed_daily: 20,
            recording_enabled: true,
            recording_max_minutes: 120,
            recording_saved: 30,
            transcription_enabled: true,
            transcription_minutes_month: 300,
            backups_max: 10,
            backup_restore: true,
            server_builder_month: 2,
            weekly_report: true,
            anti_scam_images: true,
            topicguard_rules: 50,
            giveaways_active: 6,
            giveaway_multiplier_max: 10,
            selfroles_max: 25,
            analytics_days: 30,
            analytics_csv: true
        }
    },

    pro: {
        id: "pro",
        name: "Pro",
        emoji: "💎",
        color: 0xf569ff,
        price: 20, // R$ por mês
        tagline: "Sem amarras: limites altos e todos os recursos.",
        limits: {
            ai_user_daily: 120,
            ai_guild_daily: 3000,
            ai_ticket_replies: 30,
            ai_faq_entries: 200,
            ai_embed_daily: 100,
            recording_enabled: true,
            recording_max_minutes: 240,
            recording_saved: 200,
            transcription_enabled: true,
            transcription_minutes_month: 1800,
            backups_max: 25,
            backup_restore: true,
            server_builder_month: 8,
            weekly_report: true,
            anti_scam_images: true,
            topicguard_rules: 100,
            giveaways_active: 25,
            giveaway_multiplier_max: 10,
            selfroles_max: 25,
            analytics_days: 90,
            analytics_csv: true
        }
    }
};

/*
 Perfil usado enquanto o sistema de planos está DESLIGADO (padrão): reproduz o
 comportamento que a Nina tinha antes dos planos, sem bloquear nada. Não é um
 plano de verdade (fora de PLAN_ORDER): nunca aparece no site nem pode ser vendido.
*/
PLANS.legacy = {
    id: "legacy",
    name: "Sem planos",
    emoji: "✨",
    color: 0xf569ff,
    price: 0,
    tagline: "O sistema de planos ainda não foi ativado: todos os recursos estão liberados.",
    limits: {
        ai_user_daily: 15,
        ai_guild_daily: 200,
        ai_ticket_replies: 8,
        ai_faq_entries: 50,
        ai_embed_daily: UNLIMITED,
        recording_enabled: true,
        recording_max_minutes: 240,
        recording_saved: UNLIMITED,
        transcription_enabled: true,
        transcription_minutes_month: UNLIMITED,
        backups_max: 10,
        backup_restore: true,
        server_builder_month: UNLIMITED,
        weekly_report: true,
        anti_scam_images: true,
        topicguard_rules: 50,
        giveaways_active: UNLIMITED,
        giveaway_multiplier_max: 10,
        selfroles_max: 25,
        analytics_days: 90,
        analytics_csv: true
    }
};

// Valores devolvidos quando uma chave não existe no plano (nunca bloqueia por engano).
const FALLBACK_KEY = "free";

function rankOf(planId) {
    const i = PLAN_ORDER.indexOf(planId);
    return i === -1 ? 0 : i;
}

// Só planos reais (free/basic/pro) — o perfil "legacy" não pode ser concedido a ninguém.
function isValidPlan(planId) {
    return PLAN_ORDER.includes(planId);
}

/** Menor plano em que um recurso (boolean) ou um limite maior que zero é liberado. */
function minPlanFor(key) {
    for (const id of PLAN_ORDER) {
        const v = PLANS[id].limits[key];
        if (v === true || (typeof v === "number" && v > 0)) return id;
    }
    return PLAN_ORDER[PLAN_ORDER.length - 1];
}

/** Valor seguro para JSON (Infinity → null = ilimitado). */
function serializeValue(v) {
    return v === Infinity ? null : v;
}

/** Estrutura pronta para o site/painel/dashboard. */
function toPublic() {
    return {
        order: PLAN_ORDER,
        catalog: CATALOG,
        plans: PLAN_ORDER.map(id => {
            const p = PLANS[id];
            return {
                id: p.id,
                name: p.name,
                emoji: p.emoji,
                price: p.price,
                tagline: p.tagline,
                limits: Object.fromEntries(Object.entries(p.limits).map(([k, v]) => [k, serializeValue(v)]))
            };
        })
    };
}

module.exports = {
    UNLIMITED,
    PLAN_ORDER,
    CATALOG,
    PLANS,
    FALLBACK_KEY,
    rankOf,
    isValidPlan,
    minPlanFor,
    serializeValue,
    toPublic
};
