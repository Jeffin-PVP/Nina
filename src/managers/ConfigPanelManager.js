const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType
} = require("discord.js");

const ui = require("../utils/ui");
const GuildRepository = require("../database/repositories/GuildRepository");
const AutomodRepository = require("../database/repositories/AutomodRepository");
const WelcomeRepository = require("../database/repositories/WelcomeRepository");
const TicketRepository = require("../database/repositories/TicketRepository");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const ServerStatsRepository = require("../database/repositories/ServerStatsRepository");
const AntiNukeRepository = require("../database/repositories/AntiNukeRepository");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");
const TempVoiceManager = require("./TempVoiceManager");
const { CATEGORIES } = require("./LogCategories");

const CATEGORY_OPTIONS = [
    { value: "general", label: "Geral", description: "Economia, moderação e níveis", emoji: "⚙️" },
    { value: "automod", label: "AutoMod", description: "Proteção automática do servidor", emoji: "🤖" },
    { value: "welcome", label: "Boas-vindas", description: "Mensagem e canal de entrada", emoji: "👋" },
    { value: "tickets", label: "Tickets", description: "Suporte e atendimento", emoji: "🎫" },
    { value: "logs", label: "Logs", description: "Registros e auditoria", emoji: "📜" },
    { value: "autorole", label: "Autoroles", description: "Cargos automáticos e níveis", emoji: "🎭" },
    { value: "stats", label: "Stats", description: "Contadores do servidor", emoji: "📊" },
    { value: "antinuke", label: "Anti-Nuke", description: "Proteção contra ataques destrutivos", emoji: "☢️" },
    { value: "tempvoice", label: "TempVoice", description: "Salas de voz temporárias", emoji: "🔊" }
];

function permissionOk(interaction) {
    return interaction.memberPermissions?.has("ManageGuild");
}

function mainComponents() {
    const select = new StringSelectMenuBuilder()
        .setCustomId("config_category")
        .setPlaceholder("Escolha uma área para configurar")
        .addOptions(CATEGORY_OPTIONS.map(o => ({
            label: o.label,
            value: o.value,
            description: o.description,
            emoji: o.emoji
        })));

    return [
        new ActionRowBuilder().addComponents(select),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("config_refresh").setLabel("Atualizar").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji("✖️").setStyle(ButtonStyle.Danger)
        )
    ];
}

function backRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("config_home").setLabel("Voltar").setEmoji("◀️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_close").setLabel("Fechar").setEmoji("✖️").setStyle(ButtonStyle.Danger)
    );
}

function toggleButton(id, enabled, label = "") {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label ? `${label}: ${enabled ? "ON" : "OFF"}` : (enabled ? "ON" : "OFF"))
        .setEmoji(enabled ? "🟢" : "🔴")
        .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger);
}

async function buildHome(interaction) {
    const settings = await GuildRepository.getSettings(interaction.guild.id);
    const automod = await AutomodRepository.get(interaction.guild.id);
    const welcome = await WelcomeRepository.get(interaction.guild.id);
    const tickets = await TicketRepository.getConfig(interaction.guild.id);
    const stats = await ServerStatsRepository.get(interaction.guild.id);
    const antinuke = await AntiNukeRepository.get(interaction.guild.id);

    const configured = [
        ["🤖 AutoMod", automod.enabled],
        ["👋 Boas-vindas", welcome.enabled],
        ["🎫 Tickets", tickets.enabled && !!tickets.parent_channel_id],
        ["📜 Logs", !!settings.log_channel],
        ["💰 Economia", settings.economy_enabled],
        ["🛡️ Moderação", settings.moderation_enabled],
        ["📊 Stats", stats.enabled],
        ["☢️ Anti-Nuke", antinuke.enabled],
        ["🔊 TempVoice", (await TempVoiceRepository.get(interaction.guild.id)).enabled]
    ];

    const status = configured.map(([name, enabled]) => `${enabled ? "🟢" : "🔴"} ${name}`).join("\n");

    return {
        embeds: [ui.panel({
            color: ui.COLORS.brand,
            emoji: "config",
            title: "Configuração da Nina",
            description: `Configure os sistemas de **${interaction.guild.name}** sem precisar decorar vários comandos.\n\nSelecione uma categoria abaixo para começar.`,
            thumbnail: interaction.guild.iconURL({ size: 256 }),
            fields: [
                ui.field("config", "Sistemas", status, false),
                ui.field("info", "Permissão", "Gerenciar Servidor", false)
            ],
            footer: "Os comandos antigos continuam disponíveis durante a migração.",
            source: interaction
        })],
        components: mainComponents()
    };
}

async function buildGeneral(interaction) {
    const s = await GuildRepository.getSettings(interaction.guild.id);
    const row1 = new ActionRowBuilder().addComponents(
        toggleButton("config_toggle:economy", !!s.economy_enabled),
        toggleButton("config_toggle:moderation", !!s.moderation_enabled),
        toggleButton("config_toggle:levelup", !!s.levelup_enabled)
    );
    row1.components[0].setLabel(`Economia: ${s.economy_enabled ? "ON" : "OFF"}`);
    row1.components[1].setLabel(`Moderação: ${s.moderation_enabled ? "ON" : "OFF"}`);
    row1.components[2].setLabel(`Level-up: ${s.levelup_enabled ? "ON" : "OFF"}`);

    return {
        embeds: [ui.panel({
            color: ui.COLORS.info,
            emoji: "config",
            title: "Configuração geral",
            description: "Ative ou desative os principais sistemas do servidor.",
            fields: [
                ui.field("coin", "Economia", ui.toggle(s.economy_enabled)),
                ui.field("shield", "Moderação", ui.toggle(s.moderation_enabled)),
                ui.field("star", "Avisos de level-up", ui.toggle(s.levelup_enabled)),
                ui.field("log", "Canal de logs", s.log_channel ? `<#${s.log_channel}>` : "Não configurado", false)
            ],
            source: interaction
        })],
        components: [row1, backRow()]
    };
}

async function buildAutomod(interaction) {
    const c = await AutomodRepository.get(interaction.guild.id);
    const rules = [
        ["🚨 Spam", c.spam_enabled],
        ["😀 Emojis", c.emoji_enabled],
        ["🤬 Palavrões", c.swear_enabled],
        ["📢 Menções", c.mention_enabled],
        ["🔗 Convites", c.invite_enabled],
        ["🛑 Anti-Raid", c.raid_enabled],
        ["🖼️ Anti-Scam", c.image_enabled]
    ];

    const rows = [
        new ActionRowBuilder().addComponents(toggleButton("config_toggle:automod", !!c.enabled).setLabel(c.enabled ? "AutoMod: ON" : "AutoMod: OFF")),
        new ActionRowBuilder().addComponents(
            toggleButton("config_toggle:spam", !!c.spam_enabled).setLabel(`Spam: ${c.spam_enabled ? "ON" : "OFF"}`),
            toggleButton("config_toggle:emoji", !!c.emoji_enabled).setLabel(`Emojis: ${c.emoji_enabled ? "ON" : "OFF"}`),
            toggleButton("config_toggle:swear", !!c.swear_enabled).setLabel(`Palavrões: ${c.swear_enabled ? "ON" : "OFF"}`)
        ),
        new ActionRowBuilder().addComponents(
            toggleButton("config_toggle:mention", !!c.mention_enabled).setLabel(`Menções: ${c.mention_enabled ? "ON" : "OFF"}`),
            toggleButton("config_toggle:invite", !!c.invite_enabled).setLabel(`Convites: ${c.invite_enabled ? "ON" : "OFF"}`),
            toggleButton("config_toggle:raid", !!c.raid_enabled).setLabel(`Anti-Raid: ${c.raid_enabled ? "ON" : "OFF"}`)
        ),
        new ActionRowBuilder().addComponents(
            toggleButton("config_toggle:image", !!c.image_enabled).setLabel(`Anti-Scam: ${c.image_enabled ? "ON" : "OFF"}`),
            new ButtonBuilder().setCustomId("config_modal:automod_spam").setLabel("Limites do Spam").setEmoji("🚨").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("config_modal:automod_raid").setLabel("Limites do Raid").setEmoji("🛑").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("config_modal:automod_image").setLabel("Config. Anti-Scam").setEmoji("🖼️").setStyle(ButtonStyle.Secondary)
        ),
        backRow()
    ];

    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "shield",
            title: "AutoMod",
            description: "Proteção automática contra spam, convites, menções, raid e outros abusos.",
            fields: [
                ui.field("shield", "Status", ui.toggle(c.enabled)),
                ui.field("warn", "Regras", rules.map(([n, v]) => `${v ? "🟢" : "🔴"} ${n}`).join("\n"), false),
                ui.field("timeout", "Mute", `${c.mute_duration_minutes} minuto(s)`)
            ],
            source: interaction
        })],
        components: rows
    };
}

async function buildWelcome(interaction) {
    const c = await WelcomeRepository.get(interaction.guild.id);
    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "sparkle",
            title: "Boas-vindas",
            description: "Configure o sistema de entrada dos novos membros.",
            fields: [
                ui.field("config", "Status", ui.toggle(c.enabled)),
                ui.field("channel", "Canal", c.channel_id ? `<#${c.channel_id}>` : "Não configurado", false),
                ui.field("info", "Título", c.title_text),
                ui.field("log", "Mensagem", ui.clip(c.message_content, 1024), false),
                ui.field("image", "Fundo", c.background_url ? `[Ver imagem](${c.background_url})` : "Padrão (gradiente)", false)
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(toggleButton("config_toggle:welcome", !!c.enabled).setLabel(c.enabled ? "Boas-vindas: ON" : "Boas-vindas: OFF")),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId("config_channel:welcome").setPlaceholder("Escolher canal de boas-vindas").setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("config_modal:welcome_text").setLabel("Editar textos").setEmoji("📝").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("config_modal:welcome_background").setLabel("Imagem de fundo").setEmoji("🖼️").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("config_clear:welcome_background").setLabel("Remover fundo").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("config_welcome_test").setLabel("Testar").setEmoji("🧪").setStyle(ButtonStyle.Secondary)
            ),
            backRow()
        ]
    };
}

async function buildTickets(interaction) {
    const c = await TicketRepository.getConfig(interaction.guild.id);
    return {
        embeds: [ui.panel({
            color: c.enabled && c.parent_channel_id ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "ticket",
            title: "Tickets",
            description: "Configure o atendimento do servidor.",
            fields: [
                ui.field("config", "Status", ui.toggle(c.enabled && !!c.parent_channel_id)),
                ui.field("channel", "Canal dos tickets", c.parent_channel_id ? `<#${c.parent_channel_id}>` : "Não configurado"),
                ui.field("shield", "Suporte", c.support_role_id ? `<@&${c.support_role_id}>` : "Não configurado")
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(toggleButton("config_toggle:tickets", !!c.enabled).setLabel(c.enabled ? "Tickets: ON" : "Tickets: OFF")),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId("config_channel:tickets").setPlaceholder("Escolher canal dos tickets").setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId("config_role:tickets").setPlaceholder("Escolher cargo de suporte")
            ),
            backRow()
        ]
    };
}

async function buildLogs(interaction) {
    const s = await GuildRepository.getSettings(interaction.guild.id);
    const disabled = await GuildRepository.getDisabledCategories(interaction.guild.id);
    const statsLogsEnabled = await GuildRepository.isStatsLogsEnabled(interaction.guild.id);
    const categories = Object.entries(CATEGORIES).map(([key, value]) => `${disabled.includes(key) ? "🔴" : "🟢"} ${value.label}`).join("\n");

    return {
        embeds: [ui.panel({
            color: s.log_channel ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "log",
            title: "Logs",
            description: "Escolha o canal e quais eventos a Nina deve registrar.",
            fields: [
                ui.field("channel", "Canal", s.log_channel ? `<#${s.log_channel}>` : "Não configurado", false),
                ui.field("log", "Categorias", categories || "Nenhuma", false),
                ui.field("chart", "Logs dos Stats", statsLogsEnabled ? "🟢 Ativados" : "🔴 Desativados", false)
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId("config_channel:logs").setPlaceholder("Escolher canal de logs").setChannelTypes(ChannelType.GuildText)
            ),
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId("config_log_category").setPlaceholder("Ativar/desativar categoria").addOptions(
                    Object.entries(CATEGORIES).slice(0, 25).map(([key, value]) => ({ label: value.label, value: key, emoji: value.emoji }))
                )
            ),
            new ActionRowBuilder().addComponents(
                toggleButton("config_logs:stats", statsLogsEnabled, "Logs dos Stats")
            ),
            backRow()
        ]
    };
}

async function buildAutorole(interaction) {
    const guildId = interaction.guild.id;
    const [join, self, level] = await Promise.all([
        AutoroleRepository.getJoinRoles(guildId),
        AutoroleRepository.listSelfRoles(guildId),
        AutoroleRepository.listLevelRoles(guildId)
    ]);

    return {
        embeds: [ui.panel({
            color: ui.COLORS.info,
            emoji: "role",
            title: "Autoroles",
            description: "Gerencie os cargos automáticos do servidor.",
            fields: [
                ui.field("user", "Cargos de entrada", `${join.length}`),
                ui.field("role", "Self-roles", `${self.length}`),
                ui.field("star", "Cargos por nível", `${level.length}`),
                ui.field("info", "Configuração", "Cargos de entrada, self-roles e recompensas por nível podem ser gerenciados diretamente aqui.", false)
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId("config_role:autorole_join").setPlaceholder("Adicionar cargo de entrada")
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("config_modal:autorole_selfrole").setLabel("Adicionar self-role").setEmoji("🎭").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("config_modal:autorole_level").setLabel("Cargo por nível").setEmoji("⭐").setStyle(ButtonStyle.Secondary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("config_modal:autorole_note").setLabel("Comandos avançados").setEmoji("ℹ️").setStyle(ButtonStyle.Secondary)
            ),
            backRow()
        ]
    };
}


async function buildStats(interaction) {
    const c = await ServerStatsRepository.get(interaction.guild.id);
    const counters = [
        ["members", "👥 Membros"], ["bots", "🤖 Bots"], ["online", "🟢 Online"],
        ["offline", "⚫ Offline"], ["voice", "🔊 Em call"], ["channels", "💬 Canais"],
        ["categories", "📁 Categorias"], ["roles", "🎭 Cargos"], ["servers", "🌐 Servidores"]
    ];
    const rows = [];
    for (let i = 0; i < counters.length; i += 3) {
        rows.push(new ActionRowBuilder().addComponents(...counters.slice(i, i + 3).map(([key, label]) =>
            toggleButton(`config_stats:${key}`, !!c[`${key}_enabled`], label)
        )));
    }
    rows.push(new ActionRowBuilder().addComponents(
        toggleButton("config_stats:enabled", !!c.enabled, "Stats"),
        new ButtonBuilder().setCustomId("config_stats:update").setLabel("Atualizar agora").setEmoji("🔄").setStyle(ButtonStyle.Secondary)
    ));
    rows.push(backRow());
    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "chart",
            title: "Stats do servidor",
            description: "Ative os contadores que deseja exibir. A Nina cria canais de voz bloqueados e atualiza os números automaticamente.",
            fields: [
                ui.field("chart", "Status", c.enabled ? "🟢 Ativo" : "🔴 Desativado"),
                ui.field("info", "Contadores", counters.map(([key, label]) => `${c[`${key}_enabled`] ? "🟢" : "🔴"} ${label}`).join("\n"), false)
            ],
            source: interaction
        })],
        components: rows
    };
}

async function buildAntiNuke(interaction) {
    const c = await AntiNukeRepository.get(interaction.guild.id);
    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.error : ui.COLORS.neutral,
            emoji: "shield",
            title: "Anti-Nuke",
            description: c.enabled ? "🟢 Proteção ativa contra ações destrutivas em massa." : "🔴 Proteção desativada.",
            fields: [
                ui.field("clock", "Janela", `${c.window_seconds}s`),
                ui.field("channel", "Canais", `${c.channel_limit}`),
                ui.field("role", "Cargos", `${c.role_limit}`),
                ui.field("user", "Bans/Kicks", `${c.member_limit}`),
                ui.field("config", "Ação", c.action === "ban" ? "Banir + remover cargos" : "Remover cargos")
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(
                toggleButton("config_antinuke:enabled", !!c.enabled, "Anti-Nuke"),
                new ButtonBuilder().setCustomId("config_modal:antinuke").setLabel("Configurar limites").setEmoji("⚙️").setStyle(ButtonStyle.Secondary)
            ),
            backRow()
        ]
    };
}

async function buildTempVoice(interaction) {
    const c = await TempVoiceRepository.get(interaction.guild.id);
    const rooms = await TempVoiceRepository.getRooms(interaction.guild.id);
    const trigger = c.trigger_channel_id ? interaction.guild.channels.cache.get(c.trigger_channel_id) : null;
    const category = c.category_id ? interaction.guild.channels.cache.get(c.category_id) : null;
    const managerRole = c.manager_role_id ? interaction.guild.roles.cache.get(c.manager_role_id) : null;

    const nameMode = c.name_template === "🔊 {username}" ? "Nome de usuário" : c.name_template === "🔊 {user}" ? "Nome de exibição" : `Personalizado: ${c.name_template}`;
    const ownerPerms = [
        ["Renomear", c.owner_rename], ["Bloquear", c.owner_lock], ["Alterar limite", c.owner_limit],
        ["Expulsar", c.owner_kick], ["Bloquear membro", c.owner_ban], ["Transferir dono", c.owner_transfer], ["Excluir", c.owner_delete]
    ].map(([name, value]) => `${value ? "🟢" : "🔴"} ${name}`).join("\n");

    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "🔊",
            title: "TempVoice",
            description: "Configure as salas temporárias deste servidor. As alterações ficam salvas no SQLite.",
            fields: [
                ui.field("power", "Status", ui.toggle(c.enabled)),
                ui.field("channel", "Canal para criar sala", trigger ? `<#${trigger.id}>` : "Não configurado", false),
                ui.field("folder", "Categoria das salas", category ? `<#${category.id}>` : "Não configurada"),
                ui.field("edit", "Formato do nome", nameMode, false),
                ui.field("users", "Limite padrão", c.default_limit ? `${c.default_limit} membros` : "Sem limite"),
                ui.field("lock", "Bloqueio automático", ui.toggle(c.auto_lock)),
                ui.field("shield", "Admin/Moderação", `${c.admin_manage ? "🟢" : "🔴"} Gerenciar salas\n${managerRole ? `Cargo: <@&${managerRole.id}>` : "Cargo: não definido"}`, false),
                ui.field("key", "Permissões do dono", ownerPerms, false),
                ui.field("stats", "Salas ativas", `\`${rooms.length}\``)
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(
                toggleButton("config_tempvoice:enabled", !!c.enabled, "TempVoice"),
                new ButtonBuilder().setCustomId("config_tempvoice:autocreate").setLabel("Criar estrutura").setEmoji("🏗️").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("config_tempvoice:name").setLabel("Nome").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("config_tempvoice:limit").setLabel("Limite").setEmoji("👥").setStyle(ButtonStyle.Secondary),
                toggleButton("config_tempvoice:autolock", !!c.auto_lock, "Auto-lock")
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("config_tempvoice:trigger")
                    .setPlaceholder("Escolher canal de entrada")
                    .setChannelTypes(ChannelType.GuildVoice)
            ),
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("config_tempvoice:category")
                    .setPlaceholder("Escolher categoria das salas")
                    .setChannelTypes(ChannelType.GuildCategory)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("config_tempvoice:permissions_page")
                    .setLabel("Permissões e cargos")
                    .setEmoji("🛡️")
                    .setStyle(ButtonStyle.Secondary)
            ),
            backRow()
        ]
    };
}

async function buildTempVoicePermissions(interaction) {
    const c = await TempVoiceRepository.get(interaction.guild.id);
    const managerRole = c.manager_role_id ? interaction.guild.roles.cache.get(c.manager_role_id) : null;

    return {
        embeds: [ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "🛡️",
            title: "TempVoice • Permissões",
            description: "Defina quem pode administrar as salas e quais ações o dono da sala pode executar.",
            fields: [
                ui.field("shield", "Admins/Moderação", c.admin_manage ? "🟢 Ativado" : "🔴 Desativado"),
                ui.field("role", "Cargo de gerenciamento", managerRole ? `<@&${managerRole.id}>` : "Não definido"),
                ui.field("key", "Permissões do dono", [
                    ["Renomear", c.owner_rename],
                    ["Bloquear", c.owner_lock],
                    ["Alterar limite", c.owner_limit],
                    ["Expulsar", c.owner_kick],
                    ["Bloquear membro", c.owner_ban],
                    ["Transferir dono", c.owner_transfer],
                    ["Excluir", c.owner_delete]
                ].map(([name, value]) => `${value ? "🟢" : "🔴"} ${name}`).join("\n"))
            ],
            source: interaction
        })],
        components: [
            new ActionRowBuilder().addComponents(
                toggleButton("config_tempvoice:admin", !!c.admin_manage, "Admins/Moderação")
            ),
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId("config_tempvoice:role")
                    .setPlaceholder("Escolher cargo que pode gerenciar salas")
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("config_tempvoice:permissions")
                    .setLabel("Permissões do dono")
                    .setEmoji("🔐")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("config_tempvoice:permissions2")
                    .setLabel("Mais permissões")
                    .setEmoji("🛠️")
                    .setStyle(ButtonStyle.Secondary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("config_tempvoice:permissions_back")
                    .setLabel("Voltar ao TempVoice")
                    .setEmoji("◀️")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("config_close")
                    .setLabel("Fechar")
                    .setEmoji("✖️")
                    .setStyle(ButtonStyle.Danger)
            )
        ]
    };
}

async function build(interaction, category) {
    switch (category) {
        case "general": return buildGeneral(interaction);
        case "automod": return buildAutomod(interaction);
        case "welcome": return buildWelcome(interaction);
        case "tickets": return buildTickets(interaction);
        case "logs": return buildLogs(interaction);
        case "autorole": return buildAutorole(interaction);
        case "stats": return buildStats(interaction);
        case "antinuke": return buildAntiNuke(interaction);
        case "tempvoice": return buildTempVoice(interaction);
        case "tempvoice_permissions": return buildTempVoicePermissions(interaction);
        default: return buildHome(interaction);
    }
}

async function show(interaction, category = null, mode = "reply") {
    const payload = await build(interaction, category);
    if (mode === "edit") return interaction.update(payload);
    return ui.respond(interaction, payload.embeds?.[0], { ephemeral: true, components: payload.components || [] });
}

module.exports = {
    CATEGORY_OPTIONS,
    permissionOk,
    build,
    buildHome,
    show
};
