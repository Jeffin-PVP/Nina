const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ToolManager = require("../../ai/ToolManager");
const ui = require("../../utils/ui");

const pending = new Map();

function buildToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function prompt(message, { toolName, args, token = buildToken() }) {
    pending.set(token, { toolName, args, userId: message.author?.id || message.member?.id, createdAt: Date.now() });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ai_confirm:${token}:confirm`).setLabel("Confirmar").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ai_confirm:${token}:cancel`).setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
    );

    return message.channel.send({
        content: `⚠️ A IA solicitou a ação **${toolName}**. Confirma a execução?`,
        components: [row]
    });
}

async function execute(interaction) {
    if (!interaction.customId.startsWith("ai_confirm:")) return;

    const [, token, choice] = interaction.customId.split(":");
    const action = pending.get(token);
	require('node:timers').setTimeout(() => pending.delete(token), 5 * 60 * 1000);

    if (!action) {
        return interaction.reply({ content: "Essa confirmação expirou ou já foi processada.", ephemeral: true });
    }

    pending.delete(token);

    if (choice !== "confirm") {
        return interaction.reply({ content: "Ação cancelada pela confirmação.", ephemeral: true });
    }

    try {
        const fakeMessage = {
            guild: interaction.guild,
            member: interaction.member,
            author: interaction.user,
            client: interaction.client,
            channel: interaction.channel
        };

        const result = await ToolManager.execute(action.toolName, fakeMessage, { ...action.args, confirm: true });

        if (!result?.success) {
            return interaction.reply({ embeds: [ui.error(result?.error || "Falha ao executar a ação solicitada.", "Ação não concluída", interaction)], ephemeral: true });
        }

        return interaction.reply({ embeds: [ui.success(`Ação **${action.toolName}** executada com sucesso.`, "Ação confirmada", interaction)], ephemeral: true });
    } catch (error) {
        console.error("[AI confirm]", error);
        return interaction.reply({ embeds: [ui.error("Ocorreu um erro ao confirmar o comando da IA.", "Erro", interaction)], ephemeral: true });
    }
}

module.exports = { prompt, execute };
