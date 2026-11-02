const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} = require("discord.js");

const ConfigPanelManager = require("../../managers/ConfigPanelManager");
const AiProviderManager = require("../../ai/AiProviderManager");
const TicketRepository = require("../../database/repositories/TicketRepository");
const ui = require("../../utils/ui");

/*
=========================
    /config → Inteligência Artificial
=========================
Ligar/desligar a IA do servidor, escolher entre a API padrão da Nina e a API
do próprio servidor (uma para tudo ou uma por funcionalidade) e as opções da
IA dos tickets. Mexer em chaves/modo exige dono ou Administrador.
*/

const PROVIDER_ALIASES = {
    google: "gemini",
    "google gemini": "gemini",
    outra: "custom",
    outro: "custom"
};

const normalizeProvider = raw => {
    const value = String(raw || "").trim().toLowerCase();
    return PROVIDER_ALIASES[value] || value;
};

const rebuild = interaction => ConfigPanelManager.build(interaction, "ai");

function needAdmin(interaction) {
    return ui.caution(
        interaction,
        "Só o **dono do servidor** ou quem tem **Administrador** pode mudar a API de IA (chaves de API são secretas e podem gerar custo).",
        "Sem permissão"
    );
}

const canManageKeys = interaction => AiProviderManager.canManageKeys(interaction.guild, interaction.member);

function input(id, label, { style = TextInputStyle.Short, required = true, placeholder, max = 100, value } = {}) {
    const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
    if (placeholder) field.setPlaceholder(placeholder);
    if (value) field.setValue(value);
    return new ActionRowBuilder().addComponents(field);
}

async function execute(interaction) {
    const id = interaction.customId;
    const guildId = interaction.guild.id;

    /* ---------- IA ligada/desligada no servidor ---------- */
    if (id === "config_ai:enabled") {
        const state = await AiProviderManager.getState(guildId);
        await AiProviderManager.setEnabled(guildId, !state.enabled);
        return interaction.update(await rebuild(interaction));
    }

    /* ---------- IA dos tickets ---------- */
    if (id.startsWith("config_ai:t_") && id !== "config_ai:t_instructions") {
        const field = { "config_ai:t_enabled": "ai_enabled", "config_ai:t_reply": "ai_auto_reply", "config_ai:t_summary": "ai_summary" }[id];
        if (!field) return;
        const config = await TicketRepository.getConfig(guildId);
        await TicketRepository.setConfig(guildId, { [field]: config[field] ? 0 : 1 });
        return interaction.update(await ConfigPanelManager.build(interaction, "tickets"));
    }

    if (id === "config_ai:t_instructions") {
        const config = await TicketRepository.getConfig(guildId);
        const modal = new ModalBuilder().setCustomId("config_submit:ai_ticket_instructions").setTitle("Instruções da IA nos tickets");
        modal.addComponents(input("instrucoes", "Como a IA deve atender?", {
            style: TextInputStyle.Paragraph,
            required: false,
            max: 1500,
            placeholder: "Ex.: Somos uma loja de bots. Suporte de segunda a sexta. Pagamentos só pelo site...",
            value: config.ai_instructions || undefined
        }));
        return interaction.showModal(modal);
    }

    /* ---------- escolha da API (só dono/admin) ---------- */
    if (id === "config_ai_mode" || id === "config_ai_scope") {
        if (!canManageKeys(interaction)) return needAdmin(interaction);
        const value = interaction.values[0];
        await AiProviderManager.setRouting(guildId, id === "config_ai_mode" ? { mode: value } : { scope: value });
        return interaction.update(await rebuild(interaction));
    }

    if (id === "config_ai_register") {
        if (!canManageKeys(interaction)) return needAdmin(interaction);
        const feature = interaction.values[0];
        if (feature !== AiProviderManager.SCOPE_ALL && !AiProviderManager.FEATURES[feature]) return;
        const label = feature === AiProviderManager.SCOPE_ALL ? "todas as funções" : AiProviderManager.FEATURES[feature].label;

        const modal = new ModalBuilder().setCustomId(`config_submit:ai_key:${feature}`).setTitle(`API para ${label}`.slice(0, 45));
        modal.addComponents(
            input("provedor", "Provedor", { placeholder: "groq, openai, gemini, openrouter ou custom", max: 20 }),
            input("chave", "Chave da API", { placeholder: "Cole aqui a chave (fica criptografada)", max: 400 }),
            input("modelo", "Modelo (opcional; obrigatório em custom)", { required: false, placeholder: "Ex.: gpt-4o-mini, gemini-2.0-flash", max: 100 }),
            input("url", "URL base (só para provedor custom)", { required: false, placeholder: "https://api.exemplo.com/v1", max: 200 })
        );
        return interaction.showModal(modal);
    }

    if (id === "config_ai_remove") {
        if (!canManageKeys(interaction)) return needAdmin(interaction);
        await AiProviderManager.removeKey(guildId, interaction.values[0]);
        return interaction.update(await rebuild(interaction));
    }

    if (id === "config_ai:test") {
        if (!canManageKeys(interaction)) return needAdmin(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const results = await AiProviderManager.testGuild(guildId);
        const lines = results.map(item => {
            const label = AiProviderManager.FEATURES[item.feature].label;
            return `${item.ok ? "✅" : "❌"} **${label}** — ${item.message}`;
        });
        return interaction.editReply({ content: lines.join("\n").slice(0, 1900) });
    }
}

async function modal(interaction) {
    const [, type, feature] = interaction.customId.split(":");
    const guildId = interaction.guild.id;

    if (type === "ai_ticket_instructions") {
        const text = interaction.fields.getTextInputValue("instrucoes").trim();
        await TicketRepository.setConfig(guildId, { ai_instructions: text || null });
        return ui.respond(interaction, ui.success("Instruções da IA dos tickets atualizadas.", "Tickets", interaction), { ephemeral: true });
    }

    if (type === "ai_key") {
        if (!canManageKeys(interaction)) return needAdmin(interaction);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            await AiProviderManager.saveKey(guildId, feature, {
                provider: normalizeProvider(interaction.fields.getTextInputValue("provedor")),
                apiKey: interaction.fields.getTextInputValue("chave"),
                model: interaction.fields.getTextInputValue("modelo"),
                baseUrl: interaction.fields.getTextInputValue("url")
            }, interaction.user.id);

            // Cadastrar uma API já coloca o servidor no modo "minha API" para a chave valer de verdade.
            const state = await AiProviderManager.getState(guildId);
            if (state.mode !== "custom") await AiProviderManager.setRouting(guildId, { mode: "custom" });
            if (feature === AiProviderManager.SCOPE_ALL && state.scope !== "all") await AiProviderManager.setRouting(guildId, { scope: "all" });
            if (feature !== AiProviderManager.SCOPE_ALL && state.scope !== "per_feature") await AiProviderManager.setRouting(guildId, { scope: "per_feature" });

            return ui.respond(interaction, ui.success("API testada e salva! Volte ao painel de IA e use **Atualizar** para ver o status.", "API cadastrada", interaction), { ephemeral: true });
        } catch (error) {
            const safe = error instanceof AiProviderManager.AiError ? error.message : "Não consegui salvar essa API. Confira os dados e tente de novo.";
            if (!(error instanceof AiProviderManager.AiError)) console.error("[IA] Falha ao salvar API:", error.message);
            return ui.respond(interaction, ui.error(safe, "API não cadastrada", interaction), { ephemeral: true });
        }
    }
}

module.exports = { execute, modal };
