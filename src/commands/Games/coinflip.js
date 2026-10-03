const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const FRAMES = ["🪙", "⚪", "🟡", "⚪", "🟡", "🪙"];

module.exports = {

    cooldown: 5,

    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Aposte cara ou coroa.")
        .addIntegerOption(option =>
            option
                .setName("aposta")
                .setDescription("Quantidade de moedas.")
                .setRequired(true)
                .setMinValue(100)
        )
        .addStringOption(option =>
            option
                .setName("escolha")
                .setDescription("Cara ou Coroa.")
                .setRequired(true)
                .addChoices(
                    { name: "Cara", value: "cara" },
                    { name: "Coroa", value: "coroa" }
                )
        ),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const bet = interaction.options.getInteger("aposta");
        const choice = interaction.options.getString("escolha");

        const profile = await EconomyManager.getProfile(guildId, userId);

        if (profile.wallet < bet) {

            return interaction.reply({
                embeds: [ui.error(
                    `Você tem apenas ${ui.money(profile.wallet)} na carteira.`,
                    "Saldo insuficiente",
                    interaction
                )]
            });

        }

        await EconomyManager.removeMoney(guildId, userId, bet);

        await interaction.deferReply();

        for (const frame of FRAMES) {

            const embed = ui.titled(
                ui.COLORS.game,
                "coin",
                "Cara ou Coroa",
                `## ${frame}\n${ui.mood("piscando")} Lançando a moeda...\n\n` +
                `Você escolheu **${choice.toUpperCase()}**`,
                interaction
            ).setFooter({ text: `Aposta: ${ui.num(bet)} moedas` });

            await interaction.editReply({ embeds: [embed] });

            await new Promise(resolve => setTimeout(resolve, 350));

        }

        const result = Math.random() < 0.5 ? "cara" : "coroa";
        const win = result === choice;

        let embed;

        if (win) {

            const reward = bet * 2;

            await EconomyManager.addMoney(guildId, userId, reward);

            embed = ui.titled(
                ui.COLORS.success,
                "trophy",
                "Você venceu!",
                `## ${e("coin")} ${result.toUpperCase()}\n` +
                `${ui.mood("uau")} Você apostou em **${choice.toUpperCase()}** e acertou!\n\n` +
                `${e("pay")} Prêmio: ${ui.money(reward)}`,
                interaction
            );

        } else {

            embed = ui.titled(
                ui.COLORS.error,
                "coin",
                "Você perdeu!",
                `## ${e("coin")} ${result.toUpperCase()}\n` +
                `${ui.mood("triste")} Você apostou em **${choice.toUpperCase()}**.\n\n` +
                `${e("withdraw")} Perdeu: ${ui.money(bet)}`,
                interaction
            );

        }

        const updated = await EconomyManager.getProfile(guildId, userId);

        embed.addFields({ name: `${e("wallet")} Carteira`, value: ui.money(updated.wallet), inline: true });
        embed.setFooter({ text: `Aposta: ${ui.num(bet)} moedas • Nina`, iconURL: interaction.client.user.displayAvatarURL() });

        return interaction.editReply({ embeds: [embed] });

    }

};
