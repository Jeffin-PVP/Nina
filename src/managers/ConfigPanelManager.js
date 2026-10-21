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
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const ServerStatsRepository = require("../database/repositories/ServerStatsRepository");
const AntiNukeRepository = require("../database/repositories/AntiNukeRepository");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");
const VoiceRecordingRepository = require("../database/repositories/VoiceRecordingRepository");
const RecordingApi = require("../services/RecordingService");
const SecurityRepository = require("../database/repositories/SecurityRepository");
const SecurityManager = require("./SecurityManager");
const LockdownManager = require("./LockdownManager");
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
    { value: "general", label: "Geral", description: "Economia, moderação e níveis", emoji: "<:config:1562187516625555496>" },
    { value: "automod", label: "AutoMod", description: "Proteção automática do servidor", emoji: "<:ui_bot:1560326748313493546>" },
    { value: "security", label: "Security Center", description: "Assuntos proibidos e Honeypot", emoji: "<:escudo:1562187519150395393>" },
    { value: "welcome", label: "Boas-vindas", description: "Mensagem e canal de entrada", emoji: "<:aceno:1562187509490778162>" },
    { value: "tickets", label: "Tickets", description: "Suporte e atendimento", emoji: "<:ticket:1562187545914380319>" },
    { value: "logs", label: "Logs", description: "Registros e auditoria", emoji: "<:logs:1562187526272192622>" },
    { value: "autorole", label: "Autoroles", description: "Cargos automáticos e níveis", emoji: "<:cargo:1562189000544882808>" },
    { value: "stats", label: "Stats", description: "Contadores do servidor", emoji: "<:stats:1562187543653388391>" },
    { value: "antinuke", label: "Anti-Nuke", description: "Proteção contra ataques destrutivos", emoji: "<:nuclear:1562187533721272451>" },
    { value: "tempvoice", label: "TempVoice", description: "Salas de voz temporárias", emoji: "<:voz:1562187549932388383>" },
    { value: "voicerec", label: "Gravação de calls", description: "Gravar e transcrever calls com IA", emoji: "<:ui_mic:1560326973673316403>" },
    { value: "lockdown", label: "Lockdown", description: "Bloqueio rápido de canais e categorias", emoji: "<:lock:1561418439879565404>" }
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
        .setEmoji(enabled ? "<:botao_on:1557820524305064056>" : "<:botao_off:1557820521088024696>")
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
        new ButtonBuilder().setCustomId("config_home").setLabel("Voltar").setEmoji("<:ui_arrowl:1560326702721146890>").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji("<:ui_cancel:1560326759059030188>️").setStyle(ButtonStyle.Danger)
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
    const [settings, automod, welcome, tickets, stats, antinuke, lockdown, tempvoice, security, voicerec] = await Promise.all([
        GuildRepository.getSettings(guildId),
        AutomodRepository.get(guildId),
        WelcomeRepository.get(guildId),
        TicketRepository.getConfig(guildId),
        ServerStatsRepository.get(guildId),
        AntiNukeRepository.get(guildId),
        LockdownManager.getConfig(guildId),
        TempVoiceRepository.get(guildId),
        SecurityRepository.get(guildId),
        VoiceRecordingRepository.get(guildId)
    ]);

    const groups = [
        ["<:shield:1561427396719284334> Proteção", [
            ["AutoMod", automod.enabled],
            ["Anti-Nuke", antinuke.enabled],
            ["Lockdown", lockdown.enabled],
            ["Moderação", settings.moderation_enabled],
            ["TopicGuard", security.topic_enabled],
            ["Honeypot", security.honeypot_enabled || security.behavior_enabled]
        ]],
        ["<:ui_users:1560327175826313336> Comunidade", [
            ["Boas-vindas", welcome.enabled],
            ["Tickets", tickets.enabled && !!tickets.parent_channel_id],
            ["Logs", !!settings.log_channel],
            ["Economia", settings.economy_enabled]
        ]],
        ["<:ui_wrench:1560327206969024613> Utilidades", [
            ["Stats", stats.enabled],
            ["TempVoice", tempvoice.enabled],
            ["Gravação de calls", voicerec.enabled]
        ]]
    ];

    const all = groups.flatMap(([, items]) => items);
    const active = all.filter(([, on]) => on).length;

    const container = card(ui.COLORS.brand);

    const title = `## <:ui_settings:1560327092078645258>  Painel da Nina\nConfigure **${interaction.guild.name}** sem decorar comandos.\n-# ${active} de ${all.length} sistemas ativos`;
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
        new ButtonBuilder().setCustomId("config_refresh").setLabel("Atualizar").setEmoji("<a:ui_torefresh:1560327155819225178>").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji("<:ui_cancel:1560326759059030188>️").setStyle(ButtonStyle.Danger)
    );

    addText(container, "-# Requer a permissão Gerenciar Servidor · Os comandos antigos continuam disponíveis.");

    return finish(container);
}

async function buildGeneral(interaction) {
    const s = await GuildRepository.getSettings(interaction.guild.id);
    const container = card(ui.COLORS.info);

    addHeader(container, "<:ui_settings:1560327092078645258>", "Configuração geral", "Ative ou desative os principais sistemas do servidor.");

    addToggle(container, { id: "config_toggle:economy", title: `<:moneybag:1561484846159757513> Economia`, description: "Moedas, trabalho, loja e jogos de aposta.", enabled: !!s.economy_enabled });
    addToggle(container, { id: "config_toggle:moderation", title: `<:shield:1561427396719284334> Moderação`, description: "Comandos de ban, kick, timeout e avisos.", enabled: !!s.moderation_enabled });
    addToggle(container, { id: "config_toggle:levelup", title: `<:ui_up:1560327169148846100> Avisos de level-up`, description: "Mensagem quando um membro sobe de nível.", enabled: !!s.levelup_enabled });

    addSep(container);
    addText(container, `**<:ui_logs:1560326969311232011> Canal de logs**\n${mention(s.log_channel)}`);

    addNav(container);
    return finish(container);
}

async function buildAutomod(interaction) {
    const c = await AutomodRepository.get(interaction.guild.id);
    const container = card(c.enabled ? ui.COLORS.success : ui.COLORS.neutral);

    addHeader(container, "<:shield:1561427396719284334>", "AutoMod", "Proteção automática contra spam, convites, menções, raid e outros abusos.");

    addToggle(container, { id: "config_toggle:automod", title: "Sistema AutoMod", description: `Punição padrão: mute de ${c.mute_duration_minutes} minuto(s).`, enabled: !!c.enabled });

    addSep(container);
    addText(container, `**Regras**\n${dots([
        ["<:chat:1562187513949454366> Spam", c.spam_enabled],
        ["<:mascaras:1562187528617066569> Emojis em excesso", c.emoji_enabled],
        ["<:ui_textc:1560327137024544808> Palavrões", c.swear_enabled],
        ["<:role:1562191435720163379> Menções em massa", c.mention_enabled],
        ["<:ui_url:1560327173338824856> Convites", c.invite_enabled],
        ["<:ui_invite:1560326931075833916> Anti-Raid", c.raid_enabled],
        ["<:ui_thumbnail:1560327143806730240> Anti-Scam (imagens)", c.image_enabled]
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
        actionButton("config_modal:automod_spam", "Spam", "<:ui_content:1560326801673420922>"),
        actionButton("config_modal:automod_raid", "Raid", "<:ui_invite:1560326931075833916>"),
        actionButton("config_modal:automod_image", "Anti-Scam", "<:ui_thumbnail:1560327143806730240>")
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
    addHeader(container, "<:shield:1561427396719284334>", "Security Center", "TopicGuard, Honeypot e sinais comportamentais.");

    addToggle(container, { id: "config_toggle:topicguard", title: "TopicGuard", description: `${rules.length} regra(s) cadastrada(s). Detecta assuntos proibidos por canal.`, enabled: !!c.topic_enabled });
    addToggle(container, { id: "config_toggle:security_context", title: "Análise contextual por IA", description: "Opcional; só analisa mensagens que correspondem a palavras de regras. Se falhar, não apaga a mensagem.", enabled: !!c.contextual_enabled });
    addToggle(container, { id: "config_toggle:security_warn", title: "Advertência por violação", description: "Registra uma advertência no sistema de avisos da Nina após uma remoção confirmada.", enabled: !!c.topic_warn_enabled });
    addToggle(container, { id: "config_toggle:security_timeout", title: "Timeout por violação", description: `Opcional e mais severo; duração atual: ${c.topic_timeout_minutes} minuto(s).`, enabled: !!c.topic_timeout_enabled });
    addRow(container, actionButton("config_modal:security_timeout", "Duração do timeout", "<:ui_timedout:1560327148315615234>"));
    addToggle(container, { id: "config_toggle:security_behavior", title: "Sinais comportamentais", description: "Detecta padrões repetitivos e envia alertas para revisão humana; não pune automaticamente.", enabled: !!c.behavior_enabled });

    addSep(container);
    addText(container, `**Regras TopicGuard**\n${rules.length} regra(s) cadastrada(s). Gerencie as palavras e os canais em uma tela separada para manter este painel dentro do limite de componentes do Discord.`);
    addText(container, `**Honeypot** ${ui.dot(!!c.honeypot_enabled)}\n${c.honeypot_enabled && c.honeypot_channel_id ? `Canal-isca: <#${c.honeypot_channel_id}> • Ação: **${SecurityManager.HONEYPOT_ACTION_LABELS[c.honeypot_action] || "Banimento"}**` : "Canal-isca que pune automaticamente quem enviar mensagem nele."}`);
    addRow(container,
        actionButton("config_security:rules", "Gerenciar regras", "<:ui_content:1560326801673420922>", ButtonStyle.Primary),
        actionButton("config_security:honeypot", "Configurar Honeypot", "<:shield:1561427396719284334>", ButtonStyle.Primary)
    );
    addText(container, "-# A Nina ignora administradores e quem tem Gerenciar Servidor. Requer Gerenciar Servidor para configurar.");
    addNav(container);
    return finish(container);
}

const HONEYPOT_ACTION_OPTIONS = [
    { value: "ban", label: "Banimento", description: "Bane quem enviar mensagem no canal-isca", emoji: "<:ui_hammer:1560326916345700407>" },
    { value: "kick", label: "Expulsão", description: "Expulsa quem enviar mensagem no canal-isca", emoji: "<:ui_hammer:1560326916345700407>" },
    { value: "timeout", label: "Timeout de 24h", description: "Silencia por 24 horas", emoji: "<:ui_timedout:1560327148315615234>" },
    { value: "log", label: "Somente registrar", description: "Não pune; apenas alerta a moderação", emoji: "<:logs:1562187526272192622>" }
];

async function buildHoneypot(interaction) {
    const c = await SecurityRepository.get(interaction.guild.id);
    const container = card(c.honeypot_enabled ? ui.COLORS.success : ui.COLORS.neutral);
    addHeader(container, "<:shield:1561427396719284334>", "Honeypot", "Canal-isca para detectar contas automatizadas. Quem enviar mensagem nele sofre a ação programada.");

    addToggle(container, {
        id: "config_toggle:security_honeypot",
        title: "Honeypot",
        description: c.honeypot_channel_id ? `Canal-isca: <#${c.honeypot_channel_id}>` : "Escolha primeiro o canal-isca abaixo.",
        enabled: !!c.honeypot_enabled
    });

    const issues = c.honeypot_enabled ? SecurityManager.honeypotDiagnostics(interaction.guild, c) : [];
    addText(container, issues.length
        ? `**<:atencao:1561916202597621841> Atenção**\n${issues.map(item => `• ${item}`).join("\n")}`
        : `**Status**\n${c.honeypot_enabled ? "<:ui_check:1560326782610047098> Tudo certo: o aviso está publicado e as permissões estão corretas." : "Desligado."}`);
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

    addRow(container, actionButton("config_security:notice", "Reenviar aviso", "<:ui_send:1560327089993810011>", ButtonStyle.Primary));
    addNav(container, [actionButton("config_security:back", "Security Center", "<:shield:1561427396719284334>")]);
    return finish(container);
}

async function buildSecurityRules(interaction) {
    const rules = await SecurityRepository.listRules(interaction.guild.id);
    const container = card(rules.length ? ui.COLORS.info : ui.COLORS.neutral);
    addHeader(container, "<:ui_content:1560326801673420922>", "TopicGuard • Regras", "Palavras-chave monitoradas por canal. Revise cada regra antes de ativar o sistema.");

    if (rules.length) {
        addText(container, rules.slice(0, 8).map(r => `• **#${r.id} · ${ui.clip(r.topic, 80)}** — <#${r.channel_id}>\n  -# ${r.keywords.join(", ")}`).join("\n"));
        if (rules.length > 8) addText(container, `-# Exibindo 8 de ${rules.length} regras. As demais continuam salvas.`);
    } else {
        addText(container, "Nenhuma regra cadastrada ainda. Adicione uma regra para definir o canal, o assunto e as palavras-chave.");
    }

    addRow(container,
        actionButton("config_modal:security_rule", "Adicionar regra", "<:ui_plus:1560327041839009854>", ButtonStyle.Primary),
        actionButton("config_modal:security_remove_rule", "Remover regra", "<:ui_trashcan:1560327162979029023>", ButtonStyle.Danger)
    );
    addNav(container, [actionButton("config_security:back", "Voltar ao Security Center", "<:shield:1561427396719284334>")]);
    return finish(container);
}

async function buildWelcome(interaction) {
    const c = await WelcomeRepository.get(interaction.guild.id);
    const container = card(stateColor(c.enabled));

    addHeader(container, "<:aceno:1562187509490778162>", "Boas-vindas", "Cartão e mensagem enviados quando alguém entra no servidor.");

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
        actionButton("config_modal:welcome_text", "Textos", "<:ui_content:1560326801673420922>"),
        actionButton("config_modal:welcome_background", "Fundo", "<:ui_thumbnail:1560327143806730240>"),
        actionButton("config_clear:welcome_background", "Remover fundo", "<:ui_trashcan:1560327162979029023>", ButtonStyle.Danger),
        actionButton("config_welcome_test", "Testar", "<:ui_flask:1560326880945512659>")
    );

    addNav(container);
    return finish(container);
}

async function buildTickets(interaction) {
    const c = await TicketRepository.getConfig(interaction.guild.id);
    const active = c.enabled && !!c.parent_channel_id;
    const container = card(stateColor(active));

    addHeader(container, "ticket", "Tickets", "Atendimento e suporte do servidor.");

    addToggle(container, { id: "config_toggle:tickets", title: "Sistema de tickets", description: active ? "Funcionando." : "Defina o canal dos tickets para ativar de fato.", enabled: !!c.enabled });

    addSep(container);
    addText(container, `**<:ui_textc:1560327137024544808> Canal dos tickets**\n${mention(c.parent_channel_id)}\n\n**<:user:1561426447414071406> Cargo de suporte**\n${roleMention(c.support_role_id)}`);

    addRow(container, channelSelect("config_channel:tickets", "Escolher canal dos tickets", ChannelType.GuildText));
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

    addHeader(container, "<:ui_logs:1560326969311232011>", "Logs", "Escolha o canal e quais eventos a Nina deve registrar.");

    addText(container, `**<:ui_textc:1560327137024544808> Canal de logs**\n${mention(s.log_channel)}`);
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
    addToggle(container, { id: "config_logs:stats", title: `<:ui_chart:1560326780693250089> Logs dos Stats`, description: "Registra a atualização dos canais de contadores.", enabled: statsLogsEnabled });

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

    addHeader(container, "<:user:1561426447414071406>", "Autoroles", "Cargos automáticos, por botão, por reação e por nível.");

    addText(container, [
        `<:ui_invite:1560326931075833916> **Entrada:** ${join.length}`,
        `<:cargo:1562189000544882808> **Self-roles:** ${self.length}`,
        `<:ui_buttonclick:1560326757209473076> **Reações:** ${reactions.length}`,
        `<:trophy:1561479467971387422> **Níveis:** ${level.length}`
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
        actionButton("config_modal:autorole_selfrole", "Self-role", "<:user:1561426447414071406>"),
        actionButton("config_modal:autorole_level", "Por nível", "<:trophy:1561479467971387422>"),
        actionButton("config_modal:autorole_reaction", "Por reação", "<:ui_buttonclick:1560326757209473076>")
    );
    addRow(
        container,
        actionButton("config_autorole:publish", "Publicar painel aqui", "<:ui_send:1560327089993810011>", ButtonStyle.Primary),
        actionButton("config_modal:autorole_reaction_remove", "Remover reação", "<:ui_trashcan:1560327162979029023>", ButtonStyle.Danger),
        actionButton("config_modal:autorole_note", "Ajuda", "<:info:1561478835877453945>")
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
        "<:lock:1561418439879565404>",
        "Tranque canais e categorias rapidamente. Administradores continuam com acesso pelo bypass do Discord."
    );

    addText(container, `${config.active ? "<:botao_off:1557820521088024696> **LOCKDOWN ATIVO**" : "<:botao_on:1557820524305064056> **Lockdown inativo**"}\n-# Sistema ${config.enabled ? "ativado" : "desativado"}`);

    addRow(
        container,
        toggleButton("config_lockdown:enabled", config.enabled, "Sistema"),
        actionButton("config_lockdown:lock", "Trancar", "<:lock:1561418439879565404>", ButtonStyle.Danger).setDisabled(!config.enabled || config.active),
        actionButton("config_lockdown:unlock", "Destrancar", "<:unlock:1561421260372582490>", ButtonStyle.Success).setDisabled(!config.active)
    );

    addSep(container);
    addText(container, [
        `**<:ui_textc:1560327137024544808> Canais**\n${list(config.channel_ids)}`,
        `**<:ui_dir:1560326823894712370> Categorias**\n${list(config.category_ids)}`,
        `**<:ui_check:1560326782610047098> Acesso permitido**\n${roleList(config.allowed_role_ids)}`,
        `**<:ui_dnd:1560326836230295663> Acesso negado**\n${roleList(config.denied_role_ids)}`
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

    addNav(container, [actionButton("config_stats:update", "Atualizar agora", "<a:ui_torefresh:1560327155819225178>")]);
    return finish(container);
}

async function buildAntiNuke(interaction) {
    const c = await AntiNukeRepository.get(interaction.guild.id);
    const container = card(c.enabled ? ui.COLORS.error : ui.COLORS.neutral);

    addHeader(container, "<:nuclear:1562187533721272451>", "Anti-Nuke", "Detecta e bloqueia ações destrutivas em massa.");

    addToggle(container, { id: "config_antinuke:enabled", title: "Proteção Anti-Nuke", description: c.enabled ? "Proteção ativa." : "Proteção desativada.", enabled: !!c.enabled });

    addSep(container);
    addText(container, [
        `<:clock:1561426917717053530> **Janela de detecção:** ${c.window_seconds}s`,
        `<:ui_textc:1560327137024544808> **Canais:** ${c.channel_limit}`,
        `<:cargo:1562189000544882808> **Cargos:** ${c.role_limit}`,
        `<:ui_hammer:1560326916345700407> **Bans/Kicks:** ${c.member_limit}`,
        `<:ui_settings:1560327092078645258> **Ação:** ${c.action === "ban" ? "Banir + remover cargos" : "Remover cargos"}`
    ].join("\n"));

    addRow(container, actionButton("config_modal:antinuke", "Configurar limites", "<:ui_settings:1560327092078645258>"));

    addNav(container);
    return finish(container);
}

async function buildVoiceRec(interaction) {
    const guild = interaction.guild;
    const c = await VoiceRecordingRepository.get(guild.id);
    const apiReady = RecordingApi.isConfigured();
    const container = card(stateColor(c.enabled));

    addHeader(container, "<:ui_mic:1560326973673316403>", "Gravação de calls", "Grave calls, transcreva com IA e controle quem pode gravar. Use /voicepanel dentro de um canal de voz.");

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

    addHeader(container, "<:ui_voicec:1560327180486058107>", "TempVoice", "Salas de voz temporárias criadas e removidas automaticamente.");

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
        actionButton("config_tempvoice:autocreate", "Criar estrutura", "<:ui_wrench:1560327206969024613>", ButtonStyle.Primary),
        actionButton("config_tempvoice:name", "Nome", "<:ui_title:1560327153088860200>"),
        actionButton("config_tempvoice:limit", "Limite", "<:ui_users:1560327175826313336>"),
        toggleButton("config_tempvoice:autolock", !!c.auto_lock, "Auto-lock")
    );

    addNav(container, [actionButton("config_tempvoice:permissions_page", "Permissões", "<:shield:1561427396719284334>")]);
    return finish(container);
}

async function buildTempVoicePermissions(interaction) {
    const c = await TempVoiceRepository.get(interaction.guild.id);
    const managerRole = c.manager_role_id ? interaction.guild.roles.cache.get(c.manager_role_id) : null;
    const container = card(stateColor(c.enabled));

    addHeader(container, "<:shield:1561427396719284334>", "TempVoice • Permissões", "Quem administra as salas e o que o dono da sala pode fazer.");

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
        actionButton("config_tempvoice:permissions", "Permissões do dono", "<:lock:1561418439879565404>"),
        actionButton("config_tempvoice:permissions2", "Mais permissões", "<:ui_wrench:1560327206969024613>")
    );

    addSep(container);
    addRow(
        container,
        actionButton("config_tempvoice:permissions_back", "Voltar ao TempVoice", "<:ui_arrowl:1560326702721146890>"),
        actionButton("config_close", "Fechar", "<:ui_cancel:1560326759059030188>️", ButtonStyle.Danger)
    );
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
