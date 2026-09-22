const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("nick")

        .setDescription("Altera o apelido de um membro.")

        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro a alterar.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("apelido")
                .setDescription("Novo apelido. Deixe vazio para remover.")
                .setRequired(false)
                .setMaxLength(32)
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {

        await interaction.deferReply();

        const member = interaction.options.getMember("membro");
        const nickname = interaction.options.getString("apelido") ?? null;

        if (!member) {

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Membro não encontrado no servidor.")]
            });

        }

        if (!member.manageable) {

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Não posso alterar o apelido desse membro (cargo igual/superior ao meu, ou é o dono do servidor).")]
            });

        }

        try {

            await member.setNickname(nickname, `Alterado por ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor(0x30D158)
                .setDescription(
                    nickname
                        ? `✅ Apelido de ${member} alterado para **${nickname}**.`
                        : `✅ Apelido de ${member} removido.`
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Não consegui alterar o apelido.")]
            });

        }

    }

};
