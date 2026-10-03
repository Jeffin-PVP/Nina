const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const ui = require("../../utils/ui");

const GuildRepository = require("../../database/repositories/GuildRepository");
const { CATEGORIES } = require("../../managers/LogCategories");

const categoryChoices = Object.entries(CATEGORIES)
    .map(([key, category]) => ({
        name: `${category.emoji} ${category.label}`,
        value: key
    }));

module.exports = {

    data: new SlashCommandBuilder()

        .setName("logs")

        .setDescription(
            "Configura o sistema de logs do servidor."
        )

        .addSubcommand(sub =>

            sub
                .setName("set")
                .setDescription("Define o canal de logs.")
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription("Canal onde os logs serão enviados.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )

        )

        .addSubcommand(sub =>

            sub
                .setName("disable")
                .setDescription("Desativa os logs por completo.")

        )

        .addSubcommand(sub =>

            sub
                .setName("status")
                .setDescription("Mostra a configuração atual dos logs.")

        )

        .addSubcommand(sub =>

            sub
                .setName("categoria")
                .setDescription("Ativa ou desativa uma categoria de log.")
                .addStringOption(option =>
                    option
                        .setName("nome")
                        .setDescription("Categoria de log.")
                        .setRequired(true)
                        .addChoices(...categoryChoices)
                )
                .addBooleanOption(option =>
                    option
                        .setName("ativado")
                        .setDescription("Ligar ou desligar essa categoria.")
                        .setRequired(true)
                )

        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === "set") {

            const channel = interaction.options.getChannel("canal");

            await GuildRepository.setLogChannel({
                guildId,
                channelId: channel.id
            });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "log",
                title: "Canal de logs definido",
                description: `Os registros do servidor agora serão enviados em ${channel}.`,
                fields: [ui.field("channel", "Canal", `${channel}`, false)],
                footer: "Use /logs categoria para escolher o que registrar",
                source: interaction
            }), { ephemeral: true });

        }

        if (sub === "disable") {

            await GuildRepository.setLogChannel({
                guildId,
                channelId: null
            });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "log",
                title: "Logs desativados",
                description: "Nenhum registro será enviado até você definir um canal com `/logs set`.",
                source: interaction
            }), { ephemeral: true });

        }

        if (sub === "categoria") {

            const categoryKey = interaction.options.getString("nome");
            const enabled = interaction.options.getBoolean("ativado");

            await GuildRepository.setCategoryEnabled(
                guildId,
                categoryKey,
                enabled
            );

            const category = CATEGORIES[categoryKey];

            return ui.respond(interaction, ui.panel({
                color: enabled ? ui.COLORS.success : ui.COLORS.neutral,
                emoji: "log",
                title: `Categoria ${enabled ? "ativada" : "desativada"}`,
                description: `${category.emoji} **${category.label}**`,
                fields: [ui.field("config", "Estado", ui.toggle(enabled), false)],
                source: interaction
            }), { ephemeral: true });

        }

        if (sub === "status") {

            const settings = await GuildRepository.getSettings(guildId);
            const disabled = await GuildRepository.getDisabledCategories(guildId);

            const channelText = settings.log_channel
                ? `<#${settings.log_channel}>`
                : "*Não configurado — use `/logs set`*";

            const entries = Object.entries(CATEGORIES);
            const activeCount = entries.filter(([key]) => !disabled.includes(key)).length;

            const categoryLines = entries
                .map(([key, category]) => {
                    const isEnabled = !disabled.includes(key);
                    return `${isEnabled ? "🟢" : "🔴"} ${category.emoji} ${category.label}`;
                })
                .join("\n");

            const embed = ui.panel({
                color: ui.COLORS.info,
                emoji: "log",
                title: "Configuração de logs",
                fields: [
                    ui.field("channel", "Canal", channelText, false),
                    ui.field("config", `Categorias (${activeCount}/${entries.length} ativas)`, ui.clip(categoryLines), false)
                ],
                footer: "Use /logs categoria para ativar ou desativar cada uma",
                source: interaction
            });

            return ui.respond(interaction, embed, { ephemeral: true });

        }

    }

};
