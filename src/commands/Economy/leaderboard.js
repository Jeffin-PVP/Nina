const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("leaderboard")

        .setDescription(
            "Mostra os usuários mais ricos do servidor."
        ),

    async execute(interaction) {

        const guildId =
            interaction.guild.id;

        const ranking =
            await EconomyManager.getLeaderboard(
                guildId,
                10
            );

        if (!ranking.length) {

            return interaction.reply({

                embeds: [

                    new EmbedBuilder()

                        .setColor(0xe74c3c)

                        .setTitle(
                            "🏆 Ranking"
                        )

                        .setDescription(
                            "Ainda não há usuários na economia."
                        )

                ]

            });

        }

        const medals = [

            "🥇",

            "🥈",

            "🥉"

        ];

        let description = "";

        let position = 1;

        for (const user of ranking) {

            const member =
                await interaction.guild.members
                    .fetch(user.user_id)
                    .catch(() => null);

            if (!member)
                continue;

            const icon =
                medals[position - 1] ??
                `**${position}.**`;

            description +=

                `${icon} ${member.user.username} (${member.id})\n` +

                `💵 Carteira: **${user.wallet.toLocaleString("pt-BR")}**\n` +

                `🏦 Banco: **${user.bank.toLocaleString("pt-BR")}**\n` +

                `💰 Total: **${user.total.toLocaleString("pt-BR")}**\n\n`;

            position++;

        }

        if (!description.length) {

            description =
                "Nenhum usuário encontrado.";

        }

        return interaction.reply({

            embeds: [

                new EmbedBuilder()

                    .setColor(0xf1c40f)

                    .setTitle(
                        "🏆 Ranking Econômico"
                    )

                    .setDescription(
                        description
                    )

                    .setFooter({

                        text:
                            `${interaction.guild.name}`

                    })

                    .setTimestamp()

            ]

        });

    }

};