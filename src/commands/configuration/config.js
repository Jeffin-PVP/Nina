const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const GuildRepository = require("../../database/repositories/GuildRepository");
const TicketRepository = require("../../database/repositories/TicketRepository");
const AutoroleRepository = require("../../database/repositories/AutoroleRepository");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("config")

        .setDescription("Configurações gerais do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>

            sub
                .setName("status")
                .setDescription("Mostra um resumo de todas as configurações do bot.")

        )

        .addSubcommand(sub =>

            sub
                .setName("economia")
                .setDescription("Ativa ou desativa o sistema de economia (moedas, XP, jogos).")
                .addBooleanOption(o => o.setName("ativado").setDescription("Ligar ou desligar.").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("moderacao")
                .setDescription("Ativa ou desativa as ferramentas de moderação da IA e dos comandos.")
                .addBooleanOption(o => o.setName("ativado").setDescription("Ligar ou desligar.").setRequired(true))

        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        if (sub === "economia") {

            const enabled = interaction.options.getBoolean("ativado");

            await GuildRepository.setEconomyEnabled(guild.id, enabled);

            return interaction.reply({
                content: enabled
                    ? "✅ Economia ativada."
                    : "✅ Economia desativada.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (sub === "moderacao") {

            const enabled = interaction.options.getBoolean("ativado");

            await GuildRepository.setModerationEnabled(guild.id, enabled);

            return interaction.reply({
                content: enabled
                    ? "✅ Moderação ativada."
                    : "✅ Moderação desativada (comandos e IA não vão banir/kickar/silenciar/etc até você reativar).",
                flags: MessageFlags.Ephemeral
            });

        }

        if (sub === "status") {

            const settings = await GuildRepository.getSettings(guild.id);
            const ticketConfig = await TicketRepository.getConfig(guild.id);
            const joinRoles = await AutoroleRepository.getJoinRoles(guild.id);
            const selfRoles = await AutoroleRepository.listSelfRoles(guild.id);
            const levelRoles = await AutoroleRepository.listLevelRoles(guild.id);

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(`⚙️ Configurações — ${guild.name}`)
                .addFields(

                    {
                        name: "💰 Economia",
                        value: settings.economy_enabled ? "🟢 Ativada" : "🔴 Desativada",
                        inline: true
                    },

                    {
                        name: "🛡️ Moderação",
                        value: settings.moderation_enabled ? "🟢 Ativada" : "🔴 Desativada",
                        inline: true
                    },

                    {
                        name: "📢 Aviso de level-up",
                        value: settings.levelup_enabled ? "🟢 Ativado" : "🔴 Desativado",
                        inline: true
                    },

                    {
                        name: "📋 Canal de logs",
                        value: settings.log_channel ? `<#${settings.log_channel}>` : "*Não configurado*",
                        inline: true
                    },

                    {
                        name: "🎫 Tickets",
                        value: ticketConfig.parent_channel_id
                            ? `🟢 <#${ticketConfig.parent_channel_id}>`
                            : "🔴 Não configurado",
                        inline: true
                    },

                    {
                        name: "🚪 Cargos de entrada",
                        value: joinRoles.length ? `${joinRoles.length} configurado(s)` : "Nenhum",
                        inline: true
                    },

                    {
                        name: "🎭 Self-roles",
                        value: selfRoles.length ? `${selfRoles.length} configurado(s)` : "Nenhum",
                        inline: true
                    },

                    {
                        name: "🏆 Cargos por nível",
                        value: levelRoles.length ? `${levelRoles.length} configurado(s)` : "Nenhum",
                        inline: true
                    }

                )
                .setFooter({ text: "Use /logs, /ticket, /autorole e /config para ajustar cada área." });

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        }

    }

};
