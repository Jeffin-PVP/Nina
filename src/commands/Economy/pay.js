const { E } = require("../../config/emojiRegistry");
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");
const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const PENDING_TIMEOUT = 120_000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Transfira Níqueis para outro usuário globalmente.")
        .addUserOption(option => option
            .setName("usuario")
            .setDescription("Quem receberá os Níqueis.")
            .setRequired(true))
        .addIntegerOption(option => option
            .setName("quantidade")
            .setDescription("Quantidade de Níqueis.")
            .setRequired(true)
            .setMinValue(1)),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const sender = interaction.user;
        const receiver = interaction.options.getUser("usuario");
        const amount = interaction.options.getInteger("quantidade");

        if (receiver.bot) {
            return interaction.reply({ embeds: [ui.error("Você não pode enviar Níqueis para bots.", "Transferência inválida", interaction)], ephemeral: true });
        }
        if (receiver.id === sender.id) {
            return interaction.reply({ embeds: [ui.error("Você não pode enviar Níqueis para si mesmo.", "Transferência inválida", interaction)], ephemeral: true });
        }

        const profile = await EconomyManager.getProfile(guildId, sender.id);
        if (profile.wallet < amount) {
            return interaction.reply({ embeds: [ui.error(`Seu saldo atual é ${ui.money(profile.wallet)}.`, "Saldo insuficiente", interaction)], ephemeral: true });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId("nina_pay_confirm")
            .setLabel("Confirmar transferência")
            .setStyle(ButtonStyle.Success)
            .setEmoji(E("ui_check"));
        const rejectButton = new ButtonBuilder()
            .setCustomId("nina_pay_reject")
            .setLabel("Recusar / cancelar")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(`${E("ui_cancel")}️`);

        const row = new ActionRowBuilder().addComponents(confirmButton, rejectButton);
        const embed = ui.titled(
            ui.COLORS.economy,
            "pay",
            "Confirmação de transferência",
            `${sender} quer enviar **${amount.toLocaleString("pt-BR")} Níqueis** para ${receiver}.\n\n` +
            `${e("user")} **Quem envia:** ${sender} — precisa confirmar.\n` +
            `${e("gift")} **Quem recebe:** ${receiver} — também precisa confirmar.\n\n` +
            `O saldo só será alterado quando **os dois confirmarem**. Esta proposta expira em 2 minutos.`,
            interaction
        );

        await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        const message = await interaction.fetchReply();
        const confirmed = new Set();
        const collector = message.createMessageComponentCollector({ time: PENDING_TIMEOUT });
        let finished = false;
        let finalizing = false;

        const finish = async (content) => {
            if (finished) return;
            finished = true;
            collector.stop("finished");
            await message.edit({ content, components: [] }).catch(() => {});
        };

        collector.on("collect", async buttonInteraction => {
            const actorId = buttonInteraction.user.id;
            if (actorId !== sender.id && actorId !== receiver.id) {
                return buttonInteraction.reply({ content: "Só quem envia ou recebe pode confirmar esta transferência.", ephemeral: true });
            }
            if (finished) {
                return buttonInteraction.reply({ content: "Esta proposta já foi encerrada.", ephemeral: true });
            }

            if (buttonInteraction.customId === "nina_pay_reject") {
                await buttonInteraction.deferUpdate();
                const who = actorId === sender.id ? "Quem enviaria" : "Quem receberia";
                return finish(`${E("ui_cancel")} Transferência recusada/cancelada por ${who.toLowerCase()}. Nenhum saldo foi alterado.`);
            }

            if (buttonInteraction.customId !== "nina_pay_confirm") return;
            if (confirmed.has(actorId)) {
                return buttonInteraction.reply({ content: "Você já confirmou. Falta a outra pessoa.", ephemeral: true });
            }

            confirmed.add(actorId);
            await buttonInteraction.deferUpdate();

            if (confirmed.size < 2) {
                const remaining = actorId === sender.id ? receiver : sender;
                await message.edit({
                    embeds: [ui.titled(
                        ui.COLORS.economy, "clock", "Aguardando confirmação",
                        `${sender} quer enviar **${amount.toLocaleString("pt-BR")} Níqueis** para ${receiver}.\n\n` +
                        `✅ ${actorId === sender.id ? "Quem envia" : "Quem recebe"} confirmou.\n` +
                        `${E("ui_timedout")} Falta ${remaining}.\n\nO saldo ainda não foi alterado.`, interaction
                    )],
                    components: [row]
                }).catch(() => {});
                return;
            }

            // Impede que os dois eventos de confirmação executem o pagamento em duplicidade.
            if (finalizing) return;
            finalizing = true;

            // A chamada revalida o saldo e conclui o débito/crédito em uma transação SQLite.
            try {
                const result = await EconomyManager.pay(guildId, sender.id, receiver.id, amount);
                if (!result.success) {
                    const reason = result.reason === "insufficient_funds"
                        ? `Saldo insuficiente no momento da confirmação. Saldo atual: ${ui.money(result.wallet)}.`
                        : "Não foi possível concluir a transferência. Nenhum valor foi transferido.";
                    return finish(`${E("warn")} ${reason}`);
                }
                return finish(`${E("ui_check")} Transferência concluída! ${sender} enviou ${ui.money(amount)} para ${receiver}.`);
            } catch (error) {
                console.error("Erro ao concluir transferência global de Níqueis:", error);
                return finish(`${E("warn")} Ocorreu um erro ao concluir a transferência. Confira o saldo antes de tentar novamente.`);
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "finished" && !finished) {
                finished = true;
                await message.edit({ content: "⌛ A proposta expirou. Nenhum saldo foi alterado.", components: [] }).catch(() => {});
            }
        });
    }
};
