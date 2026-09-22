const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("deposit")

        .setDescription(
            "Deposita moedas no banco."
        )

        .addIntegerOption(option =>

            option

                .setName("quantidade")

                .setDescription(
                    "Quantidade de moedas"
                )

                .setRequired(true)

                .setMinValue(1)

        ),

    async execute(interaction) {

        const guildId =
            interaction.guild.id;

        const userId =
            interaction.user.id;

        const amount =
            interaction.options.getInteger(
                "quantidade"
            );

        const profile =
            await EconomyManager.getProfile(
                guildId,
                userId
            );

        if (profile.wallet < amount) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Saldo insuficiente"
                        )

                        .setDescription(

                            `Você possui apenas **${profile.wallet.toLocaleString("pt-BR")} moedas** na carteira.`

                        )

                ]

            });

        }

        await EconomyManager.deposit(

            guildId,

            userId,

            amount

        );

        const updated =
            await EconomyManager.getProfile(

                guildId,

                userId

            );

        return interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setColor(0x2ecc71)

                    .setTitle(
                        "🏦 Depósito realizado"
                    )

                    .setDescription(

                        `Você depositou **${amount.toLocaleString("pt-BR")} moedas**.\n\n` +

                        `💵 Carteira: **${updated.wallet.toLocaleString("pt-BR")}**\n` +

                        `🏦 Banco: **${updated.bank.toLocaleString("pt-BR")}**`

                    )

                    .setTimestamp()

            ]

        });

    }

};