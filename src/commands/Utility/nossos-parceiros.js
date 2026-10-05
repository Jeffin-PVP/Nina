const path = require("path");
const {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

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

        const inicio = Date.now();

        try {

            // Evita deixar "Calculando..." preso no Discord
            await interaction.deferReply();

            // Latência aproximada entre Discord -> bot -> resposta
            const roundtrip = Date.now() - inicio;

            // Latência da conexão WebSocket com o Discord
            const api = Math.max(
                0,
                Math.round(interaction.client.ws.ping)
            );

            const latencia = Math.max(roundtrip, api);
            const q = quality(latencia);

            // Imagem localizada em:
            // Nina/assets/injectCloud.png
            const imagemPath = path.resolve(
                __dirname,
                "../../../assets/injectCloud.png"
            );

            const imagem = new AttachmentBuilder(imagemPath, {
                name: "injectCloud.png"
            });

            const embed = new EmbedBuilder()
                .setColor(q.color)
                .setTitle(`${e("ping")}  Pong!`)
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
                .setImage("attachment://injectCloud.png")
                .setTimestamp();

            return interaction.editReply({
                content: "",
                embeds: [embed],
                files: [imagem]
            });

        } catch (error) {

            console.error("❌ [PING] Erro:", error);

            // Se a interação já foi respondida/adiada,
            // tenta mostrar o erro nela mesma.
            try {

                if (interaction.deferred || interaction.replied) {

                    return interaction.editReply({
                        content: `❌ Não consegui finalizar o \`/ping\`.\n\`${error.message}\``,
                        embeds: [],
                        files: []
                    });

                }

                return interaction.reply({
                    content: `❌ Erro no \`/ping\`: \`${error.message}\``,
                    ephemeral: true
                });

            } catch (erroResposta) {

                console.error(
                    "❌ [PING] Também não consegui enviar o erro:",
                    erroResposta
                );

            }

        }

    }

};