const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const symbols = ["💎", "👑", "💰", "🍒", "🍀", "💀"];

const payouts = {
    "💎": 10,
    "👑": 8,
    "💰": 6,
    "🍒": 4,
    "🍀": 3,
    "💀": 0
};

const spin = () => symbols[Math.floor(Math.random() * symbols.length)];

const reels = list => list.join("  ┃  ");

module.exports = {

    cooldown: 5,

    data: new SlashCommandBuilder()
        .setName("slots")
        .setDescription("Jogue no caça-níquel.")
        .addIntegerOption(option =>
            option
                .setName("aposta")
                .setDescription("Quantidade de moedas para apostar.")
                .setRequired(true)
                .setMinValue(100)
        ),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const bet = interaction.options.getInteger("aposta");

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

        const result = [spin(), spin(), spin()];

        const frames = [
            ["⬜", "⬜", "⬜"],
            [result[0], "⬜", "⬜"],
            [result[0], result[1], "⬜"],
            result
        ];

        for (const frame of frames) {

            const embed = ui.titled(
                ui.COLORS.game,
                "slots",
                "Caça-Níquel",
                `${ui.LINE}\n## ${reels(frame)}\n${ui.LINE}\n${e("dice")} Girando...`,
                interaction
            ).setFooter({ text: `Aposta: ${ui.num(bet)} moedas` });

            await interaction.editReply({ embeds: [embed] });

            await new Promise(resolve => setTimeout(resolve, 700));

        }

        const jackpot = result[0] === result[1] && result[1] === result[2];

        let reward = 0;
        let color = ui.COLORS.error;
        let title = "Você perdeu!";
        let icon = "slots";
        let message = `${ui.mood("chorando")} Não foi dessa vez... você perdeu ${ui.money(bet)}.`;

        if (jackpot) {

            const symbol = result[0];

            reward = bet * payouts[symbol];

            if (reward > 0) {

                await EconomyManager.addMoney(guildId, userId, reward);

                color = ui.COLORS.success;
                title = "Você venceu!";
                icon = "trophy";
                message = `${ui.mood("uau")} Três iguais! Você ganhou ${ui.money(reward)} (**x${payouts[symbol]}**)`;

                if (symbol === "💎") {

                    color = ui.COLORS.game;
                    title = "JACKPOT!";
                    icon = "sparkle";
                    message =
                        `${ui.mood("apaixonada")} Incrível! **💎💎💎**\n\n` +
                        `${e("trophy")} Prêmio: ${ui.money(reward)} (**x${payouts[symbol]}**)`;

                }

            }

        }

        const updated = await EconomyManager.getProfile(guildId, userId);

        const embed = ui.titled(
            color,
            icon,
            title,
            `${ui.LINE}\n# ${reels(result)}\n${ui.LINE}\n${message}`,
            interaction
        )
            .addFields({ name: `${e("wallet")} Carteira`, value: ui.money(updated.wallet), inline: true })
            .setFooter({ text: `Aposta: ${ui.num(bet)} moedas • Nina`, iconURL: interaction.client.user.displayAvatarURL() });

        return interaction.editReply({ embeds: [embed] });

    }

};
