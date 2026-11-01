const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const ui = require("../../utils/ui");
const ToolManager = require("../../ai/ToolManager");

const pending = new Map();

function buildId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function prompt(interaction, { title, description, action, payload }) {
    const token = buildId();
    pending.set(token, {
        action,
        guildId: interaction.guild.id,
        payload,
        moderatorId: interaction.user.id
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`modconfirm:${token}:confirm`)
            .setLabel("Confirmar")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`modconfirm:${token}:cancel`)
            .setLabel("Cancelar")
            .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
        .setColor(ui.COLORS.warn)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

    const responsePayload = { embeds: [embed], components: [row], ephemeral: true };
    if (interaction.deferred && !interaction.replied) {
        return interaction.editReply(responsePayload);
    }
    return interaction.reply(responsePayload);
}

async function execute(interaction) {
    if (!interaction.customId.startsWith("modconfirm:")) return;

    const [, token, choice] = interaction.customId.split(":");
    const pendingAction = pending.get(token);

    if (!pendingAction) {
        return interaction.reply({
            embeds: [ui.error("Essa confirmação expirou ou já foi processada.", "Expirada", interaction)],
            ephemeral: true
        });
    }

    pending.delete(token);

    if (choice !== "confirm") {
        return interaction.reply({
            embeds: [ui.info("Ação cancelada com sucesso.", "Cancelado", interaction)],
            ephemeral: true
        });
    }

    try {
        const guild = interaction.guild;
        const fakeMessage = {
            guild,
            member: interaction.member,
            author: interaction.user,
            client: interaction.client,
            channel: interaction.channel
        };

        if (pendingAction.action === "ban") {
            const result = await ToolManager.execute("banMember", fakeMessage, {
                userId: pendingAction.payload.userId,
                reason: pendingAction.payload.reason,
                duration: pendingAction.payload.duration,
                unit: pendingAction.payload.unit,
                deleteMessageSeconds: pendingAction.payload.deleteMessageSeconds ?? 0
            });

            if (!result.success) {
                return interaction.reply({ embeds: [ui.error(result.error, "Falha ao banir", interaction)], ephemeral: true });
            }

            return interaction.reply({
                embeds: [ui.success(`Banimento aplicado com sucesso para <@${pendingAction.payload.userId}>.`, "Banimento confirmado", interaction)],
                ephemeral: true
            });
        }

        if (pendingAction.action === "kick") {
            const result = await ToolManager.execute("kickMember", fakeMessage, {
                userId: pendingAction.payload.userId,
                reason: pendingAction.payload.reason
            });

            if (!result.success) {
                return interaction.reply({ embeds: [ui.error(result.error, "Falha ao expulsar", interaction)], ephemeral: true });
            }

            return interaction.reply({
                embeds: [ui.success(`Expulsão confirmada para <@${pendingAction.payload.userId}>.`, "Expulsão confirmada", interaction)],
                ephemeral: true
            });
        }

        if (pendingAction.action === "timeout") {
            const result = await ToolManager.execute("timeoutMember", fakeMessage, {
                userId: pendingAction.payload.userId,
                duration: pendingAction.payload.duration,
                reason: pendingAction.payload.reason
            });

            if (!result.success) {
                return interaction.reply({ embeds: [ui.error(result.error, "Falha ao aplicar timeout", interaction)], ephemeral: true });
            }

            return interaction.reply({
                embeds: [ui.success(`Timeout aplicado com sucesso para <@${pendingAction.payload.userId}>.`, "Timeout confirmado", interaction)],
                ephemeral: true
            });
        }

        return interaction.reply({ embeds: [ui.error("Ação de confirmação desconhecida.", "Desconhecida", interaction)], ephemeral: true });
    } catch (error) {
        console.error(error);
        return interaction.reply({
            embeds: [ui.error("Ocorreu um erro ao executar a ação confirmada.", "Erro", interaction)],
            ephemeral: true
        });
    }
}

module.exports = { prompt, execute };
