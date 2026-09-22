const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const AutoroleRepository = require("../../database/repositories/AutoroleRepository");
const GuildRepository = require("../../database/repositories/GuildRepository");
const LevelManager = require("../../managers/LevelManager");

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
                        .addStringOption(o => o.setName("label").setDescription("Texto do botão.").setRequired(true))
                        .addStringOption(o => o.setName("emoji").setDescription("Emoji do botão (opcional).").setRequired(false))
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
                        .addStringOption(o => o.setName("titulo").setDescription("Título do painel.").setRequired(false))
                        .addStringOption(o => o.setName("descricao").setDescription("Descrição do painel.").setRequired(false))
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

                    return interaction.reply({
                        content: "⚠️ Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).",
                        flags: MessageFlags.Ephemeral
                    });

                }

                await AutoroleRepository.addJoinRole(guild.id, role.id);

                return interaction.reply({
                    content: `✅ ${role} agora é dado automaticamente para quem entrar no servidor.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "remover") {

                const role = interaction.options.getRole("cargo");

                await AutoroleRepository.removeJoinRole(guild.id, role.id);

                return interaction.reply({
                    content: `✅ ${role} removido dos cargos de entrada.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "listar") {

                const roleIds = await AutoroleRepository.getJoinRoles(guild.id);

                if (!roleIds.length) {

                    return interaction.reply({
                        content: "📭 Nenhum cargo de entrada configurado.",
                        flags: MessageFlags.Ephemeral
                    });

                }

                return interaction.reply({
                    content: `🚪 Cargos de entrada: ${roleIds.map(id => `<@&${id}>`).join(", ")}`,
                    flags: MessageFlags.Ephemeral
                });

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
                const label = interaction.options.getString("label");
                const emoji = interaction.options.getString("emoji");

                if (role.managed || role.id === guild.id) {

                    return interaction.reply({
                        content: "⚠️ Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).",
                        flags: MessageFlags.Ephemeral
                    });

                }

                const current = await AutoroleRepository.listSelfRoles(guild.id);

                if (current.length >= 25) {

                    return interaction.reply({
                        content: "⚠️ Limite de 25 cargos por painel de self-role atingido.",
                        flags: MessageFlags.Ephemeral
                    });

                }

                await AutoroleRepository.addSelfRole(guild.id, role.id, label, emoji);

                return interaction.reply({
                    content: `✅ ${role} adicionado ao painel de self-role. Use \`/autorole selfrole painel\` para publicar/atualizar.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "remover") {

                const role = interaction.options.getRole("cargo");

                await AutoroleRepository.removeSelfRole(guild.id, role.id);

                return interaction.reply({
                    content: `✅ ${role} removido do painel de self-role.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "painel") {

                const roles = await AutoroleRepository.listSelfRoles(guild.id);

                if (!roles.length) {

                    return interaction.reply({
                        content: "⚠️ Nenhum cargo configurado ainda. Use `/autorole selfrole adicionar` primeiro.",
                        flags: MessageFlags.Ephemeral
                    });

                }

                const titulo = interaction.options.getString("titulo") || "🎭 Escolha seus cargos";
                const descricao = interaction.options.getString("descricao") ||
                    "Clique em um botão para adicionar ou remover o cargo correspondente.";

                const embed = new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle(titulo)
                    .setDescription(descricao);

                const rows = [];

                for (let i = 0; i < roles.length; i += 5) {

                    const row = new ActionRowBuilder();
                    const chunk = roles.slice(i, i + 5);

                    for (const role of chunk) {

                        const button = new ButtonBuilder()
                            .setCustomId(`selfrole_${role.role_id}`)
                            .setLabel(role.label)
                            .setStyle(ButtonStyle.Secondary);

                        if (role.emoji) {

                            try {
                                button.setEmoji(role.emoji);
                            } catch {
                                // emoji inválido, ignora silenciosamente
                            }

                        }

                        row.addComponents(button);

                    }

                    rows.push(row);

                }

                await interaction.channel.send({ embeds: [embed], components: rows });

                return interaction.reply({
                    content: "✅ Painel de self-role enviado!",
                    flags: MessageFlags.Ephemeral
                });

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

                    return interaction.reply({
                        content: "⚠️ Esse cargo não pode ser usado (é um cargo gerenciado ou o @everyone).",
                        flags: MessageFlags.Ephemeral
                    });

                }

                await AutoroleRepository.setLevelRole(guild.id, level, role.id);

                return interaction.reply({
                    content: `✅ Quem atingir o nível **${level}** vai ganhar o cargo ${role}.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "remover") {

                const level = interaction.options.getInteger("nivel");

                await AutoroleRepository.removeLevelRole(guild.id, level);

                return interaction.reply({
                    content: `✅ Recompensa do nível **${level}** removida.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "listar") {

                const levels = await AutoroleRepository.listLevelRoles(guild.id);

                if (!levels.length) {

                    return interaction.reply({
                        content: "📭 Nenhum cargo por nível configurado.",
                        flags: MessageFlags.Ephemeral
                    });

                }

                const description = levels
                    .map(entry => `**Nível ${entry.level}** — <@&${entry.role_id}>`)
                    .join("\n");

                const embed = new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle("🏆 Cargos por Nível")
                    .setDescription(description);

                return interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "avisos") {

                const enabled = interaction.options.getBoolean("ativado");

                await GuildRepository.update(guild.id, {
                    levelup_enabled: enabled ? 1 : 0
                });

                return interaction.reply({
                    content: enabled
                        ? "✅ Avisos de level-up ativados."
                        : "✅ Avisos de level-up desativados.",
                    flags: MessageFlags.Ephemeral
                });

            }

        }

    }

};
