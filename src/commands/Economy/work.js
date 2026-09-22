const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const WORK_COOLDOWN = 60 * 60 * 1000; // 1 hora

const jobs = [

    {
        name: "Programador",
        min: 250,
        max: 300
    },

    {
        name: "Entregador",
        min: 50,
        max: 100
    },

    {
        name: "Minerador",
        min: 200,
        max: 450
    },

    {
        name: "Policial",
        min: 200,
        max: 450
    },

    {
        name: "Mecânico",
        min: 25,
        max: 250
    },

    {
        name: "Fazendeiro",
        min: 150,
        max: 250
    },

    {
        name: "Streamer",
        min: 100,
        max: 500
    },

    {
        name: "Caçador de recompensas",
        min: 400,
        max: 800
    }

];

module.exports = {

    data: new SlashCommandBuilder()

        .setName("work")

        .setDescription(
            "Trabalhe para ganhar moedas."
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
            (profile.work_at || 0) +
            WORK_COOLDOWN -
            now;

        if (remaining > 0) {

            const minutes =
                Math.floor(
                    remaining / 60000
                );

            const seconds =
                Math.floor(
                    (remaining % 60000) / 1000
                );

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xff9900)

                        .setTitle(
                            "💼 Você já trabalhou!"
                        )

                        .setDescription(

                            `Você poderá trabalhar novamente em **${minutes}m ${seconds}s**.`

                        )

                ],

                flags: MessageFlags.Ephemeral

            });

        }

        const job =
            jobs[
                Math.floor(
                    Math.random() *
                    jobs.length
                )
            ];

        const reward =

            Math.floor(

                Math.random() *

                (job.max - job.min + 1)

            ) + job.min;

        await EconomyManager.addCoins(

            guildId,

            userId,

            reward,

            `Work (${job.name})`

        );

        await EconomyManager.updateWork(

            guildId,

            userId,

            now

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
                        "💼 Trabalho concluído!"
                    )

                    .setDescription(

                        `Você trabalhou como **${job.name}**.\n\n` +

                        `💰 Ganhou **${reward.toLocaleString("pt-BR")} moedas**.\n\n` +

                        `💵 Carteira: **${updated.coins.toLocaleString("pt-BR")} moedas**`

                    )

                    .setTimestamp()

            ]

        });

    }

};