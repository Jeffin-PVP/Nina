const { E } = require("../../config/emojiRegistry");
const {
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const BackupManager = require("../../managers/BackupManager");
const ui = require("../../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup")
        .setDescription("Backup e restauração da estrutura do servidor (cargos, canais e permissões).")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName("criar").setDescription("Cria um backup da estrutura atual.")
            .addStringOption(o => o.setName("nome").setDescription("Nome do backup (opcional).").setMaxLength(60)))
        .addSubcommand(sub => sub.setName("listar").setDescription("Lista os backups salvos."))
        .addSubcommand(sub => sub.setName("restaurar").setDescription("Recria o que está faltando a partir de um backup.")
            .addIntegerOption(o => o.setName("id").setDescription("ID do backup (veja em /backup listar).").setRequired(true).setMinValue(1)))
        .addSubcommand(sub => sub.setName("excluir").setDescription("Exclui um backup.")
            .addIntegerOption(o => o.setName("id").setDescription("ID do backup.").setRequired(true).setMinValue(1))),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return ui.caution(interaction, "Só quem tem **Administrador** pode usar os backups.", "Sem permissão");
        }
        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === "criar") {
            await interaction.deferReply({ ephemeral: true });
            const created = await BackupManager.createBackup(guild, interaction.user.id, interaction.options.getString("nome"));
            if (created.tooLarge) return ui.fail(interaction, "A estrutura é grande demais para um backup.", "Backup não criado");
            const { id, name, summary: sum } = created;
            return ui.respond(interaction, ui.success(
                `**${name}** (ID \`${id}\`)\n${sum.roles} cargos · ${sum.categories} categorias · ${sum.channels} canais.\nO servidor guarda até ${Repo.MAX_BACKUPS_PER_GUILD} backups; os mais antigos são removidos.\n\nMensagens, membros e configurações da Nina **não** entram no backup.`,
                "Backup criado", interaction));
        }

        if (sub === "listar") {
            const list = await Repo.listBackups(guild.id);
            if (!list.length) return ui.nothing(interaction, "Nenhum backup salvo. Use `/backup criar`.", "Sem backups");
            const lines = list.map(b => `**#${b.id}** · ${b.name}\n┗ <t:${Math.floor(new Date(b.created_at + "Z").getTime() / 1000)}:f> · por <@${b.created_by}> · ${(b.size / 1024).toFixed(0)} KB`);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`💾 Backups (${list.length})`).setDescription(lines.join("\n").slice(0, 4000))],
                ephemeral: true, allowedMentions: { parse: [] }
            });
        }

        const id = interaction.options.getInteger("id");
        const backup = await Repo.getBackup(guild.id, id);
        if (!backup) return ui.caution(interaction, `Não encontrei o backup \`${id}\` neste servidor.`, "Backup inexistente");

        if (sub === "excluir") {
            await Repo.deleteBackup(guild.id, id);
            return ui.ok(interaction, `Backup **${backup.name}** excluído.`, "Backup excluído");
        }

        // restaurar → pede confirmação
        const me = guild.members.me;
        if (!me.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return ui.fail(interaction, "Eu preciso das permissões **Gerenciar Canais** e **Gerenciar Cargos**.", "Faltam permissões");
        }
        if (BackupManager.isRestoring(guild.id)) return ui.caution(interaction, "Já há uma restauração em andamento.", "Aguarde");
        const sum = BackupManager.summarize(backup.data);
        const embed = new EmbedBuilder()
            .setColor(0xfaa61a)
            .setTitle(`${E("ui_torefresh")} Restaurar backup?`)
            .setDescription(
                `**${backup.name}** (ID \`${id}\`)\n${sum.roles} cargos · ${sum.categories} categorias · ${sum.channels} canais.\n\n` +
                "A restauração é **segura**: só recria cargos, categorias e canais que **não existem** (comparando pelo nome). Nada é apagado nem alterado, e as permissões que eu não tenho são ignoradas."
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`backup:confirm:${id}:${interaction.user.id}`).setLabel("Restaurar").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`backup:cancel:${interaction.user.id}`).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};
