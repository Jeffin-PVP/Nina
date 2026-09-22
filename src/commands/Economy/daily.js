const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const DAILY_AMOUNT = 100;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {

    data: new SlashCommandBuilder()

        .setName("daily")

        .setDescription(
            "Receba sua recompensa diária."
        ),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const profile =
            await EconomyManager.getProfile(
                guildId,
                userId
            );

        const now = Date.now();

        const remaining =
            (profile.daily_at || 0) +
            DAILY_COOLDOWN -
            now;

        if (remaining > 0) {

            const hours =
                Math.floor(
                    remaining / 3600000
                );

            const minutes =
                Math.floor(
                    (remaining % 3600000) / 60000
                );

            const embed =
                new EmbedBuilder()

                    .setColor(0xff9900)

                    .setTitle(
                        "⏳ Daily indisponível"
                    )

                    .setDescription(

                        `Você já coletou sua recompensa hoje.\n\n` +

                        `Volte em **${hours}h ${minutes}min**.`

                    );

            return interaction.reply({

                embeds: [embed],

                flags: MessageFlags.Ephemeral

            });

        }

        await EconomyManager.addCoins(

            guildId,

            userId,

            DAILY_AMOUNT,

            "Daily"

        );

        await EconomyManager.updateDaily(

            guildId,

            userId,

            now

        );

        const updated =
            await EconomyManager.getProfile(

                guildId,

                userId

            );

        const embed =
            new EmbedBuilder()

                .setColor(0x2ecc71)

                .setTitle(
                    "🎁 Daily resgatado!"
                )

                .setDescription(

                    `Você recebeu **${DAILY_AMOUNT.toLocaleString("pt-BR")} moedas**!\n\n` +

                    `💰 Carteira: **${updated.coins.toLocaleString("pt-BR")}**`

                )

                .setFooter({

                    text:
                        "Volte amanhã para coletar novamente."

                })

                .setTimestamp();

        return interaction.reply({

            embeds: [embed]

        });

    }

};