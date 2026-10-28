const { E } = require("../config/emojiRegistry");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require("discord.js");

const ui = require("../utils/ui");
const { e } = require("../utils/emojis");
const GuildRepository = require("../database/repositories/GuildRepository");
const AutomodRepository = require("../database/repositories/AutomodRepository");
const WelcomeRepository = require("../database/repositories/WelcomeRepository");
const TicketRepository = require("../database/repositories/TicketRepository");
const TicketManager = require("./TicketManager");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const ServerStatsRepository = require("../database/repositories/ServerStatsRepository");
const AntiNukeRepository = require("../database/repositories/AntiNukeRepository");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");
const VoiceRecordingRepository = require("../database/repositories/VoiceRecordingRepository");
const RecordingApi = require("../services/RecordingService");
const SecurityRepository = require("../database/repositories/SecurityRepository");
const SecurityManager = require("./SecurityManager");
const LockdownManager = require("./LockdownManager");
const ServerToolsRepository = require("../database/repositories/ServerToolsRepository");
const VerificationManager = require("./VerificationManager");
const AccountFilterManager = require("./AccountFilterManager");
const WeeklyReportManager = require("./WeeklyReportManager");
const { CATEGORIES } = require("./LogCategories");

/*
=========================
    /config — Components V2
=========================
Todas as telas são um único Container (Components V2). Os customIds dos
botões/menus são os mesmos da versão antiga com embeds, então o handler
(src/interactions/config/panelHandler.js) continua funcionando igual.

Limites do Discord por mensagem V2: 40 componentes (contando os aninhados)
e 4000 caracteres somando todos os textos. Cada tela abaixo fica bem
abaixo disso (a maior usa ~30 componentes).
*/

const CATEGORY_OPTIONS = [
    { value: "general", label: "Geral", description: "Economia, moderação e níveis", emoji: E("config") },
    { value: "automod", label: "AutoMod", description: "Proteção automática do servidor", emoji: E("ui_bot") },
    { value: "security", label: "Security Center", description: "Assuntos proibidos e Honeypot", emoji: E("escudo") },
    { value: "welcome", label: "Boas-vindas", description: "Mensagem e canal de entrada", emoji: E("aceno") },
    { value: "tickets", label: "Tickets", description: "Suporte e atendimento", emoji: E("ticket") },
    { value: "logs", label: "Logs", description: "Registros e auditoria", emoji: E("logs") },
    { value: "autorole", label: "Autoroles", description: "Cargos automáticos e níveis", emoji: E("cargo") },
    { value: "stats", label: "Stats", description: "Contadores do servidor", emoji: E("stats") },
    { value: "antinuke", label: "Anti-Nuke", description: "Proteção contra ataques destrutivos", emoji: E("nuclear") },
    { value: "tempvoice", label: "TempVoice", description: "Salas de voz temporárias", emoji: E("voz") },
    { value: "voicerec", label: "Gravação de calls", description: "Gravar e transcrever calls com IA", emoji: E("ui_mic") },
    { value: "lockdown", label: "Lockdown", description: "Bloqueio rápido de canais e categorias", emoji: E("lock") },
    { value: "verification", label: "Verificação", description: "Libera o servidor só após o membro confirmar", emoji: E("ui_check") },
    { value: "accountfilter", label: "Contas novas", description: "Filtro de contas recém-criadas", emoji: E("ui_block") },
    { value: "weeklyreport", label: "Relatório semanal", description: "Resumo automático de atividade e moderação", emoji: E("calendar") },
    { value: "backup", label: "Backup", description: "Salvar e restaurar cargos e canais", emoji: E("pasta") }
];

const NOT_SET = "*Não configurado*";

function permissionOk(interaction) {
    return interaction.memberPermissions?.has("ManageGuild");
}

/*
=========================
    BLOCOS REUTILIZÁVEIS
=========================
*/

/** Nome de emoji da Nina ("config") ou emoji literal ("🔊"). */
const ico = name => /^[a-z]+$/i.test(name) ? e(name) : name;

const card = color => new ContainerBuilder().setAccentColor(color);

const text = content => new TextDisplayBuilder().setContent(ui.clip(content || "—", 3500));

const addText = (container, content) => container.addTextDisplayComponents(text(content));

const addSep = container => container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
);

const addRow = (container, ...components) => container.addActionRowComponents(
    new ActionRowBuilder().addComponents(...components)
);

/** Cabeçalho padrão: "## ⚙️ Título" + linha pequena de subtítulo. */
function addHeader(container, emoji, title, subtitle) {
    addText(container, `## ${ico(emoji)}  ${title}${subtitle ? `\n${subtitle}` : ""}`);
    addSep(container);
}

function toggleButton(id, enabled, label = "") {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label ? `${label}: ${enabled ? "ON" : "OFF"}` : (enabled ? "ON" : "OFF"))
        .setEmoji(enabled ? E("botao_on") : E("botao_off"))
        .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger);
}

/** Linha de configuração: texto à esquerda, botão ON/OFF à direita. */
function addToggle(container, { id, title, description, enabled }) {
    container.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                text(`**${title}**\n-# ${description}`)
            )
            .setButtonAccessory(toggleButton(id, enabled))
    );
}

function navButtons(extra = []) {
    return [
        ...extra,
        new ButtonBuilder().setCustomId("config_home").setLabel("Voltar").setEmoji(E("ui_arrowl")).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji(`${E("ui_cancel")}️`).setStyle(ButtonStyle.Danger)
    ];
}

/** Separador + rodapé com Voltar/Fechar (e botões extras opcionais). */
function addNav(container, extra = []) {
    addSep(container);
    addRow(container, ...navButtons(extra));
}

function actionButton(id, label, emoji, style = ButtonStyle.Secondary) {
    return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
}

const channelSelect = (id, placeholder, ...types) =>
    new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setChannelTypes(...types);

const roleSelect = (id, placeholder) =>
    new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder);

const finish = container => ({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    // Nomes e textos vêm do servidor/usuários: nunca marca ninguém.
    allowedMentions: { parse: [] }
});

const stateColor = enabled => enabled ? ui.COLORS.success : ui.COLORS.neutral;
const dots = rows => rows.map(([name, on]) => `${ui.dot(on)} ${name}`).join("\n");
const mention = id => id ? `<#${id}>` : NOT_SET;
const roleMention = id => id ? `<@&${id}>` : NOT_SET;

/*
=========================
    TELAS
=========================
*/

async function buildHome(interaction) {
    const guildId = interaction.guild.id;
    const [settings, automod, welcome, tickets, stats, antinuke, lockdown, tempvoice, security, voicerec, verification, accountFilter, weeklyReport, backups] = await Promise.all([
        GuildRepository.getSettings(guildId),
        AutomodRepository.get(guildId),
        WelcomeRepository.get(guildId),
        TicketRepository.getConfig(guildId),
        ServerStatsRepository.get(guildId),
        AntiNukeRepository.get(guildId),
        LockdownManager.getConfig(guildId),
        TempVoiceRepository.get(guildId),
        SecurityRepository.get(guildId),
        VoiceRecordingRepository.get(guildId),
        ServerToolsRepository.getConfig(VerificationManager.TABLE, guildId),
        ServerToolsRepository.getConfig(AccountFilterManager.TABLE, guildId),
        ServerToolsRepository.getConfig(WeeklyReportManager.TABLE, guildId),
        ServerToolsRepository.listBackups(guildId)
    ]);

    const groups = [
        [`${E("shield")} Proteção`, [
            ["AutoMod", automod.enabled],
            ["Anti-Nuke", antinuke.enabled],
            ["Lockdown", lockdown.enabled],
            ["Verificação", verification.enabled],
            ["Contas novas", accountFilter.enabled],
            ["Moderação", settings.moderation_enabled],
            ["TopicGuard", security.topic_enabled],
            ["Honeypot", security.honeypot_enabled || security.behavior_enabled]
        ]],
        [`${E("ui_users")} Comunidade`, [
            ["Boas-vindas", welcome.enabled],
            ["Tickets", TicketRepository.isConfigured(tickets)],
            ["Logs", !!settings.log_channel],
            ["Economia", settings.economy_enabled]
        ]],
        [`${E("ui_wrench")} Utilidades`, [
            ["Stats", stats.enabled],
            ["TempVoice", tempvoice.enabled],
            ["Gravação de calls", voicerec.enabled],
            ["Relatório semanal", weeklyReport.enabled],
            ["Backup", backups.length > 0]
        ]]
    ];

    const all = groups.flatMap(([, items]) => items);
    const active = all.filter(([, on]) => on).length;

    const container = card(ui.COLORS.brand);

    const title = `## ${E("ui_settings")}  Painel da Nina\nConfigure **${interaction.guild.name}** sem decorar comandos.\n-# ${active} de ${all.length} sistemas ativos`;
    const icon = interaction.guild.iconURL({ size: 256 });

    if (icon) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(text(title))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(icon))
        );
    } else {
        addText(container, title);
    }

    addSep(container);

    addText(container, groups.map(([name, items]) =>
        `**${name}**\n${items.map(([label, on]) => `${ui.dot(on)} ${label}`).join("  ·  ")}`
    ).join("\n\n"));

    addSep(container);

    addText(container, "**Escolha uma área para configurar**");
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("config_category")
                .setPlaceholder("Selecione uma área…")
                .addOptions(CATEGORY_OPTIONS.map(o => ({
                    label: o.label,
                    value: o.value,
                    description: o.description,
                    emoji: o.emoji
                })))
        )
    );

    addSep(container);
    addRow(
        container,
        new ButtonBuilder().setCustomId("config_refresh").setLabel("Atualizar").setEmoji(E("ui_torefresh")).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji(`${E("ui_cancel")}️`).setStyle(ButtonStyle.Danger)
    );

    addText(container, "-# Requer a permissão Gerenciar Servidor · Os comandos antigos continuam disponíveis.");

    return finish(container);
}

async function buildGeneral(interaction) {
    const s = await GuildRepository.getSettings(interaction.guild.id);
    const container = card(ui.COLORS.info);

    addHeader(container, E("ui_settings"), "Configuração geral", "Ative ou desative os principais sistemas do servidor.");

    addToggle(container, { id: "config_toggle:economy", title: `${E("moneybag")} Economia`, description: "Moedas, trabalho, loja e jogos de aposta.", enabled: !!s.economy_enabled });
    addToggle(container, { id: "config_toggle:moderation", title: `${E("shield")} Moderação`, description: "Comandos de ban, kick, timeout e avisos.", enabled: !!s.moderation_enabled });
    addToggle(container, { id: "config_toggle:levelup", title: `${E("ui_up")} Avisos de level-up`, description: "Mensagem quando um membro sobe de nível.", enabled: !!s.levelup_enabled });

    addSep(container);
    addText(container, `**${E("ui_logs")} Canal de logs**\n${mention(s.log_channel)}`);

    addNav(container);
    return finish(container);
}

async function buildAutomod(interaction) {
    const c = await AutomodRepository.get(interaction.guild.id);
    const container = card(c.enabled ? ui.COLORS.success : ui.COLORS.neutral);

    addHeader(container, E("shield"), "AutoMod", "Proteção automática contra spam, convites, menções, raid e outros abusos.");

    addToggle(container, { id: "config_toggle:automod", title: "Sistema AutoMod", description: `Punição padrão: mute de ${c.mute_duration_minutes} minuto(s).`, enabled: !!c.enabled });

    addSep(container);
    addText(container, `**Regras**\n${dots([
        [`${E("chat")} Spam`, c.spam_enabled],
        [`${E("mascaras")} Emojis em excesso`, c.emoji_enabled],
        [`${E("ui_textc")} Palavrões`, c.swear_enabled],
        [`${E("role")} Menções em massa`, c.mention_enabled],
        [`${E("ui_url")} Convites`, c.invite_enabled],
        [`${E("ui_invite")} Anti-Raid`, c.raid_enabled],
        [`${E("ui_thumbnail")} Anti-Scam (imagens)`, c.image_enabled]
    ])}`);

    addRow(
        container,
        toggleButton("config_toggle:spam", !!c.spam_enabled, "Spam"),
        toggleButton("config_toggle:emoji", !!c.emoji_enabled, "Emojis"),
        toggleButton("config_toggle:swear", !!c.swear_enabled, "Palavrões"),
        toggleButton("config_toggle:mention", !!c.mention_enabled, "Menções")
    );
    addRow(
        container,
        toggleButton("config_toggle:invite", !!c.invite_enabled, "Convites"),
        toggleButton("config_toggle:raid", !!c.raid_enabled, "Anti-Raid"),
        toggleButton("config_toggle:image", !!c.image_enabled, "Anti-Scam")
    );

    addSep(container);
    addText(container, "**Limites e ajustes**");
    addRow(
        container,
        actionButton("config_modal:automod_spam", "Spam", E("ui_content")),
        actionButton("config_modal:automod_raid", "Raid", E("ui_invite")),
        actionButton("config_modal:automod_image", "Anti-Scam", E("ui_thumbnail"))
    );

    addNav(container);
    return finish(container);
}

async function buildSecurity(interaction) {
    const guildId = interaction.guild.id;
    const [c, rules] = await Promise.all([
        SecurityRepository.get(guildId),
        SecurityRepository.listRules(guildId)
    ]);
    const container = card(c.topic_enabled || c.honeypot_enabled || c.behavior_enabled ? ui.COLORS.success : ui.COLORS.neutral);
    addHeader(container, E("shield"), "Security Center", "TopicGuard, Honeypot e sinais comportamentais.");

    addToggle(container, { id: "config_toggle:topicguard", title: "TopicGuard", description: `${rules.length} regra(s) cadastrada(s). Detecta assuntos proibidos por canal.`, enabled: !!c.topic_enabled });
    addToggle(container, { id: "config_toggle:security_context", title: "Análise contextual por IA", description: "Opcional; só analisa mensagens que correspondem a palavras de regras. Se falhar, não apaga a mensagem.", enabled: !!c.contextual_enabled });
    addToggle(container, { id: "config_toggle:security_warn", title: "Advertência por violação", description: "Registra uma advertência no sistema de avisos da Nina após uma remoção confirmada.", enabled: !!c.topic_warn_enabled });
    addToggle(container, { id: "config_toggle:security_timeout", title: "Timeout por violação", description: `Opcional e mais severo; duração atual: ${c.topic_timeout_minutes} minuto(s).`, enabled: !!c.topic_timeout_enabled });
    addRow(container, actionButton("config_modal:security_timeout", "Duração do timeout", E("ui_timedout")));
    addToggle(container, { id: "config_toggle:security_behavior", title: "Sinais comportamentais", description: "Detecta padrões repetitivos e envia alertas para revisão humana; não pune automaticamente.", enabled: !!c.behavior_enabled });

    addSep(container);
    addText(container, `**Regras TopicGuard**\n${rules.length} regra(s) cadastrada(s). Gerencie as palavras e os canais em uma tela separada para manter este painel dentro do limite de componentes do Discord.`);
    addText(container, `**Honeypot** ${ui.dot(!!c.honeypot_enabled)}\n${c.honeypot_enabled && c.honeypot_channel_id ? `Canal-isca: <#${c.honeypot_channel_id}> • Ação: **${SecurityManager.HONEYPOT_ACTION_LABELS[c.honeypot_action] || "Banimento"}**` : "Canal-isca que pune automaticamente quem enviar mensagem nele."}`);
    addRow(container,
        actionButton("config_security:rules", "Gerenciar regras", E("ui_content"), ButtonStyle.Primary),
        actionButton("config_security:honeypot", "Configurar Honeypot", E("shield"), ButtonStyle.Primary)
    );
    addText(container, "-# A Nina ignora administradores e quem tem Gerenciar Servidor. Requer Gerenciar Servidor para configurar.");
    addNav(container);
    return finish(container);
}

const HONEYPOT_ACTION_OPTIONS = [
    { value: "ban", label: "Banimento", description: "Bane quem enviar mensagem no canal-isca", emoji: E("ui_hammer") },
    { value: "kick", label: "Expulsão", description: "Expulsa quem enviar mensagem no canal-isca", emoji: E("ui_hammer") },
    { value: "timeout", label: "Timeout de 24h", description: "Silencia por 24 horas", emoji: E("ui_timedout") },
    { value: "log", label: "Somente registrar", description: "Não pune; apenas alerta a moderação", emoji: E("logs") }
];

async function buildHoneypot(interaction) {
    const c = await SecurityRepository.get(interaction.guild.id);
    const container = card(c.honeypot_enabled ? ui.COLORS.success : ui.COLORS.neutral);
    addHeader(container, E("shield"), "Honeypot", "Canal-isca para detectar contas automatizadas. Quem enviar mensagem nele sofre a ação programada.");

    addToggle(container, {
        id: "config_toggle:security_honeypot",
        title: "Honeypot",
        description: c.honeypot_channel_id ? `Canal-isca: <#${c.honeypot_channel_id}>` : "Escolha primeiro o canal-isca abaixo.",
        enabled: !!c.honeypot_enabled
    });

    const issues = c.honeypot_enabled ? SecurityManager.honeypotDiagnostics(interaction.guild, c) : [];
    addText(container, issues.length
        ? `**${E("atencao")} Atenção**\n${issues.map(item => `• ${item}`).join("\n")}`
        : `**Status**\n${c.honeypot_enabled ? `${E("ui_check")} Tudo certo: o aviso está publicado e as permissões estão corretas.` : "Desligado."}`);
    addSep(container);

    addText(container, `**Canal-isca**\n${mention(c.honeypot_channel_id)}\n-# Deve ser visível e liberado para @everyone. Ao escolher, a Nina publica o aviso no canal.`);
    addRow(container, channelSelect("config_channel:security_honeypot", "Escolher canal-isca", ChannelType.GuildText));

    addText(container, `**Ação programada**\n${SecurityManager.HONEYPOT_ACTION_LABELS[c.honeypot_action] || "Banimento"}`);
    addRow(container, new StringSelectMenuBuilder()
        .setCustomId("config_honeypot_action")
        .setPlaceholder("Escolher ação")
        .addOptions(HONEYPOT_ACTION_OPTIONS.map(option => ({ ...option, default: option.value === c.honeypot_action }))));

    addText(container, `**Canal de alertas**\n${mention(c.alert_channel_id)}\n-# Se não definido, usa o canal de logs.`);
    addRow(container, channelSelect("config_channel:security_alert", "Escolher canal de alertas", ChannelType.GuildText));

    addRow(container, actionButton("config_security:notice", "Reenviar aviso", E("ui_send"), ButtonStyle.Primary));
    addNav(container, [actionButton("config_security:back", "Security Center", E("shield"))]);
    return finish(container);
}

async function buildSecurityRules(interaction) {
    const rules = await SecurityRepository.listRules(interaction.guild.id);
    const container = card(rules.length ? ui.COLORS.info : ui.COLORS.neutral);
    addHeader(container, E("ui_content"), "TopicGuard • Regras", "Palavras-chave monitoradas por canal. Revise cada regra antes de ativar o sistema.");

    if (rules.length) {
        addText(container, rules.slice(0, 8).map(r => `• **#${r.id} · ${ui.clip(r.topic, 80)}** — <#${r.channel_id}>\n  -# ${r.keywords.join(", ")}`).join("\n"));
        if (rules.length > 8) addText(container, `-# Exibindo 8 de ${rules.length} regras. As demais continuam salvas.`);
    } else {
        addText(container, "Nenhuma regra cadastrada ainda. Adicione uma regra para definir o canal, o assunto e as palavras-chave.");
    }

    addRow(container,
        actionButton("config_modal:security_rule", "Adicionar regra", E("ui_plus"), ButtonStyle.Primary),
        actionButton("config_modal:security_remove_rule", "Remover regra", E("ui_trashcan"), ButtonStyle.Danger)
    );
    addNav(container, [actionButton("config_security:back", "Voltar ao Security Center", E("shield"))]);
    return finish(container);
}

async function buildWelcome(interaction) {
    const c = await WelcomeRepository.get(interaction.guild.id);
    const container = card(stateColor(c.enabled));

    addHeader(container, E("aceno"), "Boas-vindas", "Cartão e mensagem enviados quando alguém entra no servidor.");

    addToggle(container, { id: "config_toggle:welcome", title: "Sistema de boas-vindas", description: c.channel_id ? `Enviando em <#${c.channel_id}>` : "Escolha um canal abaixo para começar.", enabled: !!c.enabled });

    addSep(container);
    addText(container, [
        `**Título**\n${ui.clip(c.title_text, 200) || NOT_SET}`,
        `**Mensagem**\n> ${ui.clip(String(c.message_content || "").replace(/\n/g, "\n> "), 600) || NOT_SET}`,
        `**Fundo**\n${c.background_url ? `[Ver imagem](${c.background_url})` : "Padrão (gradiente)"}`
    ].join("\n\n"));

    addSep(container);
    addText(container, "**Canal de boas-vindas**");
    addRow(container, channelSelect("config_channel:welcome", "Escolher canal de boas-vindas", ChannelType.GuildText));

    addRow(
        container,
        actionButton("config_modal:welcome_text", "Textos", E("ui_content")),
        actionButton("config_modal:welcome_background", "Fundo", E("ui_thumbnail")),
        actionButton("config_clear:welcome_background", "Remover fundo", E("ui_trashcan"), ButtonStyle.Danger),
        actionButton("config_welcome_test", "Testar", E("ui_flask"))
    );

    addNav(container);
    return finish(container);
}

async function buildTickets(interaction) {
    const c = await TicketRepository.getConfig(interaction.guild.id);
    const mode = TicketManager.normalizeMode(c.mode);
    const active = TicketRepository.isConfigured(c);
    const container = card(stateColor(active));

    addHeader(container, "ticket", "Tickets", "Atendimento e suporte do servidor.");

    addToggle(container, { id: "config_toggle:tickets", title: "Sistema de tickets", description: active ? "Funcionando." : (mode === "channel" ? "Defina a categoria dos tickets para ativar de fato." : "Defina o canal dos tickets para ativar de fato."), enabled: !!c.enabled });

    addSep(container);
    addText(container, `**Modo de criação**\n${TicketManager.modeLabel(mode)} — ${mode === "channel" ? "cada ticket vira um canal privado dentro de uma categoria." : "cada ticket vira um tópico privado dentro do canal escolhido."}`);
    addRow(container, new StringSelectMenuBuilder()
        .setCustomId("config_ticket_mode")
        .setPlaceholder("Escolher modo de criação")
        .addOptions([
            { label: "Tópico privado", value: "thread", description: "Modo padrão: tópicos dentro de um canal.", default: mode === "thread" },
            { label: "Canal privado", value: "channel", description: "Um canal de texto por ticket, em uma categoria.", default: mode === "channel" }
        ]));

    addSep(container);
    if (mode === "channel") {
        const category = TicketManager.resolveCategory(interaction.guild, c);
        addText(container, `**${E("ui_textc")} Categoria dos tickets**\n${category ? `**${category.name}**` : "*não definida*"}\n\n**${E("user")} Cargo de suporte**\n${roleMention(c.support_role_id)}`);
        addRow(container, channelSelect("config_channel:tickets_category", "Escolher categoria dos tickets", ChannelType.GuildCategory));
    } else {
        addText(container, `**${E("ui_textc")} Canal dos tickets**\n${mention(c.parent_channel_id)}\n\n**${E("user")} Cargo de suporte**\n${roleMention(c.support_role_id)}`);
        addRow(container, channelSelect("config_channel:tickets", "Escolher canal dos tickets", ChannelType.GuildText));
    }
    addRow(container, roleSelect("config_role:tickets", "Escolher cargo de suporte"));

    addNav(container);
    return finish(container);
}

async function buildLogs(interaction) {
    const guildId = interaction.guild.id;
    const [s, disabled, statsLogsEnabled] = await Promise.all([
        GuildRepository.getSettings(guildId),
        GuildRepository.getDisabledCategories(guildId),
        GuildRepository.isStatsLogsEnabled(guildId)
    ]);
    const container = card(s.log_channel ? ui.COLORS.success : ui.COLORS.neutral);

    addHeader(container, E("ui_logs"), "Logs", "Escolha o canal e quais eventos a Nina deve registrar.");

    addText(container, `**${E("ui_textc")} Canal de logs**\n${mention(s.log_channel)}`);
    addRow(container, channelSelect("config_channel:logs", "Escolher canal de logs", ChannelType.GuildText));

    addSep(container);

    const entries = Object.entries(CATEGORIES);
    const lines = entries.map(([key, value]) => `${ui.dot(!disabled.includes(key))} ${value.emoji ? `${value.emoji} ` : ""}${value.label}`);
    const half = Math.ceil(lines.length / 2);
    addText(container, `**Categorias**\n${lines.slice(0, half).join("\n")}`);
    if (lines.length > half) addText(container, lines.slice(half).join("\n"));

    addRow(
        container,
        new StringSelectMenuBuilder()
            .setCustomId("config_log_category")
            .setPlaceholder("Ativar/desativar uma categoria")
            .addOptions(entries.slice(0, 25).map(([key, value]) => ({ label: value.label, value: key, emoji: value.emoji })))
    );

    addSep(container);
    addToggle(container, { id: "config_logs:stats", title: `${E("ui_chart")} Logs dos Stats`, description: "Registra a atualização dos canais de contadores.", enabled: statsLogsEnabled });

    addNav(container);
    return finish(container);
}

async function buildAutorole(interaction) {
    const guildId = interaction.guild.id;
    const [join, self, level, reactions] = await Promise.all([
        AutoroleRepository.getJoinRoles(guildId),
        AutoroleRepository.listSelfRoles(guildId),
        AutoroleRepository.listLevelRoles(guildId),
        AutoroleRepository.listReactionRoles(guildId)
    ]);
    const container = card(ui.COLORS.info);

    addHeader(container, E("user"), "Autoroles", "Cargos automáticos, por botão, por reação e por nível.");

    addText(container, [
        `${E("ui_invite")} **Entrada:** ${join.length}`,
        `${E("cargo")} **Self-roles:** ${self.length}`,
        `${E("ui_buttonclick")} **Reações:** ${reactions.length}`,
        `${E("trophy")} **Níveis:** ${level.length}`
    ].join("  ·  "));

    if (self.length) {
        addSep(container);
        addText(container, `**Botões configurados**\n${self.slice(0, 10).map(role => `• ${role.label} · <@&${role.role_id}>`).join("\n")}${self.length > 10 ? `\n-# +${self.length - 10} outros` : ""}`);
    }

    if (reactions.length) {
        addSep(container);
        addText(container, `**Regras por reação**\n${reactions.slice(0, 5).map(rule => `#${rule.id} · <#${rule.channel_id}> · <@&${rule.role_id}>`).join("\n")}${reactions.length > 5 ? `\n-# +${reactions.length - 5} outras` : ""}`);
    }

    addSep(container);
    addText(container, "**Cargo automático de entrada**");
    addRow(container, roleSelect("config_role:autorole_join", "Adicionar cargo de entrada"));

    addRow(
        container,
        actionButton("config_modal:autorole_selfrole", "Self-role", E("user")),
        actionButton("config_modal:autorole_level", "Por nível", E("trophy")),
        actionButton("config_modal:autorole_reaction", "Por reação", E("ui_buttonclick"))
    );
    addRow(
        container,
        actionButton("config_autorole:publish", "Publicar painel aqui", E("ui_send"), ButtonStyle.Primary),
        actionButton("config_modal:autorole_reaction_remove", "Remover reação", E("ui_trashcan"), ButtonStyle.Danger),
        actionButton("config_modal:autorole_note", "Ajuda", E("info"))
    );

    if (self.length) {
        addRow(
            container,
            new StringSelectMenuBuilder()
                .setCustomId("config_selfrole_remove")
                .setPlaceholder("Remover cargos de botão")
                .setMinValues(1)
                .setMaxValues(Math.min(self.length, 25))
                .addOptions(self.slice(0, 25).map(role => ({
                    label: role.label.slice(0, 100),
                    value: role.role_id,
                    description: `Cargo ${role.role_id}`
                })))
        );
    }

    addNav(container);
    return finish(container);
}

async function buildLockdown(interaction) {
    const config = await LockdownManager.getConfig(interaction.guild.id);
    const list = ids => ids.length ? ids.map(id => `<#${id}>`).join(" ") : "*Nenhum*";
    const roleList = ids => ids.length ? ids.map(id => `<@&${id}>`).join(" ") : "*Nenhum*";
    const channelTypes = [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildForum,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice
    ];
    const container = card(config.active ? ui.COLORS.error : ui.COLORS.info);

    addHeader(
        container,
        config.active ? "lock" : "unlock",
        E("lock"),
        "Tranque canais e categorias rapidamente. Administradores continuam com acesso pelo bypass do Discord."
    );

    addText(container, `${config.active ? `${E("botao_off")} **LOCKDOWN ATIVO**` : `${E("botao_on")} **Lockdown inativo**`}\n-# Sistema ${config.enabled ? "ativado" : "desativado"}`);

    addRow(
        container,
        toggleButton("config_lockdown:enabled", config.enabled, "Sistema"),
        actionButton("config_lockdown:lock", "Trancar", E("lock"), ButtonStyle.Danger).setDisabled(!config.enabled || config.active),
        actionButton("config_lockdown:unlock", "Destrancar", E("unlock"), ButtonStyle.Success).setDisabled(!config.active)
    );

    addSep(container);
    addText(container, [
        `**${E("ui_textc")} Canais**\n${list(config.channel_ids)}`,
        `**${E("ui_dir")} Categorias**\n${list(config.category_ids)}`,
        `**${E("ui_check")} Acesso permitido**\n${roleList(config.allowed_role_ids)}`,
        `**${E("ui_dnd")} Acesso negado**\n${roleList(config.denied_role_ids)}`
    ].join("\n\n"));
    addText(container, "-# Não use o mesmo cargo nas duas listas. Se um membro tiver cargos das duas listas, o Discord prioriza a permissão permitida.");

    addSep(container);

    addRow(
        container,
        channelSelect("config_channel:lockdown_channels", "Canais de texto e voz (substitui a lista)", ...channelTypes)
            .setDefaultChannels(...config.channel_ids.filter(id => interaction.guild.channels.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        channelSelect("config_channel:lockdown_categories", "Categorias (substitui a lista)", ChannelType.GuildCategory)
            .setDefaultChannels(...config.category_ids.filter(id => interaction.guild.channels.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        roleSelect("config_role:lockdown_allowed", "Cargos com acesso durante o lockdown")
            .setDefaultRoles(...config.allowed_role_ids.filter(id => interaction.guild.roles.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        roleSelect("config_role:lockdown_denied", "Cargos sem acesso durante o lockdown")
            .setDefaultRoles(...config.denied_role_ids.filter(id => interaction.guild.roles.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );

    addNav(container);
    return finish(container);
}

async function buildStats(interaction) {
    const c = await ServerStatsRepository.get(interaction.guild.id);
    const counters = [
        ["members", "👥 Membros"], ["bots", "🤖 Bots"], ["online", "🟢 Online"],
        ["offline", "⚫ Offline"], ["voice", "🔊 Em call"], ["channels", "💬 Canais"],
        ["categories", "📂 Categorias"], ["roles", "🎭 Cargos"], ["servers", "🌐 Servidores"]
    ];
    const container = card(stateColor(c.enabled));

    addHeader(container, "chart", "Stats do servidor", "Canais de voz bloqueados que mostram contadores atualizados automaticamente.");

    addToggle(container, { id: "config_stats:enabled", title: "Sistema de Stats", description: "Cria ou remove os canais de contadores.", enabled: !!c.enabled });

    addSep(container);
    addText(container, "**Contadores exibidos**");

    for (let i = 0; i < counters.length; i += 3) {
        addRow(
            container,
            ...counters.slice(i, i + 3).map(([key, label]) =>
                toggleButton(`config_stats:${key}`, !!c[`${key}_enabled`], label)
            )
        );
    }

    addNav(container, [actionButton("config_stats:update", "Atualizar agora", E("ui_torefresh"))]);
    return finish(container);
}

async function buildAntiNuke(interaction) {
    const c = await AntiNukeRepository.get(interaction.guild.id);
    const container = card(c.enabled ? ui.COLORS.error : ui.COLORS.neutral);

    addHeader(container, E("nuclear"), "Anti-Nuke", "Detecta e bloqueia ações destrutivas em massa.");

    addToggle(container, { id: "config_antinuke:enabled", title: "Proteção Anti-Nuke", description: c.enabled ? "Proteção ativa." : "Proteção desativada.", enabled: !!c.enabled });

    addSep(container);
    addText(container, [
        `${E("clock")} **Janela de detecção:** ${c.window_seconds}s`,
        `${E("ui_textc")} **Canais:** ${c.channel_limit}`,
        `${E("cargo")} **Cargos:** ${c.role_limit}`,
        `${E("ui_hammer")} **Bans/Kicks:** ${c.member_limit}`,
        `${E("ui_settings")} **Ação:** ${c.action === "ban" ? "Banir + remover cargos" : "Remover cargos"}`
    ].join("\n"));

    addRow(container, actionButton("config_modal:antinuke", "Configurar limites", E("ui_settings")));

    addNav(container);
    return finish(container);
}

async function buildVoiceRec(interaction) {
    const guild = interaction.guild;
    const c = await VoiceRecordingRepository.get(guild.id);
    const apiReady = RecordingApi.isConfigured();
    const container = card(stateColor(c.enabled));

    addHeader(container, E("ui_mic"), "Gravação de calls", "Grave calls, transcreva com IA e controle quem pode gravar. Use /voicepanel dentro de um canal de voz.");

    addToggle(container, {
        id: "config_voicerec:enabled",
        title: "Sistema de gravação",
        description: apiReady ? "Os membros autorizados já podem usar /voicepanel." : "A transcrição ainda não foi configurada no host (TRANSCRIPTION_GROQ_API_KEY).",
        enabled: !!c.enabled
    });

    addSep(container);

    const roleList = c.allowed_role_ids.length ? c.allowed_role_ids.map(id => `<@&${id}>`).join(" ") : "*Somente quem tem Gerenciar Servidor*";
    const allowedChannels = c.allowed_channel_ids.length ? c.allowed_channel_ids.map(id => `<#${id}>`).join(" ") : "*Todos os canais de voz*";
    const blockedChannels = c.blocked_channel_ids.length ? c.blocked_channel_ids.map(id => `<#${id}>`).join(" ") : "*Nenhum*";

    addText(container, [
        `**Cargos que podem gravar**\n${roleList}`,
        `**Somente estes canais**\n${allowedChannels}`,
        `**Canais bloqueados**\n${blockedChannels}`,
        `**Duração máxima:** ${c.max_minutes} min`
    ].join("\n\n"));

    addRow(
        container,
        roleSelect("config_role:voicerec", "Cargos que podem gravar")
            .setDefaultRoles(...c.allowed_role_ids.filter(id => guild.roles.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        channelSelect("config_channel:voicerec_allowed", "Somente estes canais (vazio = todos)", ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setDefaultChannels(...c.allowed_channel_ids.filter(id => guild.channels.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        channelSelect("config_channel:voicerec_blocked", "Canais que nunca podem ser gravados", ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setDefaultChannels(...c.blocked_channel_ids.filter(id => guild.channels.cache.has(id)))
            .setMinValues(0)
            .setMaxValues(25)
    );
    addRow(
        container,
        new StringSelectMenuBuilder()
            .setCustomId("config_voicerec_max")
            .setPlaceholder("Duração máxima por gravação")
            .addOptions(VoiceRecordingRepository.MAX_MINUTES_OPTIONS.map(minutes => ({
                label: `${minutes} minutos`,
                value: String(minutes),
                default: minutes === c.max_minutes
            })))
    );

    addText(container, "-# Administradores e quem tem Gerenciar Servidor sempre podem gravar. Os participantes são avisados no chat da call. Canais bloqueados têm prioridade sobre os liberados.");
    addNav(container);
    return finish(container);
}

async function buildTempVoice(interaction) {
    const c = await TempVoiceRepository.get(interaction.guild.id);
    const rooms = await TempVoiceRepository.getRooms(interaction.guild.id);
    const trigger = c.trigger_channel_id ? interaction.guild.channels.cache.get(c.trigger_channel_id) : null;
    const category = c.category_id ? interaction.guild.channels.cache.get(c.category_id) : null;

    const nameMode = c.name_template === "🔊 {username}" ? "Nome de usuário"
        : c.name_template === "🔊 {user}" ? "Nome de exibição"
            : `Personalizado: \`${c.name_template}\``;

    const container = card(stateColor(c.enabled));

    addHeader(container, E("ui_voicec"), "TempVoice", "Salas de voz temporárias criadas e removidas automaticamente.");

    addToggle(container, { id: "config_tempvoice:enabled", title: "Sistema TempVoice", description: `${rooms.length} sala(s) ativa(s) agora.`, enabled: !!c.enabled });

    addSep(container);
    addText(container, [
        `**Canal de entrada**\n${trigger ? `<#${trigger.id}>` : NOT_SET}`,
        `**Categoria das salas**\n${category ? `<#${category.id}>` : NOT_SET}`,
        `**Nome das salas**\n${nameMode}`,
        `**Limite padrão**\n${c.default_limit ? `${c.default_limit} membros` : "Sem limite"}`
    ].join("\n\n"));

    addRow(container, channelSelect("config_tempvoice:trigger", "Escolher canal de entrada", ChannelType.GuildVoice));
    addRow(container, channelSelect("config_tempvoice:category", "Escolher categoria das salas", ChannelType.GuildCategory));

    addRow(
        container,
        actionButton("config_tempvoice:autocreate", "Criar estrutura", E("ui_wrench"), ButtonStyle.Primary),
        actionButton("config_tempvoice:name", "Nome", E("ui_title")),
        actionButton("config_tempvoice:limit", "Limite", E("ui_users")),
        toggleButton("config_tempvoice:autolock", !!c.auto_lock, "Auto-lock")
    );

    addNav(container, [actionButton("config_tempvoice:permissions_page", "Permissões", E("shield"))]);
    return finish(container);
}

async function buildTempVoicePermissions(interaction) {
    const c = await TempVoiceRepository.get(interaction.guild.id);
    const managerRole = c.manager_role_id ? interaction.guild.roles.cache.get(c.manager_role_id) : null;
    const container = card(stateColor(c.enabled));

    addHeader(container, E("shield"), "TempVoice • Permissões", "Quem administra as salas e o que o dono da sala pode fazer.");

    addToggle(container, { id: "config_tempvoice:admin", title: "Admins/Moderação gerenciam salas", description: managerRole ? `Cargo de gerenciamento: <@&${managerRole.id}>` : "Nenhum cargo de gerenciamento definido.", enabled: !!c.admin_manage });

    addSep(container);
    addText(container, `**Permissões do dono da sala**\n${dots([
        ["Renomear", c.owner_rename],
        ["Bloquear", c.owner_lock],
        ["Alterar limite", c.owner_limit],
        ["Expulsar", c.owner_kick],
        ["Bloquear membro", c.owner_ban],
        ["Transferir dono", c.owner_transfer],
        ["Excluir", c.owner_delete]
    ])}`);

    addRow(container, roleSelect("config_tempvoice:role", "Cargo que pode gerenciar salas"));
    addRow(
        container,
        actionButton("config_tempvoice:permissions", "Permissões do dono", E("lock")),
        actionButton("config_tempvoice:permissions2", "Mais permissões", E("ui_wrench"))
    );

    addSep(container);
    addRow(
        container,
        actionButton("config_tempvoice:permissions_back", "Voltar ao TempVoice", E("ui_arrowl")),
        actionButton("config_close", "Fechar", `${E("ui_cancel")}️`, ButtonStyle.Danger)
    );
    return finish(container);
}

/*
=========================
    FERRAMENTAS DO SERVIDOR
    (verificação, contas novas, relatório semanal e backup)
=========================
*/

const ACCOUNT_ACTION_OPTIONS = [
    { value: "alert", label: "Apenas alertar a equipe" },
    { value: "timeout", label: "Castigo até a conta atingir a idade mínima" },
    { value: "kick", label: "Expulsar automaticamente" }
];

const backupDate = row => {
    const ts = Math.floor(new Date(`${row.created_at}Z`).getTime() / 1000);
    return Number.isFinite(ts) ? `<t:${ts}:f>` : "—";
};

async function buildVerification(interaction) {
    const guild = interaction.guild;
    const c = await ServerToolsRepository.getConfig(VerificationManager.TABLE, guild.id);
    const container = card(stateColor(c.enabled));

    addHeader(container, E("ui_check"), "Verificação de entrada", "O membro só libera o servidor depois de confirmar que não é um robô.");

    addToggle(container, {
        id: "config_verif:enabled",
        title: "Sistema de verificação",
        description: c.enabled ? "Ativa: quem entra precisa usar o painel de verificação." : (c.role_id ? "Desativada." : "Escolha o cargo verificado para poder ativar."),
        enabled: !!c.enabled
    });

    addSep(container);

    addText(container, [
        `**Modo:** ${c.mode === "captcha" ? "Pergunta (captcha simples)" : "Botão (um clique)"}`,
        `**Cargo verificado:** ${roleMention(c.role_id)}`,
        `**Cargo não verificado:** ${c.unverified_role_id ? roleMention(c.unverified_role_id) : "*não usado*"}`,
        `**Painel:** ${c.message_id && c.channel_id ? mention(c.channel_id) : "*ainda não enviado*"}`
    ].join("\n"));

    addRow(
        container,
        roleSelect("config_role:verif_role", "Cargo entregue a quem se verificar")
            .setDefaultRoles(...(c.role_id && guild.roles.cache.has(c.role_id) ? [c.role_id] : []))
            .setMinValues(1)
            .setMaxValues(1)
    );
    addRow(
        container,
        roleSelect("config_role:verif_unverified", "Cargo de quem ainda não se verificou (opcional)")
            .setDefaultRoles(...(c.unverified_role_id && guild.roles.cache.has(c.unverified_role_id) ? [c.unverified_role_id] : []))
            .setMinValues(0)
            .setMaxValues(1)
    );
    addRow(
        container,
        channelSelect("config_channel:verif_channel", "Canal do painel (é enviado ao selecionar)", ChannelType.GuildText)
            .setDefaultChannels(...(c.channel_id && guild.channels.cache.has(c.channel_id) ? [c.channel_id] : []))
            .setMinValues(1)
            .setMaxValues(1)
    );
    addRow(
        container,
        new StringSelectMenuBuilder()
            .setCustomId("config_verif_mode")
            .setPlaceholder("Como o membro se verifica")
            .addOptions([
                { label: "Botão (um clique)", value: "button", default: c.mode !== "captcha" },
                { label: "Pergunta (captcha simples)", value: "captcha", default: c.mode === "captcha" }
            ])
    );

    addText(container, "-# Para valer de verdade, esconda os canais do servidor de @everyone e libere-os só para o cargo verificado. Enviar o painel ativa a verificação; ao trocar o modo, reenvie o painel.");
    addNav(container, [actionButton("config_verif:send", c.message_id ? "Reenviar painel" : "Enviar painel", E("ui_send"), ButtonStyle.Primary)]);
    return finish(container);
}

async function buildAccountFilter(interaction) {
    const guild = interaction.guild;
    const c = await ServerToolsRepository.getConfig(AccountFilterManager.TABLE, guild.id);
    const container = card(stateColor(c.enabled));

    addHeader(container, E("ui_block"), "Filtro de contas novas", "Trata contas recém-criadas que tentam entrar no servidor.");

    addToggle(container, {
        id: "config_account:enabled",
        title: "Filtro de contas novas",
        description: c.enabled ? "Ativo." : "Desativado.",
        enabled: !!c.enabled
    });

    addSep(container);

    addText(container, [
        `${E("clock")} **Idade mínima:** ${c.min_age_days} dia(s)`,
        `${E("shield")} **Ação:** ${AccountFilterManager.ACTIONS[c.action] || c.action}`,
        `${E("channel")} **Alertas:** ${c.alert_channel_id ? mention(c.alert_channel_id) : "*nenhum canal definido*"}`
    ].join("\n"));

    addRow(
        container,
        new StringSelectMenuBuilder()
            .setCustomId("config_account_action")
            .setPlaceholder("O que fazer com contas abaixo do mínimo")
            .addOptions(ACCOUNT_ACTION_OPTIONS.map(o => ({ ...o, default: o.value === c.action })))
    );
    addRow(
        container,
        channelSelect("config_channel:account_alert", "Canal dos alertas", ChannelType.GuildText)
            .setDefaultChannels(...(c.alert_channel_id && guild.channels.cache.has(c.alert_channel_id) ? [c.alert_channel_id] : []))
            .setMinValues(1)
            .setMaxValues(1)
    );
    addRow(container, actionButton("config_modal:account_age", "Idade mínima", E("clock")));

    addText(container, "-# Castigo exige a permissão Castigar Membros e expulsão exige Expulsar Membros. Bots não passam pelo filtro.");
    addNav(container);
    return finish(container);
}

async function buildWeeklyReport(interaction) {
    const guild = interaction.guild;
    const c = await ServerToolsRepository.getConfig(WeeklyReportManager.TABLE, guild.id);
    const container = card(stateColor(c.enabled));

    addHeader(container, E("calendar"), "Relatório semanal", "Resumo automático de atividade e moderação enviado para a equipe.");

    addToggle(container, {
        id: "config_report:enabled",
        title: "Relatório semanal",
        description: c.enabled ? "Ativo." : (c.channel_id ? "Desativado." : "Escolha o canal da equipe para poder ativar."),
        enabled: !!c.enabled
    });

    addSep(container);

    addText(container, [
        `${E("channel")} **Canal:** ${mention(c.channel_id)}`,
        `${E("calendar")} **Envio:** ${WeeklyReportManager.DAYS[c.day] ?? "—"}, às 9h (Brasília)`,
        `${E("clock")} **Último envio:** ${c.last_sent || "*nunca*"}`
    ].join("\n"));

    addRow(
        container,
        channelSelect("config_channel:report_channel", "Canal da equipe", ChannelType.GuildText)
            .setDefaultChannels(...(c.channel_id && guild.channels.cache.has(c.channel_id) ? [c.channel_id] : []))
            .setMinValues(1)
            .setMaxValues(1)
    );
    addRow(
        container,
        new StringSelectMenuBuilder()
            .setCustomId("config_report_day")
            .setPlaceholder("Dia da semana do envio")
            .addOptions(WeeklyReportManager.DAYS.map((name, value) => ({ label: name, value: String(value), default: value === c.day })))
    );

    addNav(container, [actionButton("config_report:send", "Enviar agora", E("ui_send"), ButtonStyle.Primary)]);
    return finish(container);
}

async function buildBackup(interaction) {
    const backups = await ServerToolsRepository.listBackups(interaction.guild.id);
    const container = card(backups.length ? ui.COLORS.success : ui.COLORS.neutral);

    addHeader(container, E("pasta"), "Backup do servidor", "Salva cargos, categorias, canais e permissões para recriar o que faltar.");

    addText(container, backups.length
        ? backups.map(b => `**#${b.id}** · ${b.name}\n┗ ${backupDate(b)} · por <@${b.created_by}> · ${(b.size / 1024).toFixed(0)} KB`).join("\n")
        : "*Nenhum backup salvo ainda.*");

    addRow(container, actionButton("config_backup:create", "Criar backup agora", E("pasta"), ButtonStyle.Primary));

    if (backups.length) {
        addRow(
            container,
            new StringSelectMenuBuilder()
                .setCustomId("config_backup_pick")
                .setPlaceholder("Escolha um backup para restaurar ou excluir")
                .addOptions(backups.slice(0, 25).map(b => ({
                    label: `#${b.id} · ${b.name}`.slice(0, 100),
                    value: String(b.id),
                    description: `${(b.size / 1024).toFixed(0)} KB`
                })))
        );
    }

    addText(container, `-# Só quem tem Administrador pode criar, restaurar ou excluir. Guarda até ${ServerToolsRepository.MAX_BACKUPS_PER_GUILD} backups (os mais antigos saem). A restauração só recria o que não existe; nada é apagado. Mensagens, membros e configurações da Nina não entram.`);
    addNav(container);
    return finish(container);
}

async function build(interaction, category) {
    switch (category) {
        case "general": return buildGeneral(interaction);
        case "automod": return buildAutomod(interaction);
        case "security": return buildSecurity(interaction);
        case "security_rules": return buildSecurityRules(interaction);
        case "honeypot": return buildHoneypot(interaction);
        case "welcome": return buildWelcome(interaction);
        case "tickets": return buildTickets(interaction);
        case "logs": return buildLogs(interaction);
        case "autorole": return buildAutorole(interaction);
        case "lockdown": return buildLockdown(interaction);
        case "stats": return buildStats(interaction);
        case "antinuke": return buildAntiNuke(interaction);
        case "voicerec": return buildVoiceRec(interaction);
        case "tempvoice": return buildTempVoice(interaction);
        case "tempvoice_permissions": return buildTempVoicePermissions(interaction);
        case "verification": return buildVerification(interaction);
        case "accountfilter": return buildAccountFilter(interaction);
        case "weeklyreport": return buildWeeklyReport(interaction);
        case "backup": return buildBackup(interaction);
        default: return buildHome(interaction);
    }
}

/**
 * Abre (ou atualiza) uma tela do painel.
 * - mode "edit": atualiza a mensagem do painel que gerou a interação.
 * - mode "reply": envia o painel como resposta efêmera (inicial ou após defer).
 */
async function show(interaction, category = null, mode = "reply") {
    const payload = await build(interaction, category);

    if (mode === "edit") return interaction.update(payload);

    if (interaction.deferred && !interaction.replied) return interaction.editReply(payload);

    return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}

module.exports = {
    CATEGORY_OPTIONS,
    permissionOk,
    build,
    buildHome,
    show
};
