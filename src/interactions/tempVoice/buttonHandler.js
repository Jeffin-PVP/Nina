const {
    PermissionFlagsBits,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    ActionRowBuilder
} = require("discord.js");

const TempVoiceRepository = require("../../database/repositories/TempVoiceRepository");
const TempVoiceManager = require("../../managers/TempVoiceManager");
const ui = require("../../utils/ui");

async function getRoomForUser(interaction, action = null) {
    const voice = interaction.member?.voice?.channel;
    if (!voice) {
        await ui.fail(interaction, "Entre na sua sala temporária primeiro.", "Nenhuma sala");
        return null;
    }

    const room = await TempVoiceRepository.getRoom(voice.id);
    if (!room) {
        await ui.fail(interaction, "Seu canal de voz atual não é uma sala temporária da Nina.", "Temp Voice");
        return null;
    }

    const config = await TempVoiceRepository.get(interaction.guild.id);
    if (action && !TempVoiceManager.canManageRoom(interaction.member, room, config, action)) {
        await ui.caution(interaction, "Você não tem permissão para executar essa ação nesta sala.", "Sem permissão");
        return null;
    }

    return { room, channel: voice, config };
}

function selectRow(customId, placeholder) {
    return new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(1)
    );
}

async function execute(interaction) {
    const action = interaction.customId.split(":")[1];

    if (action === "lock") {
        const data = await getRoomForUser(interaction, "lock");
        if (!data) return;

        const { room, channel } = data;
        const locked = !!room.locked;

        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            Connect: locked
        });
        await TempVoiceRepository.setRoom(channel.id, { locked: locked ? 0 : 1 });

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: locked ? "🔓" : "🔒",
            title: locked ? "Sala desbloqueada" : "Sala bloqueada",
            description: locked ? "Outros membros podem entrar novamente." : "Novos membros não podem entrar.",
            source: interaction
        }), { ephemeral: true });
    }

    if (action === "rename") {
        const data = await getRoomForUser(interaction, "rename");
        if (!data) return;

        const modal = new ModalBuilder()
            .setCustomId("tempvoice_modal:rename")
            .setTitle("Renomear sala");

        const input = new TextInputBuilder()
            .setCustomId("name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(90)
            .setValue(data.channel.name.replace(/^🔊\s*/, ""));

        modal.addLabelComponents(
            new LabelBuilder().setLabel("Nome da sala").setTextInputComponent(input)
        );

        return interaction.showModal(modal);
    }

    if (action === "limit") {
        const data = await getRoomForUser(interaction, "limit");
        if (!data) return;

        const modal = new ModalBuilder()
            .setCustomId("tempvoice_modal:limit")
            .setTitle("Limite de membros");

        const input = new TextInputBuilder()
            .setCustomId("limit")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2)
            .setPlaceholder("0 = sem limite")
            .setValue(String(data.channel.userLimit || 0));

        modal.addLabelComponents(
            new LabelBuilder().setLabel("Limite (0 a 99)").setTextInputComponent(input)
        );

        return interaction.showModal(modal);
    }

    if (action === "kick" || action === "ban" || action === "unban" || action === "transfer") {
        const permission = action === "transfer" ? "transfer" : action === "kick" ? "kick" : "ban";
        const data = await getRoomForUser(interaction, permission);
        if (!data) return;


        const configs = {
            kick: ["tempvoice_select:kick", "Selecione quem será expulso"],
            ban: ["tempvoice_select:ban", "Selecione quem será bloqueado"],
            unban: ["tempvoice_select:unban", "Selecione quem será desbloqueado"],
            transfer: ["tempvoice_select:transfer", "Selecione o novo dono"]
        };

        const [customId, placeholder] = configs[action];

        return interaction.reply({
            content: action === "transfer"
                ? "Selecione um membro que esteja na sua sala para transferir a propriedade."
                : "Selecione um membro para continuar.",
            components: [selectRow(customId, placeholder)],
            ephemeral: true
        });
    }

    if (action === "delete") {
        const data = await getRoomForUser(interaction, "delete");
        if (!data) return;
        await TempVoiceRepository.removeRoom(data.channel.id);
        await data.channel.delete("Sala temporária excluída pelo dono").catch(() => {});
        return interaction.reply({
            content: "🗑️ Sua sala temporária foi excluída.",
            ephemeral: true
        });
    }
}

module.exports = { execute };
