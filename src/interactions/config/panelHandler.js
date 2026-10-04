const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const ConfigPanelManager = require("../../managers/ConfigPanelManager");
const GuildRepository = require("../../database/repositories/GuildRepository");
const AutomodRepository = require("../../database/repositories/AutomodRepository");
const WelcomeRepository = require("../../database/repositories/WelcomeRepository");
const TicketRepository = require("../../database/repositories/TicketRepository");
const ui = require("../../utils/ui");
const { CATEGORIES } = require("../../managers/LogCategories");

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
        return interaction.update({ embeds: [], components: [] });
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

    if (id.startsWith("config_modal:")) {
        const type = id.split(":")[1];

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

        if (type === "welcome_text") {
            const c = await WelcomeRepository.get(interaction.guild.id);
            const modal = new ModalBuilder().setCustomId("config_submit:welcome_text").setTitle("Editar boas-vindas");
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("titulo").setLabel("Título").setStyle(TextInputStyle.Short).setRequired(true).setValue(c.title_text)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mensagem").setLabel("Mensagem").setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(c.message_content))
            );
            return interaction.showModal(modal);
        }

        if (type === "autorole_note") {
            return ui.respond(interaction, ui.info("Para configurações detalhadas de cargos de entrada, self-roles e recompensas por nível, os comandos `/autorole` continuam disponíveis nesta primeira versão do painel.", "Autoroles", interaction), { ephemeral: true });
        }
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

    if (type === "welcome_text") {
        const titulo = interaction.fields.getTextInputValue("titulo").trim();
        const mensagem = interaction.fields.getTextInputValue("mensagem").trim();
        if (!titulo || !mensagem) return ui.caution(interaction, "Título e mensagem não podem ficar vazios.", "Texto inválido");
        await WelcomeRepository.update(guildId, { title_text: titulo, message_content: mensagem });
        return ui.respond(interaction, ui.success("Os textos de boas-vindas foram atualizados.", "Boas-vindas atualizadas", interaction), { ephemeral: true });
    }
}

module.exports = { execute, modal };
