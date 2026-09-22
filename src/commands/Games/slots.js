const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

const symbols = [

    "💎",
    "👑",
    "💰",
    "🍒",
    "🍀",
    "💀"

];

const payouts = {

    "💎": 10,

    "👑": 8,

    "💰": 6,

    "🍒": 4,

    "🍀": 3,

    "💀": 0

};

module.exports = {

    cooldown: 5,

    data: new SlashCommandBuilder()

        .setName("slots")

        .setDescription(
            "Jogue no caça-níquel."
        )

        .addIntegerOption(option =>

            option

                .setName("aposta")

                .setDescription(
                    "Quantidade de moedas para apostar."
                )

                .setRequired(true)

                .setMinValue(100)

        ),

    async execute(interaction) {

        const guildId =
            interaction.guild.id;

        const userId =
            interaction.user.id;

        const bet =
            interaction.options.getInteger(
                "aposta"
            );

        const profile =
            await EconomyManager.getProfile(

                guildId,

                userId

            );

        if (profile.wallet < bet) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Saldo insuficiente"
                        )

                        .setDescription(

                            `Você possui apenas **${profile.wallet.toLocaleString("pt-BR")} moedas**.`

                        )

                ]

            });

        }

        await EconomyManager.removeMoney(

            guildId,

            userId,

            bet

        );

        await interaction.deferReply();

        const result = [

            symbols[
                Math.floor(
                    Math.random() *
                    symbols.length
                )
            ],

            symbols[
                Math.floor(
                    Math.random() *
                    symbols.length
                )
            ],

            symbols[
                Math.floor(
                    Math.random() *
                    symbols.length
                )
            ]

        ];
                const frames = [

            ["⬜", "⬜", "⬜"],

            [
                result[0],
                "⬜",
                "⬜"
            ],

            [
                result[0],
                result[1],
                "⬜"
            ],

            result

        ];

        for (const frame of frames) {

            const embed =
                new EmbedBuilder()

                    .setColor(0xf1c40f)

                    .setTitle(
                        "🎰 Caça-Níquel"
                    )

                    .setDescription(

                        "### 🎲 Girando...\n\n" +

                        `## ${frame.join(" │ ")}`

                    )

                    .setFooter({

                        text:
                            `Aposta: ${bet.toLocaleString("pt-BR")} moedas`

                    });

            await interaction.editReply({

                embeds: [embed]

            });

            await new Promise(resolve =>

                setTimeout(

                    resolve,

                    700

                )

            );

        }

        const jackpot =

            result[0] === result[1] &&

            result[1] === result[2];
                    let reward = 0;

        let color = 0xe74c3c;

        let title = "😢 Você perdeu!";

        let message =
            `Você perdeu **${bet.toLocaleString("pt-BR")} moedas**.`;


        if (jackpot) {

            const symbol = result[0];

            const multiplier =
                payouts[symbol];

            reward =
                bet * multiplier;

            if (reward > 0) {

                await EconomyManager.addMoney(

                    guildId,

                    userId,

                    reward

                );

                color = 0x2ecc71;

                title = "🎉 Você venceu!";

                message =
                    `Você ganhou **${reward.toLocaleString("pt-BR")} moedas!**`;

                if (symbol === "💎") {

                    color = 0x9b59b6;

                    title = "💎 JACKPOT! 💎";

                    message =
                        `✨ Incrível!\n\n` +

                        `Você conseguiu **💎💎💎**!\n\n` +

                        `🏆 Prêmio: **${reward.toLocaleString("pt-BR")} moedas**`;

                }

            }

        }

        const profileUpdated =
            await EconomyManager.getProfile(

                guildId,

                userId

            );

        const embed =
            new EmbedBuilder()

                .setColor(color)

                .setTitle(title)

                .setDescription(

                    `# ${result.join(" │ ")}\n\n` +

                    `${message}\n\n` +

                    `💵 Carteira: **${profileUpdated.wallet.toLocaleString("pt-BR")} moedas**`

                )

                .setFooter({

                    text:
                        `Aposta: ${bet.toLocaleString("pt-BR")} moedas`

                })

                .setTimestamp();

        return interaction.editReply({

            embeds: [embed]

        });

    }

};