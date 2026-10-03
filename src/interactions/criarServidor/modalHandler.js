const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const ServerBuilder = require("../../managers/ServerBuilderManager");
const ui = require("../../utils/ui");
const { component } = require("../../utils/emojis");

module.exports = {

    async execute(interaction) {

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {

            return ui.fail(interaction, "Você precisa ser Administrador para usar isso.", "Sem permissão");

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

        const embed = ui.panel({
            color: ui.COLORS.error,
            emoji: "server",
            title: "Confirmação: criar servidor com IA",
            description: ui.quote(
                `**Tema/Prompt:** ${ServerBuilder.resumirTexto(sessao.tema)}\n` +
                `**Divisória (categoria):** \`${divisoriaCategoria}\`  •  **Divisória (canal):** \`${divisoriaCanal}\`\n` +
                `**Emojis nos nomes:** ${usarEmojis ? "✅ Sim" : "❌ Não"}  •  **Segurança reforçada:** ${segurancaReforcada ? "🔒 Ativada" : "⚪ Desativada"}`
            ),
            fields: [
                ui.field("warn", "Atenção antes de confirmar",
                    "Ao confirmar, **todos os canais e cargos atuais** deste servidor serão apagados e " +
                    "substituídos por uma nova estrutura gerada por IA. Essa ação **não pode ser desfeita**.", false)
            ],
            footer: "Essa confirmação expira em 5 minutos.",
            source: interaction
        });

        const row = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId(`criarservidor_confirmar_${interaction.user.id}`)
                .setLabel("Confirmar e Criar")
                .setEmoji(component("ok"))
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId(`criarservidor_cancelar_${interaction.user.id}`)
                .setLabel("Cancelar")
                .setEmoji(component("error"))
                .setStyle(ButtonStyle.Secondary)

        );

        return interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });

    }

};
