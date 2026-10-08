const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    AttachmentBuilder,
    MessageFlags
} = require("discord.js");

const ConfigPanelManager = require("../../managers/ConfigPanelManager");
const GuildRepository = require("../../database/repositories/GuildRepository");
const AutomodRepository = require("../../database/repositories/AutomodRepository");
const WelcomeRepository = require("../../database/repositories/WelcomeRepository");
const TicketRepository = require("../../database/repositories/TicketRepository");
const AutoroleRepository = require("../../database/repositories/AutoroleRepository");
const ui = require("../../utils/ui");
const { CATEGORIES } = require("../../managers/LogCategories");
const WelcomeCardManager = require("../../managers/WelcomeCardManager");
const { validateHttpUrl } = require("../../utils/safeFetch");
const ServerStatsRepository = require("../../database/repositories/ServerStatsRepository");
const ServerStatsManager = require("../../managers/ServerStatsManager");
const AntiNukeRepository = require("../../database/repositories/AntiNukeRepository");
const TempVoiceRepository = require("../../database/repositories/TempVoiceRepository");
const TempVoiceManager = require("../../managers/TempVoiceManager");

function denied(interaction) {
    return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor** para usar este painel.", "Sem permissão");
}

async function execute(interaction) {
    if (!ConfigPanelManager.permissionOk(interaction)) return denied(interaction);

    const id = interaction.customId;

    if (id === "config_home" || id === "config_refresh") {
        return interaction.update(await ConfigPanelManager.buildHome(interaction));
    }

    if (id === "config_close") {
        await interaction.deferUpdate();
        try {
            await interaction.deleteReply();
        } catch {
            try { await interaction.message?.delete(); } catch { }
        }
        return;
    }

    if (id === "config_tempvoice:permissions_page") {
        return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice_permissions"));
    }

    if (id === "config_tempvoice:permissions_back") {
        return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
    }

    if (id === "config_category") {
        const category = interaction.values[0];
        return interaction.update(await ConfigPanelManager.build(interaction, category));
    }

    if (id === "config_log_category") {
        const category = interaction.values[0];
        const enabled = !(await GuildRepository.isCategoryEnabled(interaction.guild.id, category));
        await GuildRepository.setCategoryEnabled(interaction.guild.id, category, enabled);
        const label = CATEGORIES[category]?.label || category;
        await interaction.update(await ConfigPanelManager.build(interaction, "logs"));
        return ui.respond(interaction, ui.success(`${label} foi ${enabled ? "ativada" : "desativada"}.`, "Categoria atualizada", interaction), { ephemeral: true });
    }

    if (id.startsWith("config_toggle:")) {
        const target = id.split(":")[1];
        const guildId = interaction.guild.id;

        if (target === "economy") {
            const current = await GuildRepository.isEconomyEnabled(guildId);
            await GuildRepository.setEconomyEnabled(guildId, !current);
            return interaction.update(await ConfigPanelManager.build(interaction, "general"));
        }

        if (target === "moderation") {
            const current = await GuildRepository.isModerationEnabled(guildId);
            await GuildRepository.setModerationEnabled(guildId, !current);
            return interaction.update(await ConfigPanelManager.build(interaction, "general"));
        }

        if (target === "levelup") {
            const settings = await GuildRepository.getSettings(guildId);
            await GuildRepository.update(guildId, { levelup_enabled: settings.levelup_enabled ? 0 : 1 });
            return interaction.update(await ConfigPanelManager.build(interaction, "general"));
        }

        if (target === "automod") {
            const current = await AutomodRepository.get(guildId);
            await AutomodRepository.update(guildId, { enabled: current.enabled ? 0 : 1 });
            return interaction.update(await ConfigPanelManager.build(interaction, "automod"));
        }

        if (target === "welcome") {
            const current = await WelcomeRepository.get(guildId);
            await WelcomeRepository.update(guildId, { enabled: current.enabled ? 0 : 1 });
            return interaction.update(await ConfigPanelManager.build(interaction, "welcome"));
        }

        if (target === "tickets") {
            const current = await TicketRepository.getConfig(guildId);
            await TicketRepository.setConfig(guildId, { enabled: current.enabled ? 0 : 1 });
            return interaction.update(await ConfigPanelManager.build(interaction, "tickets"));
        }

        if (target === "stats") {
            const c = await ServerStatsRepository.get(guildId);
            await ServerStatsRepository.setEnabled(guildId, !c.enabled);
            const updated = await ServerStatsRepository.get(guildId);
            if (updated.enabled) await ServerStatsManager.enable(interaction.guild);
            else await ServerStatsManager.disable(interaction.guild, { remove: true });
            return interaction.update(await ConfigPanelManager.build(interaction, "stats"));
        }

        if (target === "antinuke") {
            const c = await AntiNukeRepository.get(guildId);
            await AntiNukeRepository.setEnabled(guildId, !c.enabled);
            return interaction.update(await ConfigPanelManager.build(interaction, "antinuke"));
        }

        const automodFields = new Set(["spam", "emoji", "swear", "mention", "invite", "raid", "image"]);
        if (automodFields.has(target)) {
            const current = await AutomodRepository.get(guildId);
            const field = `${target}_enabled`;
            await AutomodRepository.update(guildId, { [field]: current[field] ? 0 : 1 });
            return interaction.update(await ConfigPanelManager.build(interaction, "automod"));
        }
    }

    if (id.startsWith("config_tempvoice:")) {
        const target = id.split(":")[1];
        const guildId = interaction.guild.id;
        const c = await TempVoiceRepository.get(guildId);

        if (target === "enabled") {
            if (!c.enabled) {
                if (!c.trigger_channel_id) return ui.caution(interaction, "Escolha primeiro o canal em que o membro entra para criar a sala.", "TempVoice");
                await TempVoiceManager.configure(interaction.guild, { enabled: true });
            } else {
                await TempVoiceManager.configure(interaction.guild, { enabled: false });
            }
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
        }
        if (target === "autolock") {
            await TempVoiceManager.configure(interaction.guild, { auto_lock: !c.auto_lock });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
        }
        if (target === "admin") {
            await TempVoiceManager.configure(interaction.guild, { admin_manage: !c.admin_manage });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice_permissions"));
        }
        if (target === "trigger") {
            const channel = interaction.channels.first();
            if (!channel || channel.type !== 2) return ui.fail(interaction, "Selecione um canal de voz válido.", "Canal inválido");
            await TempVoiceManager.configure(interaction.guild, { trigger_channel_id: channel.id, enabled: true });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
        }
        if (target === "category") {
            const channel = interaction.channels.first();
            if (!channel || channel.type !== 4) return ui.fail(interaction, "Selecione uma categoria válida.", "Categoria inválida");
            await TempVoiceManager.configure(interaction.guild, { category_id: channel.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
        }
        if (target === "role") {
            const role = interaction.roles.first();
            if (!role || role.managed || role.id === interaction.guild.id) return ui.fail(interaction, "Selecione um cargo normal e não gerenciado.", "Cargo inválido");
            const me = interaction.guild.members.me;
            if (me?.roles?.highest && role.position >= me.roles.highest.position) return ui.fail(interaction, "A Nina não consegue usar esse cargo por causa da hierarquia.", "Hierarquia inválida");
            await TempVoiceManager.configure(interaction.guild, { manager_role_id: role.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice_permissions"));
        }
        if (target === "autocreate") {
            const result = await TempVoiceManager.setup(interaction.guild, { categoryId: c.category_id, triggerChannelId: c.trigger_channel_id, panelChannelId: c.panel_channel_id });
            await TempVoiceManager.configure(interaction.guild, { enabled: true, category_id: result.category.id, trigger_channel_id: result.trigger.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "tempvoice"));
        }
        if (target === "name") {
            const modal = new ModalBuilder().setCustomId("config_submit:tempvoice_name").setTitle("Nome das salas");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Nome da sala").setPlaceholder("Ex.: 🔊 {user} | {username} | Sala de {user}").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90).setValue(c.name_template))
            );
            return interaction.showModal(modal);
        }
        if (target === "limit") {
            const modal = new ModalBuilder().setCustomId("config_submit:tempvoice_limit").setTitle("Limite padrão");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("limite").setLabel("Limite de membros (0 a 99)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.default_limit))));
            return interaction.showModal(modal);
        }
        if (target === "permissions") {
            const modal = new ModalBuilder().setCustomId("config_submit:tempvoice_permissions").setTitle("Permissões do dono");
            const labels = [["renomear","Renomear sala (on/off)",c.owner_rename],["bloquear","Bloquear sala (on/off)",c.owner_lock],["limite","Alterar limite (on/off)",c.owner_limit],["expulsar","Expulsar membros (on/off)",c.owner_kick],["transferir","Transferir dono (on/off)",c.owner_transfer]];
            modal.addComponents(...labels.map(([id,label,value]) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setValue(value ? "on" : "off"))));
            return interaction.showModal(modal);
        }
        if (target === "permissions2") {
            const modal = new ModalBuilder().setCustomId("config_submit:tempvoice_permissions2").setTitle("Mais permissões");
            const labels = [["banir","Bloquear membros (on/off)",c.owner_ban],["excluir","Excluir sala (on/off)",c.owner_delete]];
            modal.addComponents(...labels.map(([id,label,value]) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setValue(value ? "on" : "off"))));
            return interaction.showModal(modal);
        }
    }

    if (id.startsWith("config_stats:")) {
        const target = id.split(":")[1];
        const guildId = interaction.guild.id;
        if (target === "enabled") {
            const c = await ServerStatsRepository.get(guildId);
            if (c.enabled) await ServerStatsManager.disable(interaction.guild, { remove: true });
            else await ServerStatsManager.enable(interaction.guild);
            return interaction.update(await ConfigPanelManager.build(interaction, "stats"));
        }
        if (target === "update") {
            await ServerStatsManager.updateGuild(interaction.guild);
            return interaction.update(await ConfigPanelManager.build(interaction, "stats"));
        }
        const c = await ServerStatsRepository.get(guildId);
        const key = `${target}_enabled`;
        if (!(key in c)) return ui.caution(interaction, "Contador inválido.", "Stats");
        await ServerStatsRepository.setCounter(guildId, target, !c[key]);
        if (c.enabled) await ServerStatsManager.updateGuild(interaction.guild);
        return interaction.update(await ConfigPanelManager.build(interaction, "stats"));
    }

    if (id.startsWith("config_antinuke:")) {
        const target = id.split(":")[1];
        if (target === "enabled") {
            const c = await AntiNukeRepository.get(interaction.guild.id);
            await AntiNukeRepository.setEnabled(interaction.guild.id, !c.enabled);
            return interaction.update(await ConfigPanelManager.build(interaction, "antinuke"));
        }
    }

    if (id.startsWith("config_channel:")) {
        const target = id.split(":")[1];
        const channel = interaction.channels.first();
        if (!channel) return ui.fail(interaction, "Não consegui identificar o canal selecionado.", "Canal inválido");

        if (target === "welcome") {
            await WelcomeRepository.update(interaction.guild.id, { channel_id: channel.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "welcome"));
        }

        if (target === "tickets") {
            await TicketRepository.setConfig(interaction.guild.id, { parent_channel_id: channel.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "tickets"));
        }

        if (target === "logs") {
            await GuildRepository.setLogChannel({ guildId: interaction.guild.id, channelId: channel.id });
            return interaction.update(await ConfigPanelManager.build(interaction, "logs"));
        }
    }

    if (id === "config_role:tickets") {
        const role = interaction.roles.first();
        if (!role) return ui.fail(interaction, "Não consegui identificar o cargo selecionado.", "Cargo inválido");
        await TicketRepository.setConfig(interaction.guild.id, { support_role_id: role.id });
        return interaction.update(await ConfigPanelManager.build(interaction, "tickets"));
    }

    if (id === "config_role:autorole_join") {
        const role = interaction.roles.first();
        if (!role || role.managed || role.id === interaction.guild.id) return ui.fail(interaction, "Esse cargo não pode ser usado como autorole.", "Cargo inválido");
        const me = interaction.guild.members.me;
        if (me?.roles?.highest && role.position >= me.roles.highest.position) return ui.fail(interaction, "A Nina não consegue atribuir esse cargo porque ele está acima ou no mesmo nível do cargo dela.", "Hierarquia inválida");
        await AutoroleRepository.addJoinRole(interaction.guild.id, role.id);
        return interaction.update(await ConfigPanelManager.build(interaction, "autorole"));
    }

    if (id === "config_clear:welcome_background") {
        await WelcomeRepository.update(interaction.guild.id, { background_url: null });
        return interaction.update(await ConfigPanelManager.build(interaction, "welcome"));
    }

    if (id === "config_welcome_test") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const config = await WelcomeRepository.get(interaction.guild.id);
            const member = interaction.member;
            const buffer = await WelcomeCardManager.gerarCartao(member, config);
            const anexo = new AttachmentBuilder(buffer, { name: "boas-vindas.png" });
            const conteudo = WelcomeCardManager.aplicarVariaveis(config.message_content, { member });

            return interaction.editReply({
                content: `🧪 **Pré-visualização** (nada foi enviado ao canal de boas-vindas)\n${conteudo}`.slice(0, 2000),
                files: [anexo],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error("[Config] Falha ao gerar teste de boas-vindas:", error);
            return interaction.editReply({ content: "Não consegui gerar a pré-visualização agora. Tente novamente em instantes." });
        }
    }

    if (id.startsWith("config_modal:")) {
        const type = id.split(":")[1];

        if (type === "tempvoice_name") {
        const value = interaction.fields.getTextInputValue("nome").trim();
        if (!value) return ui.caution(interaction, "O nome não pode ficar vazio.", "Nome inválido");
        await TempVoiceManager.configure(interaction.guild, { name_template: value });
        return ui.respond(interaction, ui.success("O formato do nome das novas salas foi atualizado.", "TempVoice atualizado", interaction), { ephemeral: true });
    }

    if (type === "tempvoice_limit") {
        const value = Number.parseInt(interaction.fields.getTextInputValue("limite"), 10);
        if (!Number.isInteger(value) || value < 0 || value > 99) return ui.caution(interaction, "O limite precisa ficar entre 0 e 99.", "Valor inválido");
        await TempVoiceManager.configure(interaction.guild, { default_limit: value });
        return ui.respond(interaction, ui.success("O limite padrão das novas salas foi atualizado.", "TempVoice atualizado", interaction), { ephemeral: true });
    }

    if (type === "tempvoice_permissions") {
        const read = id => interaction.fields.getTextInputValue(id).trim().toLowerCase() === "on";
        await TempVoiceManager.configure(interaction.guild, {
            owner_rename: read("renomear"), owner_lock: read("bloquear"), owner_limit: read("limite"),
            owner_kick: read("expulsar"), owner_transfer: read("transferir")
        });
        return ui.respond(interaction, ui.success("As permissões principais do dono foram atualizadas.", "TempVoice atualizado", interaction), { ephemeral: true });
    }

    if (type === "tempvoice_permissions2") {
        const read = id => interaction.fields.getTextInputValue(id).trim().toLowerCase() === "on";
        await TempVoiceManager.configure(interaction.guild, { owner_ban: read("banir"), owner_delete: read("excluir") });
        return ui.respond(interaction, ui.success("As permissões avançadas do dono foram atualizadas.", "TempVoice atualizado", interaction), { ephemeral: true });
    }

    if (type === "automod_spam") {
            const c = await AutomodRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:automod_spam").setTitle("Configurar Spam");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("maximo").setLabel("Máximo de mensagens").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.spam_max_messages))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("intervalo").setLabel("Intervalo em segundos").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.spam_interval_seconds)))
            );
            return interaction.showModal(modal);
        }

        if (type === "automod_raid") {
            const c = await AutomodRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:automod_raid").setTitle("Configurar Anti-Raid");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("entradas").setLabel("Entradas para disparar").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.raid_join_threshold))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("intervalo").setLabel("Janela em segundos").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.raid_interval_seconds)))
            );
            return interaction.showModal(modal);
        }

        if (type === "automod_image") {
            const c = await AutomodRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:automod_image").setTitle("Configurar Anti-Scam");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("threshold").setLabel("Confiança mínima (0.00 a 1.00)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.image_threshold))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("acao").setLabel("Ação: ignore, delete, warn, kick ou ban").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.image_action)))
            );
            return interaction.showModal(modal);
        }

        if (type === "antinuke") {
            const c = await AntiNukeRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:antinuke").setTitle("Configurar Anti-Nuke");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("janela").setLabel("Janela (5 a 60 segundos)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.window_seconds))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("canais").setLabel("Limite de canais (2 a 20)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.channel_limit))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cargos").setLabel("Limite de cargos (2 a 20)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.role_limit))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("membros").setLabel("Limite de bans/kicks (2 a 20)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.member_limit))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("acao").setLabel("Ação: ban ou strip").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(c.action)))
            );
            return interaction.showModal(modal);
        }

        if (type === "antinuke") {
        const janela = Number.parseInt(interaction.fields.getTextInputValue("janela"), 10);
        const canais = Number.parseInt(interaction.fields.getTextInputValue("canais"), 10);
        const cargos = Number.parseInt(interaction.fields.getTextInputValue("cargos"), 10);
        const membros = Number.parseInt(interaction.fields.getTextInputValue("membros"), 10);
        const acao = interaction.fields.getTextInputValue("acao").trim().toLowerCase();
        if (!Number.isInteger(janela) || janela < 5 || janela > 60 || !Number.isInteger(canais) || canais < 2 || canais > 20 || !Number.isInteger(cargos) || cargos < 2 || cargos > 20 || !Number.isInteger(membros) || membros < 2 || membros > 20 || !["ban", "strip"].includes(acao)) {
            return ui.caution(interaction, "Confira os limites e use ação `ban` ou `strip`.", "Valores inválidos");
        }
        await AntiNukeRepository.update(guildId, { window_seconds: janela, channel_limit: canais, role_limit: cargos, member_limit: membros, action: acao });
        return ui.respond(interaction, ui.success("Os limites do Anti-Nuke foram atualizados.", "Anti-Nuke atualizado", interaction), { ephemeral: true });
    }

    if (type === "welcome_background") {
            const c = await WelcomeRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:welcome_background").setTitle("Imagem de fundo");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("url").setLabel("URL da imagem").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1000).setValue(String(c.background_url || "").slice(0, 1000)).setPlaceholder("https://exemplo.com/imagem.png"))
            );
            return interaction.showModal(modal);
        }

        if (type === "autorole_selfrole") {
            const modal = new ModalBuilder().setCustomId("config_submit:autorole_selfrole").setTitle("Adicionar self-role");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cargo").setLabel("ID do cargo").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("label").setLabel("Texto do botão").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("emoji").setLabel("Emoji (opcional)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            return interaction.showModal(modal);
        }

        if (type === "autorole_level") {
            const modal = new ModalBuilder().setCustomId("config_submit:autorole_level").setTitle("Cargo por nível");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nivel").setLabel("Nível").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cargo").setLabel("ID do cargo").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (type === "welcome_text") {
            const c = await WelcomeRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:welcome_text").setTitle("Editar boas-vindas");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("titulo").setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(255).setValue(String(c.title_text || "").slice(0, 255))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mensagem").setLabel("Mensagem").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000).setValue(String(c.message_content || "").slice(0, 2000)))
            );
            return interaction.showModal(modal);
        }

        if (type === "autorole_note") {
            return ui.respond(interaction, ui.info("Para configurações detalhadas de cargos de entrada, self-roles e recompensas por nível, os comandos `/autorole` continuam disponíveis nesta primeira versão do painel.", "Autoroles", interaction), { ephemeral: true });
        }
    }
    // Nenhum handler reconheceu a ação (painel antigo/desatualizado): responde em vez de deixar "interação falhou".
    if (!interaction.replied && !interaction.deferred) {
        return ui.caution(interaction, "Essa opção não está mais disponível. Abra o painel novamente com `/config`.", "Painel desatualizado");
    }
}

async function modal(interaction) {
    if (!ConfigPanelManager.permissionOk(interaction)) return denied(interaction);

    const type = interaction.customId.split(":")[1];
    const guildId = interaction.guild.id;

    if (type === "automod_spam") {
        const maximo = Number.parseInt(interaction.fields.getTextInputValue("maximo"), 10);
        const intervalo = Number.parseInt(interaction.fields.getTextInputValue("intervalo"), 10);
        if (!Number.isInteger(maximo) || !Number.isInteger(intervalo) || maximo < 2 || intervalo < 1) return ui.caution(interaction, "Use números válidos (mínimo 2 mensagens e 1 segundo).", "Valores inválidos");
        await AutomodRepository.update(guildId, { spam_max_messages: maximo, spam_interval_seconds: intervalo });
        return ui.respond(interaction, ui.success("Os limites de spam foram atualizados.", "AutoMod atualizado", interaction), { ephemeral: true });
    }

    if (type === "automod_raid") {
        const entradas = Number.parseInt(interaction.fields.getTextInputValue("entradas"), 10);
        const intervalo = Number.parseInt(interaction.fields.getTextInputValue("intervalo"), 10);
        if (!Number.isInteger(entradas) || !Number.isInteger(intervalo) || entradas < 2 || intervalo < 5) return ui.caution(interaction, "Use números válidos (mínimo 2 entradas e janela de 5 segundos).", "Valores inválidos");
        await AutomodRepository.update(guildId, { raid_join_threshold: entradas, raid_interval_seconds: intervalo });
        return ui.respond(interaction, ui.success("Os limites do Anti-Raid foram atualizados.", "Auto-Raid atualizado", interaction), { ephemeral: true });
    }

    if (type === "automod_image") {
        const threshold = Number.parseFloat(interaction.fields.getTextInputValue("threshold").replace(",", "."));
        const action = interaction.fields.getTextInputValue("acao").trim().toLowerCase();
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !["ignore", "delete", "warn", "kick", "ban"].includes(action)) return ui.caution(interaction, "Confiança deve ficar entre 0 e 1 e a ação precisa ser ignore, delete, warn, kick ou ban.", "Valores inválidos");
        await AutomodRepository.update(guildId, { image_threshold: threshold, image_action: action });
        return ui.respond(interaction, ui.success("A configuração do Anti-Scam visual foi atualizada.", "Anti-Scam atualizado", interaction), { ephemeral: true });
    }

    if (type === "antinuke") {
        const janela = Number.parseInt(interaction.fields.getTextInputValue("janela"), 10);
        const canais = Number.parseInt(interaction.fields.getTextInputValue("canais"), 10);
        const cargos = Number.parseInt(interaction.fields.getTextInputValue("cargos"), 10);
        const membros = Number.parseInt(interaction.fields.getTextInputValue("membros"), 10);
        const acao = interaction.fields.getTextInputValue("acao").trim().toLowerCase();
        if (!Number.isInteger(janela) || janela < 5 || janela > 60 || !Number.isInteger(canais) || canais < 2 || canais > 20 || !Number.isInteger(cargos) || cargos < 2 || cargos > 20 || !Number.isInteger(membros) || membros < 2 || membros > 20 || !["ban", "strip"].includes(acao)) {
            return ui.caution(interaction, "Confira os limites e use ação `ban` ou `strip`.", "Valores inválidos");
        }
        await AntiNukeRepository.update(guildId, { window_seconds: janela, channel_limit: canais, role_limit: cargos, member_limit: membros, action: acao });
        return ui.respond(interaction, ui.success("Os limites do Anti-Nuke foram atualizados.", "Anti-Nuke atualizado", interaction), { ephemeral: true });
    }

    if (type === "welcome_background") {
        const url = interaction.fields.getTextInputValue("url").trim();
        try { validateHttpUrl(url); } catch (error) { return ui.caution(interaction, error.message, "URL inválida"); }
        await WelcomeRepository.update(guildId, { background_url: url });
        return ui.respond(interaction, ui.success("A imagem de fundo foi atualizada.", "Boas-vindas atualizadas", interaction), { ephemeral: true });
    }

    if (type === "autorole_selfrole") {
        const roleId = interaction.fields.getTextInputValue("cargo").trim();
        const role = interaction.guild.roles.cache.get(roleId);
        const label = interaction.fields.getTextInputValue("label").trim();
        const emoji = interaction.fields.getTextInputValue("emoji").trim() || null;
        if (!role || role.managed || role.id === interaction.guild.id) return ui.caution(interaction, "ID de cargo inválido ou cargo gerenciado.", "Cargo inválido");
        const me = interaction.guild.members.me;
        if (me?.roles?.highest && role.position >= me.roles.highest.position) return ui.caution(interaction, "A Nina não consegue atribuir esse cargo por causa da hierarquia.", "Hierarquia inválida");
        const current = await AutoroleRepository.listSelfRoles(guildId);
        if (current.length >= 25) return ui.caution(interaction, "O painel de self-role aceita no máximo 25 cargos.", "Limite atingido");
        await AutoroleRepository.addSelfRole(guildId, role.id, label, emoji);
        return ui.respond(interaction, ui.success(`${role} foi adicionado aos self-roles.`, "Self-role atualizado", interaction), { ephemeral: true });
    }

    if (type === "autorole_level") {
        const nivel = Number.parseInt(interaction.fields.getTextInputValue("nivel"), 10);
        const roleId = interaction.fields.getTextInputValue("cargo").trim();
        const role = interaction.guild.roles.cache.get(roleId);
        if (!Number.isInteger(nivel) || nivel < 1 || !role || role.managed || role.id === interaction.guild.id) return ui.caution(interaction, "Informe um nível válido e um ID de cargo válido.", "Valores inválidos");
        const me = interaction.guild.members.me;
        if (me?.roles?.highest && role.position >= me.roles.highest.position) return ui.caution(interaction, "A Nina não consegue atribuir esse cargo por causa da hierarquia.", "Hierarquia inválida");
        await AutoroleRepository.setLevelRole(guildId, nivel, role.id);
        return ui.respond(interaction, ui.success(`${role} agora é recompensa do nível ${nivel}.`, "Level-role atualizado", interaction), { ephemeral: true });
    }

    if (type === "welcome_text") {
        const titulo = interaction.fields.getTextInputValue("titulo").trim();
        const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
        if (!titulo || !mensagem) return ui.caution(interaction, "Título e mensagem não podem ficar vazios.", "Texto inválido");
        if (titulo.length > 255 || mensagem.length > 2000) return ui.caution(interaction, "Título até 255 caracteres e mensagem até 2000.", "Texto longo demais");
        await WelcomeRepository.update(guildId, { title_text: titulo, message_content: mensagem });
        return ui.respond(interaction, ui.success("Os textos de boas-vindas foram atualizados.", "Boas-vindas atualizadas", interaction), { ephemeral: true });
    }
}

module.exports = { execute, modal };
