const {
    PermissionFlagsBits
} = require("discord.js");

const TempVoiceRepository = require("../../database/repositories/TempVoiceRepository");
const TempVoiceManager = require("../../managers/TempVoiceManager");
const ui = require("../../utils/ui");

async function execute(interaction) {
    const action = interaction.customId.split(":")[1];
    const voice = interaction.member?.voice?.channel;
    const room = voice ? await TempVoiceRepository.getRoom(voice.id) : null;

    const config = await TempVoiceRepository.get(interaction.guild.id);
    const permission = action === "transfer" ? "transfer" : action === "kick" ? "kick" : "ban";
    if (!room || !TempVoiceManager.canManageRoom(interaction.member, room, config, permission)) {
        return ui.fail(interaction, "Você não tem permissão para usar esta ação nesta sala.", "Sem permissão");
    }

    const targetId = interaction.values[0];
    const target = await interaction.guild.members.fetch(targetId).catch(() => null);

    if (!target || target.user.bot) {
        return ui.fail(interaction, "Não encontrei um membro válido.", "Membro inválido");
    }

    if (action === "kick") {
        if (!voice.members.has(target.id)) {
            return ui.caution(interaction, "Esse membro não está na sua sala.", "Nada a fazer");
        }

        await target.voice.setChannel(null, "Expulso pelo dono da sala temporária").catch(() => {});

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "👢",
            title: "Membro expulso",
            description: `<@${target.id}> foi removido da sala.`,
            source: interaction
        }), { ephemeral: true });
    }

    if (action === "ban") {
        await TempVoiceRepository.banUser(voice.id, interaction.guild.id, target.id);

        await voice.permissionOverwrites.edit(target.id, {
            ViewChannel: true,
            Connect: false
        }).catch(() => {});

        if (target.voice.channelId === voice.id) {
            await target.voice.setChannel(null, "Bloqueado pelo dono da sala temporária").catch(() => {});
        }

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "🚫",
            title: "Membro bloqueado",
            description: `<@${target.id}> não poderá entrar nesta sala enquanto estiver bloqueado.`,
            source: interaction
        }), { ephemeral: true });
    }

    if (action === "unban") {
        await TempVoiceRepository.unbanUser(voice.id, target.id);
        await voice.permissionOverwrites.delete(target.id).catch(() => {});

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "🔓",
            title: "Membro desbloqueado",
            description: `<@${target.id}> pode entrar novamente, desde que a sala esteja aberta.`,
            source: interaction
        }), { ephemeral: true });
    }

    if (action === "transfer") {
        if (!voice.members.has(target.id)) {
            return ui.caution(interaction, "O novo dono precisa estar na sua sala.", "Transferência");
        }

        await voice.permissionOverwrites.delete(interaction.user.id).catch(() => {});

        await voice.permissionOverwrites.edit(target.id, {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            ManageChannels: true,
            MoveMembers: true,
            MuteMembers: true,
            DeafenMembers: true
        });

        await TempVoiceRepository.setRoom(voice.id, { owner_id: target.id });

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "👑",
            title: "Propriedade transferida",
            description: `Agora <@${target.id}> é o dono da sala.`,
            source: interaction
        }), { ephemeral: true });
    }
}

module.exports = { execute };
