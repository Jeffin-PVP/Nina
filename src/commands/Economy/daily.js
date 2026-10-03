const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const EconomyManager = require("../../managers/EconomyManager");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const DAILY_AMOUNT = 100;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {

    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Receba sua recompensa diária."),

    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const profile = await EconomyManager.getProfile(guildId, userId);

        const now = Date.now();
        const remaining = (profile.daily_at || 0) + DAILY_COOLDOWN - now;

        if (remaining > 0) {

            const embed = ui.titled(
                ui.COLORS.warn,
                "clock",
                "Daily indisponível",
                `${ui.mood("entediada")} Você já coletou hoje!\n\n` +
                `Volte ${ui.ts(now + remaining)} (**${ui.duration(remaining)}**).\n` +
                `\`${ui.bar(DAILY_COOLDOWN - remaining, DAILY_COOLDOWN, 12)}\``,
                interaction
            );

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        await EconomyManager.addCoins(guildId, userId, DAILY_AMOUNT, "Daily");
        await EconomyManager.updateDaily(guildId, userId, now);

        const updated = await EconomyManager.getProfile(guildId, userId);

        const embed = ui.titled(
            ui.COLORS.success,
            "gift",
            "Daily resgatado!",
            `${ui.mood("feliz")} Você recebeu ${ui.money(DAILY_AMOUNT)}!\n\n` +
            `${e("wallet")} Carteira: ${ui.money(updated.wallet)}`,
            interaction
        ).setThumbnail(interaction.user.displayAvatarURL({ size: 128 }));

        embed.addFields({ name: `${e("calendar")} Próximo daily`, value: ui.ts(now + DAILY_COOLDOWN), inline: true });

        return interaction.reply({ embeds: [embed] });

    }

};
