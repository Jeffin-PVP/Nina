const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const ui = require("../../utils/ui");

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

            return ui.fail(
                interaction,
                `Não tenho permissão para enviar mensagens em ${channel}.`,
                "Sem permissão"
            );

        }

        await channel.send({ content: text });

        return ui.ok(interaction, `Mensagem enviada em ${channel}.`, "Mensagem enviada");

    }

};
