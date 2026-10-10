/*
 * Espelha a configuração do AutoMod da Nina (tabela automod_settings) em
 * regras NATIVAS do Discord. Só regras criadas via API pelo app contam para
 * o selo "Uses AutoMod" (mínimo de 100 regras somando todos os servidores).
 *
 * - Roda sozinho: AutomodRepository.update() agenda uma sincronização
 *   (com debounce) sempre que a config de um servidor muda.
 * - Na inicialização (ready) sincroniza todos os servidores, um por vez.
 * - Desligue com NATIVE_AUTOMOD=off no .env.
 *
 * Requisitos: permissão "Gerenciar Servidor" para a Nina em cada servidor.
 */

const {
    PermissionFlagsBits,
    AutoModerationRuleEventType: Evento,
    AutoModerationRuleTriggerType: Gatilho,
    AutoModerationActionType: Acao,
    AutoModerationRuleKeywordPresetType: Preset
} = require("discord.js");

const AutomodRepository = require("../database/repositories/AutomodRepository");
const GuildRepository = require("../database/repositories/GuildRepository");
const { PALAVROES_PADRAO } = require("../utils/profanityFilter");

const PREFIXO = "Nina • ";

// nome da regra nativa -> campo de ações na config da Nina
const REGRAS = {
    palavroes: { nome: `${PREFIXO}Palavrões`, acoes: "swear_actions", motivo: "Linguagem imprópria" },
    convites: { nome: `${PREFIXO}Convites`, acoes: "invite_actions", motivo: "Link de convite não permitido" },
    mencoes: { nome: `${PREFIXO}Menções`, acoes: "mention_actions", motivo: "Spam de menções" },
    spam: { nome: `${PREFIXO}Spam`, acoes: "spam_actions", motivo: "Spam de mensagens" },
    listas: { nome: `${PREFIXO}Listas do Discord`, acoes: "swear_actions", motivo: "Linguagem imprópria" }
};

const DEBOUNCE_MS = 3000;
const INTERVALO_ENTRE_SERVIDORES_MS = 2500;

let client = null;
const timers = new Map();   // guildId -> timeout (debounce)
const emAndamento = new Set(); // guildId

function ativo() {
    return String(process.env.NATIVE_AUTOMOD || "on").toLowerCase() !== "off";
}

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

function lista(csv) {
    return AutomodRepository.parseLista(csv);
}

function palavrasValidas(palavras) {
    // Discord: até 1000 palavras, cada uma com até 60 caracteres
    const unicas = new Set(palavras.map(p => String(p).trim().toLowerCase()).filter(p => p && p.length <= 60));
    return [...unicas].slice(0, 1000);
}

function acoesDe(csvAcoes, config, alertChannelId, permiteTimeout) {

    const csv = lista(csvAcoes);
    const acoes = [];

    if (csv.includes("delete")) {
        acoes.push({
            type: Acao.BlockMessage,
            metadata: { customMessage: "Mensagem bloqueada pelo AutoMod da Nina." }
        });
    }

    if (alertChannelId && (csv.includes("notify") || csv.includes("warn"))) {
        acoes.push({ type: Acao.SendAlertMessage, metadata: { channel: alertChannelId } });
    }

    // Timeout só é aceito em regras de Keyword e MentionSpam
    if (permiteTimeout && csv.includes("mute")) {
        acoes.push({
            type: Acao.Timeout,
            metadata: { durationSeconds: Math.min((config.mute_duration_minutes || 10) * 60, 2419200) }
        });
    }

    // Toda regra nativa precisa de pelo menos uma ação
    if (!acoes.length) acoes.push({ type: Acao.BlockMessage });

    return acoes;
}

// Monta as definições (uma por regra) a partir da config da Nina
function montarRegras(config, alertChannelId) {

    const ligado = !!config.enabled;

    const base = {
        eventType: Evento.MessageSend,
        exemptRoles: lista(config.ignored_roles).slice(0, 20),
        exemptChannels: lista(config.ignored_channels).slice(0, 50)
    };

    return [

        {
            ...base,
            name: REGRAS.palavroes.nome,
            enabled: ligado && !!config.swear_enabled,
            triggerType: Gatilho.Keyword,
            triggerMetadata: { keywordFilter: palavrasValidas([...PALAVROES_PADRAO, ...lista(config.swear_custom_words)]) },
            actions: acoesDe(config.swear_actions, config, alertChannelId, true)
        },

        {
            ...base,
            name: REGRAS.convites.nome,
            enabled: ligado && !!config.invite_enabled,
            triggerType: Gatilho.Keyword,
            triggerMetadata: { regexPatterns: ["(discord\\.gg|discord(app)?\\.com/invite)/[a-z0-9-]+"] },
            actions: acoesDe(config.invite_actions, config, alertChannelId, true)
        },

        {
            ...base,
            name: REGRAS.mencoes.nome,
            enabled: ligado && !!config.mention_enabled,
            triggerType: Gatilho.MentionSpam,
            triggerMetadata: { mentionTotalLimit: Math.max(1, Math.min(config.mention_max_count || 5, 50)) },
            actions: acoesDe(config.mention_actions, config, alertChannelId, true)
        },

        {
            ...base,
            name: REGRAS.spam.nome,
            enabled: ligado && !!config.spam_enabled,
            triggerType: Gatilho.Spam,
            actions: acoesDe(config.spam_actions, config, alertChannelId, false)
        },

        {
            ...base,
            name: REGRAS.listas.nome,
            enabled: ligado && !!config.swear_enabled,
            triggerType: Gatilho.KeywordPreset,
            triggerMetadata: { presets: [Preset.Profanity, Preset.SexualContent, Preset.Slurs] },
            actions: acoesDe(config.swear_actions, config, alertChannelId, false)
        }

    ];

}

/**
 * Cria/atualiza as regras nativas da Nina em um servidor. Idempotente.
 * Retorna quantas regras foram criadas (ou null se foi ignorado).
 */
async function syncGuild(guild, { alertChannelId } = {}) {

    if (!ativo()) return null;

    if (emAndamento.has(guild.id)) return null;

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);

    if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) return null;

    emAndamento.add(guild.id);

    try {

        const config = await AutomodRepository.get(guild.id);

        const canalAlerta = alertChannelId !== undefined
            ? alertChannelId
            : await GuildRepository.getLogChannel(guild.id).catch(() => null);

        const alvo = montarRegras(config, canalAlerta);

        const existentes = await guild.autoModerationRules.fetch();
        const minhas = existentes.filter(r => r.creatorId === guild.client.user.id && r.name.startsWith(PREFIXO));

        let criadas = 0;

        for (const def of alvo) {

            const atual = minhas.find(r => r.name === def.name);

            try {

                if (atual) {
                    // o tipo de gatilho não pode ser alterado depois de criada
                    const { triggerType, ...edicao } = def;
                    await atual.edit(edicao);
                } else {
                    await guild.autoModerationRules.create(def);
                    criadas++;
                }

            } catch (error) {
                console.error(`[NativeAutomod] ${guild.id} / ${def.name}: ${error.message}`);
            }

        }

        return criadas;

    } catch (error) {

        console.error(`[NativeAutomod] Falha ao sincronizar ${guild.id}: ${error.message}`);
        return null;

    } finally {

        emAndamento.delete(guild.id);

    }

}

// Agenda uma sincronização (agrupa várias mudanças seguidas numa só)
function schedule(guildId) {

    if (!client || !ativo()) return;

    clearTimeout(timers.get(guildId));

    const timer = setTimeout(() => {

        timers.delete(guildId);

        const guild = client.guilds.cache.get(guildId);

        if (guild) syncGuild(guild).catch(() => {});

    }, DEBOUNCE_MS);

    timer.unref?.();

    timers.set(guildId, timer);

}

// Sincroniza todos os servidores, um de cada vez (respeita rate limit)
async function syncAll() {

    if (!client || !ativo()) return;

    let total = 0;

    for (const guild of client.guilds.cache.values()) {

        const criadas = await syncGuild(guild);

        if (criadas) total += criadas;

        await esperar(INTERVALO_ENTRE_SERVIDORES_MS);

    }

    console.log(`🛡️ AutoMod nativo sincronizado (${total} regra(s) nova(s) criada(s)).`);

}

function init(discordClient, { syncOnStart = true } = {}) {

    client = discordClient;

    if (syncOnStart && ativo()) syncAll().catch(error => console.error("[NativeAutomod]", error));

}

module.exports = { init, schedule, syncGuild, syncAll, montarRegras, REGRAS, PREFIXO };
