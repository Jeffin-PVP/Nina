const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const EconomyManager =
    require("../../managers/EconomyManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("balance")

        .setDescription(
            "Mostra seu saldo ou o saldo de outro membro."
        )

        .addUserOption(option =>

            option

                .setName("usuario")

                .setDescription(
                    "Membro para consultar."
                )

                .setRequired(false)

        ),

    async execute(interaction) {

        const user =
            interaction.options.getUser("usuario")
            ?? interaction.user;

        const profile =
            await EconomyManager.getProfile(

                interaction.guild.id,
                user.id

            );

        const embed = new EmbedBuilder()

            .setColor(0x2ecc71)

            .setAuthor({

                name: user.tag,

                iconURL:
                    user.displayAvatarURL()

            })

            .setTitle("💰 Carteira")

            .addFields(

                {

                    name: "💵 Carteira",

                    value:
                        `$${profile.wallet.toLocaleString()}`,

                    inline: true

                },

                {

                    name: "🏦 Banco",

                    value:
                        `$${profile.bank.toLocaleString()}`,

                    inline: true

                },

                {

                    name: "💎 Patrimônio",

                    value:
                        `$${profile.total.toLocaleString()}`,

                    inline: true

                }

            )

            .setFooter({

                text:
                    `Nível ${profile.level} • XP ${profile.xp}`

            });

        await interaction.reply({

            embeds: [

                embed

            ]

        });

    }

};