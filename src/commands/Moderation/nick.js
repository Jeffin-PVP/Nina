const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

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
                embeds: [ui.error("Membro não encontrado no servidor.", undefined, interaction)]
            });

        }

        if (!member.manageable) {

            return interaction.editReply({
                embeds: [ui.error("Não posso alterar o apelido desse membro (cargo igual/superior ao meu, ou é o dono do servidor).", undefined, interaction)]
            });

        }

        try {

            await member.setNickname(nickname, `Alterado por ${interaction.user.tag}`);

            const embed = ui.success(
                nickname
                    ? `Apelido de ${member} alterado para **${nickname}**.`
                    : `Apelido de ${member} removido.`,
                "Apelido atualizado",
                interaction
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({
                embeds: [ui.error("Não consegui alterar o apelido.", undefined, interaction)]
            });

        }

    }

};
