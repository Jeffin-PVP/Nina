const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} = require("discord.js");

const ServerBuilder = require("../../managers/ServerBuilderManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("criar-servidor")

        .setDescription("Recria o servidor do zero usando IA (cargos, categorias, canais e permissões).")

        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .setDMPermission(false),

    async execute(interaction) {

        const { guild } = interaction;

        if (!guild) {

            return interaction.reply({
                content: "⚠️ Este comando só funciona dentro de um servidor.",
                flags: MessageFlags.Ephemeral
            });

        }

        const botMember = guild.members.me;

        const permissoesNecessarias = [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles
        ];

        if (!botMember.permissions.has(permissoesNecessarias)) {

            return interaction.reply({
                content: "⚠️ Preciso das permissões **Gerenciar Servidor**, **Gerenciar Canais** e **Gerenciar Cargos** para recriar o servidor.",
                flags: MessageFlags.Ephemeral
            });

        }

        const modal = new ModalBuilder()

            .setCustomId("criarservidor_modal")

            .setTitle("Criar Servidor com IA");

        const temaInput = new TextInputBuilder()
            .setCustomId("tema")
            .setLabel("Tema ou descrição do servidor")
            .setPlaceholder("Ex: \"Comunidade Gaming\" ou uma descrição detalhada...")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(3)
            .setMaxLength(4000)
            .setRequired(true);

        const divisoriaCategoriaInput = new TextInputBuilder()
            .setCustomId("divisoria_categoria")
            .setLabel("Divisória da categoria")
            .setPlaceholder(ServerBuilder.DIVISOR_PADRAO_CATEGORIA)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(5)
            .setRequired(false);

        const divisoriaCanalInput = new TextInputBuilder()
            .setCustomId("divisoria_canal")
            .setLabel("Divisória de canal e canal de voz")
            .setPlaceholder(ServerBuilder.DIVISOR_PADRAO_CANAL)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(5)
            .setRequired(false);

        const emojiInput = new TextInputBuilder()
            .setCustomId("emoji")
            .setLabel("Usar emojis nos nomes? (sim/não)")
            .setPlaceholder("sim")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(3)
            .setRequired(false);

        const segurancaInput = new TextInputBuilder()
            .setCustomId("seguranca_reforcada")
            .setLabel("Segurança reforçada? (sim/não)")
            .setPlaceholder("não")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(3)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(temaInput),
            new ActionRowBuilder().addComponents(divisoriaCategoriaInput),
            new ActionRowBuilder().addComponents(divisoriaCanalInput),
            new ActionRowBuilder().addComponents(emojiInput),
            new ActionRowBuilder().addComponents(segurancaInput)
        );

        await interaction.showModal(modal);

    }

};
