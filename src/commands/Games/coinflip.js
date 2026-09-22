const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    cooldown: 5,

    data: new SlashCommandBuilder()

        .setName("coinflip")

        .setDescription(
            "Aposte cara ou coroa."
        )

        .addIntegerOption(option =>

            option

                .setName("aposta")

                .setDescription(
                    "Quantidade de moedas."
                )

                .setRequired(true)

                .setMinValue(100)

        )

        .addStringOption(option =>

            option

                .setName("escolha")

                .setDescription(
                    "Cara ou Coroa."
                )

                .setRequired(true)

                .addChoices(

                    {

                        name: "Cara",

                        value: "cara"

                    },

                    {

                        name: "Coroa",

                        value: "coroa"

                    }

                )

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

        const choice =
            interaction.options.getString(
                "escolha"
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
                const animation = [

            "🪙",

            "⚪",

            "🟡",

            "⚪",

            "🟡",

            "🪙"

        ];

        for (const frame of animation) {

            const embed =
                new EmbedBuilder()

                    .setColor(0xf1c40f)

                    .setTitle(
                        "🪙 Cara ou Coroa"
                    )

                    .setDescription(

                        "## Lançando a moeda...\n\n" +

                        `${frame}`

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

                    350

                )

            );

        }

        const result =

            Math.random() < 0.5

                ? "cara"

                : "coroa";

        const win =
            result === choice;

        let color;

        let title;

        let description;

        if (win) {

            const reward =
                bet * 2;

            await EconomyManager.addMoney(

                guildId,

                userId,

                reward

            );

            color = 0x2ecc71;

            title = "🎉 Você venceu!";

            description =

                `## 🪙 ${result.toUpperCase()}\n\n` +

                `Você apostou em **${choice.toUpperCase()}** e acertou!\n\n` +

                `💰 Você recebeu **${reward.toLocaleString("pt-BR")} moedas**.`;

        } else {

            color = 0xe74c3c;

            title = "😢 Você perdeu!";

            description =

                `## 🪙 ${result.toUpperCase()}\n\n` +

                `Você apostou em **${choice.toUpperCase()}**.\n\n` +

                `💸 Você perdeu **${bet.toLocaleString("pt-BR")} moedas**.`;

        }

        const updated =
            await EconomyManager.getProfile(

                guildId,

                userId

            );

        const embed =
            new EmbedBuilder()

                .setColor(color)

                .setTitle(title)

                .setDescription(

                    description +

                    `\n\n💵 Carteira: **${updated.wallet.toLocaleString("pt-BR")} moedas**`

                )

                .setTimestamp();

        return interaction.editReply({

            embeds: [embed]

        });

    }

};