const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("say")

        .setDescription("Envia uma mensagem como o bot.")

        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Texto a enviar.")
                .setRequired(true)
                .setMaxLength(2000)
        )

        .addChannelOption(option =>
            option
                .setName("canal")
                .setDescription("Canal de destino (padrão: canal atual).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {

        const text = interaction.options.getString("mensagem");
        const channel = interaction.options.getChannel("canal") ?? interaction.channel;

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);

        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {

            return interaction.reply({
                content: `❌ Não tenho permissão para enviar mensagens em ${channel}.`,
                flags: MessageFlags.Ephemeral
            });

        }

        await channel.send({ content: text });

        return interaction.reply({
            content: `✅ Mensagem enviada em ${channel}.`,
            flags: MessageFlags.Ephemeral
        });

    }

};
