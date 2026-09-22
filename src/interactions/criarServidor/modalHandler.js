const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const ServerBuilder = require("../../managers/ServerBuilderManager");

module.exports = {

    async execute(interaction) {

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {

            return interaction.reply({
                content: "❌ Você precisa ser Administrador para usar isso.",
                flags: MessageFlags.Ephemeral
            });

        }

        const tema = interaction.fields.getTextInputValue("tema").trim();

        const divisoriaCategoria = ServerBuilder.sanitizarDivisorCategoria(
            interaction.fields.getTextInputValue("divisoria_categoria")
        );

        const divisoriaCanal = ServerBuilder.sanitizarDivisorCanal(
            interaction.fields.getTextInputValue("divisoria_canal")
        );

        const usarEmojis = ServerBuilder.parseSimNao(interaction.fields.getTextInputValue("emoji"));
        const segurancaReforcada = ServerBuilder.parseSimNao(interaction.fields.getTextInputValue("seguranca_reforcada"));

        const sessao = ServerBuilder.criarSessao(interaction.user.id, {
            tema,
            divisoriaCategoria,
            divisoriaCanal,
            usarEmojis,
            segurancaReforcada,
            guildId: interaction.guild.id
        });

        const embed = new EmbedBuilder()

            .setColor("#ED4245")

            .setTitle("🧭 Confirmação — Criar Servidor com IA")

            .setDescription(
                `> **Tema/Prompt:** ${ServerBuilder.resumirTexto(sessao.tema)}\n` +
                `> **Divisória (Categoria):** \`${divisoriaCategoria}\`  •  **Divisória (Canal):** \`${divisoriaCanal}\`\n` +
                `> **Emojis nos nomes:** ${usarEmojis ? "✅ Sim" : "❌ Não"}  •  **Segurança Reforçada:** ${segurancaReforcada ? "🔒 Ativada" : "⚪ Desativada"}`
            )

            .addFields({
                name: "⚠️ Atenção antes de confirmar",
                value: "Ao confirmar, **todos os canais e cargos atuais** deste servidor serão apagados e " +
                    "substituídos por uma nova estrutura gerada por IA. Essa ação **não pode ser desfeita**."
            })

            .setFooter({ text: "Essa confirmação expira em 5 minutos." });

        const row = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId(`criarservidor_confirmar_${interaction.user.id}`)
                .setLabel("Confirmar e Criar")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId(`criarservidor_cancelar_${interaction.user.id}`)
                .setLabel("Cancelar")
                .setEmoji("✖️")
                .setStyle(ButtonStyle.Secondary)

        );

        return interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });

    }

};
