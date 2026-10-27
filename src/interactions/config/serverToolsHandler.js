const {
    PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const ConfigPanelManager = require("../../managers/ConfigPanelManager");
const VerificationManager = require("../../managers/VerificationManager");
const AccountFilterManager = require("../../managers/AccountFilterManager");
const WeeklyReportManager = require("../../managers/WeeklyReportManager");
const BackupManager = require("../../managers/BackupManager");
const ui = require("../../utils/ui");

/*
=========================
    /config — ferramentas do servidor
    Verificação · Contas novas · Backup · Relatório semanal
=========================
Os customIds seguem o padrão do painel:
  config_verif:*  config_filter:*  config_report:*  config_backup:*   (botões)
  config_sel:*                                                         (menus de texto)
  config_channel:verif_channel | filter_alert | report_channel         (menus de canal)
  config_role:verif_role | verif_unverified                            (menus de cargo)
*/

const OWNED_EXACT = new Set([
    "config_channel:verif_channel",
    "config_channel:filter_alert",
    "config_channel:report_channel",
    "config_role:verif_role",
    "config_role:verif_unverified"
]);
const OWNED_PREFIXES = ["config_verif:", "config_filter:", "config_report:", "config_backup:", "config_sel:"];

const owns = id => OWNED_EXACT.has(id) || OWNED_PREFIXES.some(prefix => id.startsWith(prefix));

const refresh = (interaction, category) =>
    ConfigPanelManager.build(interaction, category).then(payload => interaction.update(payload));

// Painéis são Components V2 (não aceitam embeds na mesma mensagem): avisos vão em mensagem separada.
const notify = (interaction, embed) =>
    interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

const needsTextPerms = (channel, me) => {
    const perms = channel.permissionsFor(me);
    return !perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks);
};
const permsMessage = channel => `Em ${channel} eu preciso de: ver o canal, enviar mensagens e incorporar links.`;

async function removeOldVerificationPanel(guild, config) {
    if (!config.message_id || !config.channel_id) return;
    const channel = guild.channels.cache.get(config.channel_id);
    const message = await channel?.messages?.fetch?.(config.message_id).catch(() => null);
    await message?.delete?.().catch(() => null);
}

/* ---------- VERIFICAÇÃO ---------- */

async function verification(interaction, id) {
    const { guild } = interaction;
    const table = VerificationManager.TABLE;
    const config = await Repo.getConfig(table, guild.id);

    if (id === "config_verif:enabled") {
        if (!config.enabled) {
            if (!config.role_id) return ui.caution(interaction, "Escolha primeiro o **cargo de verificado**.", "Cargo não configurado");
            const problem = VerificationManager.checkRoleUsable(guild, guild.roles.cache.get(config.role_id));
            if (problem) return ui.caution(interaction, problem, "Cargo inválido");
        }
        await Repo.setConfig(table, guild.id, { enabled: config.enabled ? 0 : 1 });
        return refresh(interaction, "verification");
    }

    if (id === "config_verif:panel") {
        const channel = guild.channels.cache.get(config.channel_id);
        if (!config.role_id || !channel?.isTextBased?.()) {
            return ui.caution(interaction, "Escolha o cargo de verificado e o canal do painel antes de enviar.", "Faltam configurações");
        }
        if (needsTextPerms(channel, guild.members.me)) return ui.fail(interaction, permsMessage(channel), "Faltam permissões");

        await interaction.deferUpdate();
        try {
            // O painel só funciona com a verificação ativa: enviar já ativa o sistema.
            if (!config.enabled) await Repo.setConfig(table, guild.id, { enabled: 1 });
            await VerificationManager.sendPanel(guild, await Repo.getConfig(table, guild.id), channel);
        } catch (error) {
            console.error(`[Config:Verificação:${guild.id}]`, error);
            await interaction.editReply(await ConfigPanelManager.build(interaction, "verification"));
            return notify(interaction, ui.error("Não consegui enviar o painel. Verifique minhas permissões no canal.", "Falha ao enviar", interaction));
        }
        await interaction.editReply(await ConfigPanelManager.build(interaction, "verification"));
        return notify(interaction, ui.success(`Painel de verificação enviado em ${channel}.`, "Painel enviado", interaction));
    }

    if (id === "config_sel:verif_mode") {
        const mode = interaction.values[0];
        if (!Object.hasOwn(ConfigPanelManager.VERIFICATION_MODES, mode)) return;
        await Repo.setConfig(table, guild.id, { mode });
        // O texto do painel muda conforme o modo; o membro precisa ver o painel atualizado.
        return refresh(interaction, "verification");
    }

    if (id === "config_role:verif_role") {
        const role = interaction.roles.first();
        const problem = VerificationManager.checkRoleUsable(guild, role && guild.roles.cache.get(role.id));
        if (problem) return ui.caution(interaction, problem, "Cargo inválido");
        if (role.id === config.unverified_role_id) return ui.caution(interaction, "Os dois cargos precisam ser diferentes.", "Cargos iguais");
        await Repo.setConfig(table, guild.id, { role_id: role.id });
        return refresh(interaction, "verification");
    }

    if (id === "config_role:verif_unverified") {
        const role = interaction.roles.first();
        if (!role) {
            await Repo.setConfig(table, guild.id, { unverified_role_id: null });
            return refresh(interaction, "verification");
        }
        const problem = VerificationManager.checkRoleUsable(guild, guild.roles.cache.get(role.id));
        if (problem) return ui.caution(interaction, problem, "Cargo inválido");
        if (role.id === config.role_id) return ui.caution(interaction, "Os dois cargos precisam ser diferentes.", "Cargos iguais");
        await Repo.setConfig(table, guild.id, { unverified_role_id: role.id });
        return refresh(interaction, "verification");
    }

    if (id === "config_channel:verif_channel") {
        const channel = interaction.channels.first();
        if (!channel?.isTextBased?.() || channel.isThread?.()) return ui.fail(interaction, "Selecione um canal de texto válido.", "Canal inválido");
        if (needsTextPerms(channel, guild.members.me)) return ui.fail(interaction, permsMessage(channel), "Faltam permissões");
        await interaction.deferUpdate();
        // Troca de canal: apaga o painel antigo para não ficar um botão órfão.
        if (channel.id !== config.channel_id) await removeOldVerificationPanel(guild, config);
        await Repo.setConfig(table, guild.id, { channel_id: channel.id, message_id: channel.id === config.channel_id ? config.message_id : null });
        return interaction.editReply(await ConfigPanelManager.build(interaction, "verification"));
    }
}

/* ---------- CONTAS NOVAS ---------- */

async function accountFilter(interaction, id) {
    const { guild } = interaction;
    const table = AccountFilterManager.TABLE;
    const config = await Repo.getConfig(table, guild.id);

    if (id === "config_filter:enabled") {
        await Repo.setConfig(table, guild.id, { enabled: config.enabled ? 0 : 1 });
        return refresh(interaction, "accountfilter");
    }

    if (id === "config_sel:filter_days") {
        const days = Number(interaction.values[0]);
        if (!ConfigPanelManager.FILTER_DAY_OPTIONS.includes(days)) return;
        await Repo.setConfig(table, guild.id, { min_age_days: days });
        return refresh(interaction, "accountfilter");
    }

    if (id === "config_sel:filter_action") {
        const action = interaction.values[0];
        if (!Object.hasOwn(AccountFilterManager.ACTIONS, action)) return;
        const me = guild.members.me;
        if (action === "timeout" && !me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return ui.fail(interaction, "Para aplicar castigo eu preciso da permissão **Castigar Membros**.", "Faltam permissões");
        }
        if (action === "kick" && !me?.permissions.has(PermissionFlagsBits.KickMembers)) {
            return ui.fail(interaction, "Para expulsar eu preciso da permissão **Expulsar Membros**.", "Faltam permissões");
        }
        await Repo.setConfig(table, guild.id, { action });
        return refresh(interaction, "accountfilter");
    }

    if (id === "config_channel:filter_alert") {
        const channel = interaction.channels.first();
        if (!channel) {
            await Repo.setConfig(table, guild.id, { alert_channel_id: null });
            return refresh(interaction, "accountfilter");
        }
        if (!channel.isTextBased?.() || channel.isThread?.()) return ui.fail(interaction, "Selecione um canal de texto válido.", "Canal inválido");
        if (needsTextPerms(channel, guild.members.me)) return ui.fail(interaction, permsMessage(channel), "Faltam permissões");
        await Repo.setConfig(table, guild.id, { alert_channel_id: channel.id });
        return refresh(interaction, "accountfilter");
    }
}

/* ---------- RELATÓRIO SEMANAL ---------- */

async function weeklyReport(interaction, id) {
    const { guild } = interaction;
    const table = WeeklyReportManager.TABLE;
    const config = await Repo.getConfig(table, guild.id);

    if (id === "config_report:enabled") {
        if (!config.enabled && !config.channel_id) {
            return ui.caution(interaction, "Escolha primeiro o canal onde o relatório será enviado.", "Canal não configurado");
        }
        await Repo.setConfig(table, guild.id, { enabled: config.enabled ? 0 : 1 });
        return refresh(interaction, "weeklyreport");
    }

    if (id === "config_report:send") {
        if (!config.channel_id) return ui.caution(interaction, "Escolha primeiro o canal do relatório.", "Canal não configurado");
        await interaction.deferUpdate();
        try {
            await WeeklyReportManager.sendReport(guild, config.channel_id);
        } catch {
            await interaction.editReply(await ConfigPanelManager.build(interaction, "weeklyreport"));
            return notify(interaction, ui.error("Não consegui enviar. Verifique se o canal ainda existe e se tenho permissão.", "Falha ao enviar", interaction));
        }
        await interaction.editReply(await ConfigPanelManager.build(interaction, "weeklyreport"));
        return notify(interaction, ui.success(`Relatório enviado em <#${config.channel_id}>.`, "Enviado", interaction));
    }

    if (id === "config_sel:report_day") {
        const day = Number(interaction.values[0]);
        if (!Number.isInteger(day) || day < 0 || day > 6) return;
        await Repo.setConfig(table, guild.id, { day });
        return refresh(interaction, "weeklyreport");
    }

    if (id === "config_channel:report_channel") {
        const channel = interaction.channels.first();
        if (!channel?.isTextBased?.() || channel.isThread?.()) return ui.fail(interaction, "Selecione um canal de texto válido.", "Canal inválido");
        if (needsTextPerms(channel, guild.members.me)) return ui.fail(interaction, permsMessage(channel), "Faltam permissões");
        await Repo.setConfig(table, guild.id, { channel_id: channel.id });
        return refresh(interaction, "weeklyreport");
    }
}

/* ---------- BACKUP ---------- */

const MAX_BACKUP_SIZE = 4 * 1024 * 1024;

async function backup(interaction, id) {
    const { guild } = interaction;

    // Mesma regra do /backup: só Administrador cria, restaura ou exclui.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return ui.caution(interaction, "Só quem tem **Administrador** pode usar os backups.", "Sem permissão");
    }

    if (id === "config_backup:create") {
        if (BackupManager.isRestoring(guild.id)) return ui.caution(interaction, "Há uma restauração em andamento. Aguarde terminar.", "Aguarde");
        await interaction.deferUpdate();
        const data = BackupManager.snapshot(guild);
        if (JSON.stringify(data).length > MAX_BACKUP_SIZE) {
            await interaction.editReply(await ConfigPanelManager.build(interaction, "backup"));
            return notify(interaction, ui.error("A estrutura é grande demais para um backup.", "Backup não criado", interaction));
        }
        const name = `Backup ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
        const backupId = await Repo.createBackup(guild.id, name, data, interaction.user.id);
        const sum = BackupManager.summarize(data);
        await interaction.editReply(await ConfigPanelManager.build(interaction, "backup"));
        return notify(interaction, ui.success(
            `**${name}** (ID \`${backupId}\`)\n${sum.roles} cargos · ${sum.categories} categorias · ${sum.channels} canais.`,
            "Backup criado", interaction));
    }

    if (id === "config_sel:backup_pick") {
        const backupId = Number(interaction.values[0]);
        const found = await Repo.getBackup(guild.id, backupId);
        if (!found) {
            return interaction.update(await ConfigPanelManager.build(interaction, "backup"));
        }
        const sum = BackupManager.summarize(found.data);
        // Reaproveita os botões do /backup (src/interactions/backup/buttonHandler.js).
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`backup:confirm:${backupId}:${interaction.user.id}`).setLabel("Restaurar").setEmoji("♻️").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`backup:delete:${backupId}:${interaction.user.id}`).setLabel("Excluir").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`backup:cancel:${interaction.user.id}`).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
        );
        await interaction.update(await ConfigPanelManager.build(interaction, "backup"));
        return interaction.followUp({
            embeds: [ui.warn(
                `**${found.name}** (ID \`${backupId}\`)\n${sum.roles} cargos · ${sum.categories} categorias · ${sum.channels} canais.\n\n` +
                "Restaurar é **seguro**: só recria cargos, categorias e canais que **não existem** (comparando pelo nome). Nada é apagado nem alterado.",
                "O que fazer com este backup?", interaction)],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
}

async function execute(interaction) {
    const id = interaction.customId;

    if (id.startsWith("config_verif:") || id === "config_sel:verif_mode" || id.startsWith("config_role:verif_") || id === "config_channel:verif_channel") {
        return verification(interaction, id);
    }
    if (id.startsWith("config_filter:") || id.startsWith("config_sel:filter_") || id === "config_channel:filter_alert") {
        return accountFilter(interaction, id);
    }
    if (id.startsWith("config_report:") || id === "config_sel:report_day" || id === "config_channel:report_channel") {
        return weeklyReport(interaction, id);
    }
    if (id.startsWith("config_backup:") || id === "config_sel:backup_pick") {
        return backup(interaction, id);
    }
}

module.exports = { owns, execute };
