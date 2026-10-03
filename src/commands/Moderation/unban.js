const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

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
                    ui.error("Isso não parece um ID de usuário válido. Use `/banlist` para conferir.", undefined, interaction)
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
                        ui.error(result.error, undefined, interaction)
                    ]
                });

            }

            const embed = ui.modEmbed({
                emoji: "unban",
                title: "Usuário desbanido",
                color: ui.COLORS.success,
                moderator: interaction.user,
                reason,
                fields: [{ name: `${e("user")} Usuário`, value: `<@${userId}>\n\`${userId}\``, inline: true }],
                source: interaction
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({
                embeds: [
                    ui.error("Ocorreu um erro ao executar o comando.", undefined, interaction)
                ]
            });

        }

    }

};
