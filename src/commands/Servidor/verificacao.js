const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const Repo = require("../../database/repositories/ServerToolsRepository");
const VerificationManager = require("../../managers/VerificationManager");
const ui = require("../../utils/ui");

const TABLE = VerificationManager.TABLE;
const modeLabel = mode => (mode === "captcha" ? "Pergunta (captcha simples)" : "Botão");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verificacao")
        .setDescription("Verificação de entrada: libera o servidor só depois que o membro confirmar.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName("setup").setDescription("Configura e envia o painel de verificação.")
            .addRoleOption(o => o.setName("cargo").setDescription("Cargo entregue a quem se verificar.").setRequired(true))
            .addStringOption(o => o.setName("modo").setDescription("Como o membro se verifica.")
                .addChoices({ name: "Botão (um clique)", value: "button" }, { name: "Pergunta (captcha simples)", value: "captcha" }))
            .addRoleOption(o => o.setName("cargo-nao-verificado").setDescription("Cargo dado na entrada e removido ao verificar (opcional)."))
            .addChannelOption(o => o.setName("canal").setDescription("Canal do painel (padrão: o atual).").addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName("painel").setDescription("Reenvia o painel de verificação no canal atual."))
        .addSubcommand(sub => sub.setName("status").setDescription("Mostra a configuração atual."))
        .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa a verificação.")),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return ui.caution(interaction, "Você precisa da permissão **Gerenciar Servidor**.", "Sem permissão");
        }
        const { guild } = interaction;
        const sub = interaction.options.getSubcommand();

        if (sub === "setup") {
            const role = interaction.options.getRole("cargo");
            const unverified = interaction.options.getRole("cargo-nao-verificado");
            const channel = interaction.options.getChannel("canal") || interaction.channel;
            const mode = interaction.options.getString("modo") || "button";

            for (const r of [role, unverified].filter(Boolean)) {
                const problem = VerificationManager.checkRoleUsable(guild, guild.roles.cache.get(r.id));
                if (problem) return ui.fail(interaction, problem, "Cargo inválido");
            }
            if (unverified && unverified.id === role.id) return ui.fail(interaction, "Os dois cargos precisam ser diferentes.", "Cargos iguais");
            const perms = channel.permissionsFor(guild.members.me);
            if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks)) {
                return ui.fail(interaction, `Em ${channel} eu preciso de: ver o canal, enviar mensagens e incorporar links.`, "Faltam permissões");
            }

            await Repo.setConfig(TABLE, guild.id, {
                enabled: 1, mode, role_id: role.id, unverified_role_id: unverified?.id ?? null
            });
            const config = await Repo.getConfig(TABLE, guild.id);
            await VerificationManager.sendPanel(guild, config, channel);
            return ui.ok(interaction,
                `Painel enviado em ${channel}.\n**Modo:** ${modeLabel(mode)}\n**Cargo verificado:** ${role}${unverified ? `\n**Cargo não verificado:** ${unverified}` : ""}\n\n` +
                "Dica: para a verificação ter efeito, esconda os canais do servidor de `@everyone` e libere-os para o cargo verificado (ou deixe só o canal do painel visível).",
                "Verificação configurada");
        }

        if (sub === "painel") {
            const config = await Repo.getConfig(TABLE, guild.id);
            if (!config.enabled || !config.role_id) return ui.caution(interaction, "Configure antes com `/verificacao setup`.", "Não configurada");
            await VerificationManager.sendPanel(guild, config, interaction.channel);
            return ui.ok(interaction, `Painel reenviado em ${interaction.channel}.`, "Painel enviado");
        }

        if (sub === "desativar") {
            await Repo.setConfig(TABLE, guild.id, { enabled: 0 });
            return ui.ok(interaction, "Verificação desativada. O painel antigo deixa de funcionar.", "Desativada");
        }

        const c = await Repo.getConfig(TABLE, guild.id);
        return ui.respond(interaction, ui.panel({
            color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
            emoji: "shield",
            title: "Verificação de entrada",
            description: c.enabled ? "Ativa." : "Desativada. Use `/verificacao setup`.",
            fields: c.role_id ? [
                ui.field("shield", "Modo", modeLabel(c.mode)),
                ui.field("tag", "Cargo verificado", `<@&${c.role_id}>`),
                ui.field("tag", "Cargo não verificado", c.unverified_role_id ? `<@&${c.unverified_role_id}>` : "*não usado*"),
                ui.field("channel", "Painel", c.channel_id ? `<#${c.channel_id}>` : "*não enviado*")
            ] : [],
            source: interaction
        }), { ephemeral: true });
    }
};
