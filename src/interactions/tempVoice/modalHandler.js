const TempVoiceRepository = require("../../database/repositories/TempVoiceRepository");
const ui = require("../../utils/ui");
const TempVoiceManager = require("../../managers/TempVoiceManager");

async function execute(interaction) {
    const voice = interaction.member?.voice?.channel;
    const room = voice ? await TempVoiceRepository.getRoom(voice.id) : null;

    const config = await TempVoiceRepository.get(interaction.guild.id);
    if (!room || !TempVoiceManager.canManageRoom(interaction.member, room, config, interaction.customId.endsWith(":rename") ? "rename" : "limit")) {
        return ui.fail(interaction, "Você não tem permissão para alterar esta sala.", "Sem permissão");
    }

    if (interaction.customId === "tempvoice_modal:rename") {
        const raw = interaction.fields.getTextInputValue("name");
        const name = raw.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 95);
        if (!name) return ui.caution(interaction, "Digite um nome válido.", "Nome inválido");

        await voice.setName(`🔊 ${name}`);

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "✏️",
            title: "Sala renomeada",
            description: `O novo nome é **${voice.name}**.`,
            source: interaction
        }), { ephemeral: true });
    }

    if (interaction.customId === "tempvoice_modal:limit") {
        const value = Number.parseInt(interaction.fields.getTextInputValue("limit"), 10);

        if (!Number.isInteger(value) || value < 0 || value > 99) {
            return ui.caution(interaction, "O limite precisa estar entre **0 e 99**.", "Limite inválido");
        }

        await voice.setUserLimit(value);

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "👥",
            title: "Limite atualizado",
            description: value === 0
                ? "A sala agora está sem limite."
                : `A sala agora permite até **${value}** pessoas.`,
            source: interaction
        }), { ephemeral: true });
    }
}

module.exports = { execute };
