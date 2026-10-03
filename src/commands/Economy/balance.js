const { SlashCommandBuilder } = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");
const LevelManager = require("../../managers/LevelManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Mostra seu saldo ou o saldo de outro membro.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Membro para consultar.")
                .setRequired(false)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("usuario") ?? interaction.user;

        const profile = await EconomyManager.getProfile(interaction.guild.id, user.id);

        // Progresso até o próximo nível (XP é acumulado)
        const base = LevelManager.totalXpForLevel(profile.level);
        const need = LevelManager.xpNeededForLevel(profile.level);
        const current = Math.max(0, profile.xp - base);

        const embed = ui.titled(ui.COLORS.economy, "wallet", `Carteira de ${user.displayName ?? user.username}`, null, interaction)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: `${e("coin")} Carteira`, value: ui.money(profile.wallet), inline: true },
                { name: `${e("bank")} Banco`, value: ui.money(profile.bank), inline: true },
                { name: `${e("sparkle")} Patrimônio`, value: ui.money(profile.total), inline: true },
                {
                    name: `${e("star")} Nível ${profile.level}`,
                    value: `\`${ui.bar(current, need, 12)}\` ${ui.num(current)}/${ui.num(need)} XP`
                }
            );

        return interaction.reply({ embeds: [embed] });

    }

};
