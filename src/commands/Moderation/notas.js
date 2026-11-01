const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const ModerationRepository = require("../../database/repositories/ModerationRepository");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("notas")
        .setDescription("Consulta ou adiciona notas internas da staff sobre um membro.")
        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro para consultar ou registrar nota.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("texto")
                .setDescription("Texto da nota interna (opcional). Se não for enviado, a command apenas consulta.")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser("membro");
            const noteText = interaction.options.getString("texto");

            if (noteText && noteText.trim()) {
                await ModerationRepository.addNote({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    moderatorId: interaction.user.id,
                    note: noteText.trim()
                });

                const embed = new EmbedBuilder()
                    .setColor(ui.COLORS.success)
                    .setTitle("📝 Nota registrada")
                    .setDescription(`Nota adicionada para **${targetUser.tag}**.`)
                    .setFooter({ text: `Registrado por ${interaction.user.tag}` });

                return interaction.editReply({ embeds: [embed] });
            }

            const notes = await ModerationRepository.getUserNotes({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            const embed = new EmbedBuilder()
                .setColor(ui.COLORS.info)
                .setTitle(`📝 Notas internas • ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setDescription(`**${notes.length}** nota(s) registrada(s) pela staff.`)
                .setFooter({ text: `Servidor: ${interaction.guild.name}` });

            if (!notes.length) {
                embed.addFields({
                    name: "📌 Notas",
                    value: "Nenhuma nota interna para este membro."
                });
            } else {
                embed.addFields({
                    name: "📌 Histórico",
                    value: notes.map((noteItem, index) => `**${index + 1}.** <@${noteItem.moderator_id}>\n> ${noteItem.note}`).join("\n\n")
                });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return interaction.editReply({
                embeds: [ui.error("Ocorreu um erro ao acessar as notas do membro.", undefined, interaction)]
            });
        }
    }
};
