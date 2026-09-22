const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("withdraw")

        .setDescription(
            "Saca moedas do banco."
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

        if (profile.bank < amount) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Saldo insuficiente"
                        )

                        .setDescription(

                            `Você possui apenas **${profile.bank.toLocaleString("pt-BR")} moedas** no banco.`

                        )

                ]

            });

        }

        await EconomyManager.withdraw(

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

                    .setColor(0x3498db)

                    .setTitle(
                        "💸 Saque realizado"
                    )

                    .setDescription(

                        `Você sacou **${amount.toLocaleString("pt-BR")} moedas**.\n\n` +

                        `💵 Carteira: **${updated.wallet.toLocaleString("pt-BR")}**\n` +

                        `🏦 Banco: **${updated.bank.toLocaleString("pt-BR")}**`

                    )

                    .setTimestamp()

            ]

        });

    }

};