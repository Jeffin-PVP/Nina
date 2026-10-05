const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const imagem = new AttachmentBuilder("./assets/injectCloud.png", {
    name: "injectCloud.png"
});

function quality(ms) {

    if (ms < 120) {
        return {
            label: "Excelente",
            color: ui.COLORS.success,
            dot: "🟢"
        };
    }

    if (ms < 250) {
        return {
            label: "Boa",
            color: ui.COLORS.warn,
            dot: "🟡"
        };
    }

    return {
        label: "Lenta",
        color: ui.COLORS.error,
        dot: "🔴"
    };
}

module.exports = {

    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Mostra a latência da Nina."),

    async execute(interaction) {

        const sent = await interaction.reply({
            content: `${e("ping")} Calculando...`,
            fetchReply: true
        });

        const roundtrip =
            sent.createdTimestamp - interaction.createdTimestamp;

        const api = Math.max(
            0,
            Math.round(interaction.client.ws.ping)
        );

        const q = quality(Math.max(roundtrip, api));

        const embed = ui.titled(
            q.color,
            "ping",
            "Pong!",
            null,
            interaction
        )
            .setDescription(
                `${ui.mood("oi")} Estou online! Conexão **${q.label}** ${q.dot}`
            )
            .addFields(
                {
                    name: `${e("sparkle")} Mensagem`,
                    value: `\`${roundtrip}ms\``,
                    inline: true
                },
                {
                    name: `${e("ping")} API`,
                    value: `\`${api}ms\``,
                    inline: true
                },
                {
                    name: `${e("clock")} Online há`,
                    value: `\`${ui.duration(interaction.client.uptime)}\``,
                    inline: true
                }
            )
            .setImage("attachment://injectCloud.png");

        return interaction.editReply({
            content: null,
            embeds: [embed],
            files: [imagem]
        });

    }

};