const {
    SlashCommandBuilder,
    InteractionContextType,
    MessageFlags
} = require("discord.js");

const VoiceRecordingRepository = require("../../database/repositories/VoiceRecordingRepository");
const VoiceRecordingManager = require("../../managers/VoiceRecordingManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("voicepanel")
        .setDescription("Abre o painel de gravação e transcrição da call em que você está.")
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const settings = await VoiceRecordingRepository.get(interaction.guild.id);

        if (!settings.enabled) {
            return interaction.reply({
                content: "A gravação de calls está desativada neste servidor. Um administrador pode ativá-la em `/config`.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (!VoiceRecordingManager.canRecord(interaction.member, settings)) {
            return interaction.reply({
                content: "Você não tem um cargo autorizado a usar a gravação de calls.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (!interaction.member.voice?.channel) {
            return interaction.reply({
                content: "Entre em um canal de voz e use `/voicepanel` novamente.",
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply(await VoiceRecordingManager.buildHome({
            guild: interaction.guild,
            member: interaction.member
        }));
    }
};
