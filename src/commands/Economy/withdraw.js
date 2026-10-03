const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("withdraw")
        .setDescription("Saca moedas do banco.")
        .addIntegerOption(option =>
            option
                .setName("quantidade")
                .setDescription("Quantidade de moedas")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const amount = interaction.options.getInteger("quantidade");

        const profile = await EconomyManager.getProfile(guildId, userId);

        if (profile.bank < amount) {

            return interaction.reply({
                embeds: [ui.error(
                    `Você tem apenas ${ui.money(profile.bank)} no banco.`,
                    "Saldo insuficiente",
                    interaction
                )]
            });

        }

        await EconomyManager.withdraw(guildId, userId, amount);

        const updated = await EconomyManager.getProfile(guildId, userId);

        return interaction.reply({
            embeds: [ui.titled(
                ui.COLORS.info,
                "withdraw",
                "Saque realizado",
                `Você sacou ${ui.money(amount)} do banco.\n\n` +
                `${e("wallet")} Carteira: ${ui.money(updated.wallet)}\n` +
                `${e("bank")} Banco: ${ui.money(updated.bank)}`,
                interaction
            )]
        });

    }

};
