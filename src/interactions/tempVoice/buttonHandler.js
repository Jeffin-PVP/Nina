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

async function getRoomForUser(interaction) {
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

    if (room.owner_id !== interaction.user.id) {
        await ui.caution(interaction, "Somente o dono da sala pode usar esses controles.", "Sem permissão");
        return null;
    }

    return { room, channel: voice };
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
        const data = await getRoomForUser(interaction);
        if (!data) return;

        const { room, channel } = data;
        const config = await TempVoiceRepository.get(interaction.guild.id);
        if (!TempVoiceManager.canManageRoom(interaction.member, room, config, "lock")) return ui.caution(interaction, "Essa permissão foi desativada para você.", "Sem permissão");
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
        const data = await getRoomForUser(interaction);
        if (!data) return;
        const config = await TempVoiceRepository.get(interaction.guild.id);
        if (!TempVoiceManager.canManageRoom(interaction.member, data.room, config, "rename")) return ui.caution(interaction, "Renomear está desativado para você.", "Sem permissão");

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
        const data = await getRoomForUser(interaction);
        if (!data) return;
        const config = await TempVoiceRepository.get(interaction.guild.id);
        if (!TempVoiceManager.canManageRoom(interaction.member, data.room, config, "limit")) return ui.caution(interaction, "Alterar o limite está desativado para você.", "Sem permissão");

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
        const data = await getRoomForUser(interaction);
        if (!data) return;
        const config = await TempVoiceRepository.get(interaction.guild.id);
        const permission = action === "transfer" ? "transfer" : action === "kick" ? "kick" : "ban";
        if (!TempVoiceManager.canManageRoom(interaction.member, data.room, config, permission)) return ui.caution(interaction, "Essa ação está desativada para você.", "Sem permissão");

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
        const data = await getRoomForUser(interaction);
        if (!data) return;
        const config = await TempVoiceRepository.get(interaction.guild.id);
        if (!TempVoiceManager.canManageRoom(interaction.member, data.room, config, "delete")) return ui.caution(interaction, "Excluir a sala está desativado para você.", "Sem permissão");

        await TempVoiceRepository.removeRoom(data.channel.id);
        await data.channel.delete("Sala temporária excluída pelo dono").catch(() => {});
        return interaction.reply({
            content: "🗑️ Sua sala temporária foi excluída.",
            ephemeral: true
        });
    }
}

module.exports = { execute };
