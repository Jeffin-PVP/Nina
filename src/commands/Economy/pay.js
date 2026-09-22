const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("pay")

        .setDescription(
            "Transfira moedas para outro membro."
        )

        .addUserOption(option =>

            option

                .setName("usuario")

                .setDescription(
                    "Quem receberá as moedas."
                )

                .setRequired(true)

        )

        .addIntegerOption(option =>

            option

                .setName("quantidade")

                .setDescription(
                    "Quantidade de moedas."
                )

                .setRequired(true)

                .setMinValue(1)

        ),

    async execute(interaction) {

        const guildId =
            interaction.guild.id;

        const sender =
            interaction.user;

        const receiver =
            interaction.options.getUser(
                "usuario"
            );

        const amount =
            interaction.options.getInteger(
                "quantidade"
            );

        if (receiver.bot) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Transferência inválida"
                        )

                        .setDescription(
                            "Você não pode enviar moedas para bots."
                        )

                ]

            });

        }

        if (receiver.id === sender.id) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Transferência inválida"
                        )

                        .setDescription(
                            "Você não pode enviar moedas para si mesmo."
                        )

                ]

            });

        }

        const result =
            await EconomyManager.pay(

                guildId,

                sender.id,

                receiver.id,

                amount

            );

        if (!result.success) {

            let message =
                "Não foi possível realizar a transferência.";

            switch (result.reason) {

                case "insufficient_funds":

                    message =
                        `Você possui apenas **${result.wallet.toLocaleString("pt-BR")} moedas** na carteira.`;

                    break;

                case "invalid_amount":

                    message =
                        "Informe uma quantidade válida.";

                    break;

                case "same_user":

                    message =
                        "Você não pode pagar para si mesmo.";

                    break;

            }

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "❌ Transferência cancelada"
                        )

                        .setDescription(
                            message
                        )

                ]

            });

        }

        return interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setColor(0x2ecc71)

                    .setTitle(
                        "💸 Transferência realizada"
                    )

                    .setDescription(

                        `Você enviou **${amount.toLocaleString("pt-BR")} moedas** para ${receiver}.\n\n` +

                        `💵 Sua carteira: **${result.sender.wallet.toLocaleString("pt-BR")} moedas**\n` +

                        `👤 Carteira de ${receiver.username}: **${result.receiver.wallet.toLocaleString("pt-BR")} moedas**`

                    )

                    .setTimestamp()

            ]

        });

    }

};