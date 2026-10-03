const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Transfira moedas para outro membro.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Quem receberá as moedas.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de moedas.")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const sender = interaction.user;
        const receiver = interaction.options.getUser("usuario");
        const amount = interaction.options.getInteger("quantidade");

        if (receiver.bot) {

            return interaction.reply({
                embeds: [ui.error("Você não pode enviar moedas para bots.", "Transferência inválida", interaction)]
            });

        }

        if (receiver.id === sender.id) {

            return interaction.reply({
                embeds: [ui.error("Você não pode enviar moedas para si mesmo.", "Transferência inválida", interaction)]
            });

        }

        const result = await EconomyManager.pay(guildId, sender.id, receiver.id, amount);

        if (!result.success) {

            let message = "Não foi possível realizar a transferência.";

            switch (result.reason) {

                case "insufficient_funds":
                    message = `Você tem apenas ${ui.money(result.wallet)} na carteira.`;
                    break;

                case "invalid_amount":
                    message = "Informe uma quantidade válida.";
                    break;

                case "same_user":
                    message = "Você não pode pagar para si mesmo.";
                    break;

            }

            return interaction.reply({
                embeds: [ui.error(message, "Transferência cancelada", interaction)]
            });

        }

        return interaction.reply({
            embeds: [ui.titled(
                ui.COLORS.success,
                "pay",
                "Transferência realizada",
                `${sender} ${e("pay")} ${receiver}\n` +
                `${e("sparkle")} Valor: ${ui.money(amount)}\n\n` +
                `${e("wallet")} Sua carteira: ${ui.money(result.sender.wallet)}\n` +
                `${e("user")} Carteira de ${receiver.username}: ${ui.money(result.receiver.wallet)}`,
                interaction
            )]
        });

    }

};
