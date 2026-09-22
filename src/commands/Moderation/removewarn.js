const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ToolManager = require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("removewarn")

        .setDescription("Remove uma advertência específica (veja o ID com /warnings).")

        .addIntegerOption(option =>
            option
                .setName("id")
                .setDescription("ID da advertência.")
                .setRequired(true)
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {

        await interaction.deferReply();

        const warningId = interaction.options.getInteger("id");

        try {

            const fakeMessage = {
                guild: interaction.guild,
                member: interaction.member,
                author: interaction.user,
                client: interaction.client,
                channel: interaction.channel
            };

            const result = await ToolManager.execute(
                "removeWarning",
                fakeMessage,
                { warningId }
            );

            if (!result.success) {

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("Red")
                            .setDescription(`❌ ${result.error}`)
                    ]
                });

            }

            const embed = new EmbedBuilder()
                .setColor(0x30D158)
                .setDescription(
                    `✅ Advertência \`#${warningId}\` removida de <@${result.userId}>. Restam **${result.remaining}** advertência(s).`
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setDescription("❌ Ocorreu um erro ao executar o comando.")
                ]
            });

        }

    }

};
