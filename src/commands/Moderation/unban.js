const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ToolManager = require("../../ai/ToolManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("unban")

        .setDescription("Remove o banimento de um usuário.")

        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("ID do usuário banido (use /banlist para ver os IDs).")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo do desbanimento.")
                .setRequired(false)
        )

        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {

        await interaction.deferReply();

        const userId = interaction.options.getString("id").trim();
        const reason = interaction.options.getString("motivo") ?? "Nenhum motivo informado.";

        if (!/^\d{15,25}$/.test(userId)) {

            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setDescription("❌ Isso não parece um ID de usuário válido. Use `/banlist` para conferir.")
                ]
            });

        }

        try {

            const fakeMessage = {
                guild: interaction.guild,
                member: interaction.member,
                author: interaction.user,
                client: interaction.client,
                channel: interaction.channel
            };

            const result = await ToolManager.execute(
                "unbanMember",
                fakeMessage,
                { userId, reason }
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
                .setTitle("🔓 Usuário Desbanido")
                .addFields(
                    { name: "👤 Usuário", value: `\`${userId}\`` },
                    { name: "🛡️ Moderador", value: interaction.user.tag },
                    { name: "📝 Motivo", value: reason }
                )
                .setTimestamp();

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
