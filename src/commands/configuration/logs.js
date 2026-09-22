const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

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

            return interaction.reply({
                content: `✅ Canal de logs definido como ${channel}.`,
                flags: MessageFlags.Ephemeral
            });

        }

        if (sub === "disable") {

            await GuildRepository.setLogChannel({
                guildId,
                channelId: null
            });

            return interaction.reply({
                content: "✅ Logs desativados.",
                flags: MessageFlags.Ephemeral
            });

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

            return interaction.reply({
                content: enabled
                    ? `✅ Categoria **${category.label}** ativada.`
                    : `✅ Categoria **${category.label}** desativada.`,
                flags: MessageFlags.Ephemeral
            });

        }

        if (sub === "status") {

            const settings = await GuildRepository.getSettings(guildId);
            const disabled = await GuildRepository.getDisabledCategories(guildId);

            const channelText = settings.log_channel
                ? `<#${settings.log_channel}>`
                : "*Não configurado*";

            const categoryLines = Object.entries(CATEGORIES)
                .map(([key, category]) => {
                    const isEnabled = !disabled.includes(key);
                    return `${isEnabled ? "🟢" : "🔴"} ${category.emoji} ${category.label}`;
                })
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("📋 Configuração de Logs")
                .addFields(
                    {
                        name: "Canal",
                        value: channelText
                    },
                    {
                        name: "Categorias",
                        value: categoryLines
                    }
                )
                .setFooter({
                    text: "Use /logs categoria para ativar ou desativar cada uma."
                });

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        }

    }

};
