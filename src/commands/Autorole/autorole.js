const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const AutoroleRepository = require("../../database/repositories/AutoroleRepository");
const GuildRepository = require("../../database/repositories/GuildRepository");
const LevelManager = require("../../managers/LevelManager");
const AutorolePanelManager = require("../../managers/AutorolePanelManager");
const { normalizeReactionEmoji } = require("../../utils/reactionEmoji");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("autorole")

        .setDescription("Configura cargos automáticos do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        // ============ ENTRADA ============

        .addSubcommandGroup(group =>

            group
                .setName("entrada")
                .setDescription("Cargo dado automaticamente quando alguém entra no servidor.")
                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Adiciona um cargo de entrada.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a dar na entrada.").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove um cargo de entrada.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a remover.").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("listar")
                        .setDescription("Lista os cargos de entrada configurados.")
                )

        )

        // ============ SELF-ROLE ============

        .addSubcommandGroup(group =>

            group
                .setName("selfrole")
                .setDescription("Cargos que os membros escolhem sozinhos, por botão.")
                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Adiciona um cargo ao painel de self-role.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo disponível.").setRequired(true))
                        .addStringOption(o => o.setName("label").setDescription("Texto do botão.").setMaxLength(80).setRequired(true))
                        .addStringOption(o => o.setName("emoji").setDescription("Emoji do botão (opcional).").setMaxLength(100).setRequired(false))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove um cargo do painel de self-role.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a remover.").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("painel")
                        .setDescription("Envia o painel de self-role no canal atual.")
                        .addStringOption(o => o.setName("titulo").setDescription("Título do painel.").setMaxLength(256).setRequired(false))
                        .addStringOption(o => o.setName("descricao").setDescription("Descrição do painel.").setMaxLength(2000).setRequired(false))
                )

        )

        .addSubcommandGroup(group =>

            group
                .setName("reacao")
                .setDescription("Cargos atribuídos quando um membro reage a uma mensagem.")
                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Vincula uma reação de mensagem a um cargo.")
                        .addChannelOption(o => o.setName("canal").setDescription("Canal da mensagem.").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
                        .addStringOption(o => o.setName("mensagem").setDescription("ID da mensagem.").setRequired(true))
                        .addStringOption(o => o.setName("emoji").setDescription("Emoji Unicode ou emoji personalizado do servidor.").setRequired(true).setMaxLength(100))
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a atribuir/remover.").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove uma configuração de cargo por reação.")
                        .addIntegerOption(o => o.setName("id").setDescription("ID da regra listado em /autorole reacao listar.").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("listar")
                        .setDescription("Lista as regras de cargos por reação.")
                )

        )

        // ============ NÍVEL ============

        .addSubcommandGroup(group =>

            group
                .setName("nivel")
                .setDescription("Cargos dados automaticamente ao atingir um nível de XP.")
                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Define o cargo recompensa de um nível.")
                        .addIntegerOption(o => o.setName("nivel").setDescription("Nível necessário.").setRequired(true).setMinValue(1))
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a dar.").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove o cargo recompensa de um nível.")
                        .addIntegerOption(o => o.setName("nivel").setDescription("Nível.").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("listar")
                        .setDescription("Lista os cargos por nível configurados.")
                )
                .addSubcommand(sub =>
                    sub
                        .setName("avisos")
                        .setDescription("Ativa ou desativa o aviso de \"subiu de nível\" no chat.")
                        .addBooleanOption(o => o.setName("ativado").setDescription("Ligar ou desligar os avisos.").setRequired(true))
                )

        ),

    async execute(interaction) {

        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        /*
        =========================
            ENTRADA
        =========================
        */

        if (group === "entrada") {

            if (sub === "adicionar") {

                const role = interaction.options.getRole("cargo");

                if (role.managed || role.id === guild.id) {

                    return ui.caution(interaction, "Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).", "Cargo inválido");

                }

                await AutoroleRepository.addJoinRole(guild.id, role.id);

                return ui.ok(interaction, `${role} agora é dado automaticamente para quem entrar no servidor.`, "Cargo de entrada adicionado");

            }

            if (sub === "remover") {

                const role = interaction.options.getRole("cargo");

                await AutoroleRepository.removeJoinRole(guild.id, role.id);

                return ui.ok(interaction, `${role} foi removido dos cargos de entrada.`, "Cargo de entrada removido");

            }

            if (sub === "listar") {

                const roleIds = await AutoroleRepository.getJoinRoles(guild.id);

                if (!roleIds.length) {

                    return ui.nothing(interaction, "Nenhum cargo de entrada configurado.\nUse `/autorole entrada adicionar`.", "Sem cargos de entrada");

                }

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.info,
                    emoji: "role",
                    title: `Cargos de entrada (${roleIds.length})`,
                    description: `Dados automaticamente a quem entra no servidor:\n\n${ui.bullets(roleIds.map(id => `<@&${id}>`))}`,
                    source: interaction
                }), { ephemeral: true });

            }

        }

        /*
        =========================
            SELF-ROLE
        =========================
        */

        if (group === "selfrole") {

            if (sub === "adicionar") {

                const role = interaction.options.getRole("cargo");
                const label = interaction.options.getString("label").trim();
                const emoji = interaction.options.getString("emoji")?.trim() || null;

                if (role.managed || role.id === guild.id) {

                    return ui.caution(interaction, "Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).", "Cargo inválido");

                }

                if (!label) {
                    return ui.caution(interaction, "O texto do botão não pode ficar vazio.", "Texto inválido");
                }

                const botMember = guild.members.me;
                if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
                    role.position >= botMember.roles.highest.position) {
                    return ui.caution(interaction, "A Nina precisa da permissão Gerenciar Cargos e estar acima desse cargo.", "Hierarquia inválida");
                }

                const current = await AutoroleRepository.listSelfRoles(guild.id);

                if (current.length >= 25) {

                    return ui.caution(interaction, "O painel de self-role comporta no máximo **25** cargos.", "Limite atingido");

                }

                await AutoroleRepository.addSelfRole(guild.id, role.id, label, emoji);

                return ui.ok(interaction, `${role} entrou no painel de self-role.\nUse \`/autorole selfrole painel\` para publicar ou atualizar.`, "Self-role adicionado");

            }

            if (sub === "remover") {

                const role = interaction.options.getRole("cargo");

                await AutoroleRepository.removeSelfRole(guild.id, role.id);

                return ui.ok(interaction, `${role} saiu do painel de self-role.`, "Self-role removido");

            }

            if (sub === "painel") {

                const roles = await AutoroleRepository.listSelfRoles(guild.id);

                if (!roles.length) {

                    return ui.caution(interaction, "Nenhum cargo configurado ainda. Use `/autorole selfrole adicionar` primeiro.", "Painel vazio");

                }

                const titulo = interaction.options.getString("titulo");
                const descricao = interaction.options.getString("descricao");
                await AutorolePanelManager.send(interaction.channel, roles, {
                    title: titulo,
                    description: descricao,
                    source: interaction
                });

                return ui.ok(interaction, `O painel de self-role foi enviado em ${interaction.channel}.`, "Painel enviado");

            }

        }

        if (group === "reacao") {
            if (sub === "adicionar") {
                const channel = interaction.options.getChannel("canal");
                const messageId = interaction.options.getString("mensagem").trim();
                const emoji = interaction.options.getString("emoji").trim();
                const role = interaction.options.getRole("cargo");

                if (!/^\d{17,20}$/.test(messageId)) {
                    return ui.caution(interaction, "Informe o ID válido da mensagem do Discord.", "Mensagem inválida");
                }
                if (role.managed || role.id === guild.id) {
                    return ui.caution(interaction, "Esse cargo não pode ser usado (é gerenciado ou @everyone).", "Cargo inválido");
                }
                const botRole = guild.members.me?.roles?.highest;
                if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
                    (botRole && role.position >= botRole.position)) {
                    return ui.caution(interaction, "A Nina precisa da permissão Gerenciar Cargos e estar acima desse cargo.", "Hierarquia inválida");
                }

                let emojiKey;
                try {
                    emojiKey = normalizeReactionEmoji(emoji);
                } catch (error) {
                    return ui.caution(interaction, `Não consegui adicionar essa reação: ${error.message}`, "Emoji inválido");
                }

                await interaction.deferReply({ ephemeral: true });
                try {
                    const message = await channel.messages.fetch(messageId);
                    if (message.guildId !== guild.id) {
                        return ui.caution(interaction, "A mensagem precisa pertencer a este servidor.", "Mensagem inválida");
                    }
                    await message.react(emoji);
                    await AutoroleRepository.addReactionRole(guild.id, channel.id, message.id, role.id, emojiKey);
                    return ui.ok(interaction, `${emoji} na mensagem [${message.id}](${message.url}) agora atribui/remove ${role}.`, "Cargo por reação configurado");
                } catch (error) {
                    console.error(`[Autorole:Reação:${guild.id}] Falha ao configurar a regra:`, error);
                    return ui.fail(interaction, `Não consegui configurar essa reação: ${error.message}`, "Falha ao configurar");
                }
            }

            if (sub === "remover") {
                const id = interaction.options.getInteger("id");
                const existing = (await AutoroleRepository.listReactionRoles(guild.id)).find(entry => entry.id === id);
                if (!existing) return ui.caution(interaction, "Não encontrei essa regra de reação.", "Regra não encontrada");
                await AutoroleRepository.removeReactionRole(guild.id, id);
                return ui.ok(interaction, `A regra de reação **${id}** foi removida.`, "Regra removida");
            }

            if (sub === "listar") {
                const rules = await AutoroleRepository.listReactionRoles(guild.id);
                if (!rules.length) return ui.nothing(interaction, "Nenhuma regra de reação configurada.", "Sem regras");
                const description = rules.map(rule =>
                    `**#${rule.id}** <#${rule.channel_id}> · [mensagem](https://discord.com/channels/${guild.id}/${rule.channel_id}/${rule.message_id}) · ${rule.emoji_key.replace(/^(custom|unicode):/, "")} → <@&${rule.role_id}>`
                ).join("\n");
                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.info,
                    emoji: "role",
                    title: `Cargos por reação (${rules.length})`,
                    description: ui.clip(description, 4000),
                    source: interaction
                }), { ephemeral: true });
            }
        }

        /*
        =========================
            NÍVEL
        =========================
        */

        if (group === "nivel") {

            if (sub === "adicionar") {

                const level = interaction.options.getInteger("nivel");
                const role = interaction.options.getRole("cargo");

                if (role.managed || role.id === guild.id) {

                    return ui.caution(interaction, "Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).", "Cargo inválido");

                }

                await AutoroleRepository.setLevelRole(guild.id, level, role.id);

                return ui.ok(interaction, `Quem atingir o nível **${level}** vai ganhar o cargo ${role}.`, "Recompensa de nível definida");

            }

            if (sub === "remover") {

                const level = interaction.options.getInteger("nivel");

                await AutoroleRepository.removeLevelRole(guild.id, level);

                return ui.ok(interaction, `A recompensa do nível **${level}** foi removida.`, "Recompensa removida");

            }

            if (sub === "listar") {

                const levels = await AutoroleRepository.listLevelRoles(guild.id);

                if (!levels.length) {

                    return ui.nothing(interaction, "Nenhum cargo por nível configurado.\nUse `/autorole nivel adicionar`.", "Sem cargos por nível");

                }

                const description = levels
                    .map(entry => `${e("trophy")} **Nível ${entry.level}** — <@&${entry.role_id}>`)
                    .join("\n");

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.info,
                    emoji: "trophy",
                    title: `Cargos por nível (${levels.length})`,
                    description: ui.clip(description, 4000),
                    source: interaction
                }), { ephemeral: true });

            }

            if (sub === "avisos") {

                const enabled = interaction.options.getBoolean("ativado");

                await GuildRepository.update(guild.id, {
                    levelup_enabled: enabled ? 1 : 0
                });

                return ui.respond(interaction, ui.panel({
                    color: enabled ? ui.COLORS.success : ui.COLORS.neutral,
                    emoji: "trophy",
                    title: `Avisos de level-up ${enabled ? "ativados" : "desativados"}`,
                    description: enabled
                        ? "O chat vai avisar quando alguém subir de nível."
                        : "Ninguém será avisado no chat ao subir de nível.",
                    source: interaction
                }), { ephemeral: true });

            }

        }

    }

};
