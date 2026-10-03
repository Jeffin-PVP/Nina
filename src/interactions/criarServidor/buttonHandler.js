const {
    PermissionFlagsBits
} = require("discord.js");

const ServerBuilder = require("../../managers/ServerBuilderManager");
const ui = require("../../utils/ui");

/** Atualiza a mensagem do fluxo trocando o conteúdo por um embed e removendo os botões. */
const trocarPorEmbed = (interaction, embed) =>
    interaction.update({ content: null, embeds: [embed], components: [] });

function buildResumoEmbed(sessao, resultado) {

    const embed = ui.panel({
        color: resultado.erros.length ? ui.COLORS.warn : ui.COLORS.success,
        emoji: "server",
        title: "Servidor criado com sucesso!",
        description:
            `<:Nina_engenheira:1552064823976529951> Tudo pronto!\n\n` +
            `${ui.quote(`**Tema/Prompt:** ${ServerBuilder.resumirTexto(sessao.tema)}\n**Segurança reforçada:** ${sessao.segurancaReforcada ? "🔒 Ativada" : "⚪ Desativada"}`)}`,
        fields: [
            ui.field("crown", "Cargos criados", ui.num(resultado.cargosCriados)),
            ui.field("server", "Categorias criadas", ui.num(resultado.categoriasCriadas)),
            ui.field("channel", "Canais criados", ui.num(resultado.canaisCriados))
        ]
    });

    if (resultado.erros.length) {

        const lista = ui.bullets(resultado.erros.slice(0, 6));
        const extra = resultado.erros.length > 6
            ? `\n-# +${resultado.erros.length - 6} outro(s) aviso(s) omitido(s)`
            : "";

        embed.addFields(ui.field("warn", "Avisos durante a criação", ui.clip(`${lista}${extra}`), false));

    }

    return embed;

}

module.exports = {

    async execute(interaction) {

        const [, acao, userId] = interaction.customId.split("_");

        if (interaction.user.id !== userId) {

            return ui.fail(interaction, "Só quem iniciou a criação pode usar este botão.", "Botão bloqueado");

        }

        if (acao === "cancelar") {

            ServerBuilder.encerrarSessao(userId);

            return trocarPorEmbed(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "error",
                title: "Criação cancelada",
                description: "Nada foi alterado no servidor.",
                source: interaction
            }));

        }

        if (acao !== "confirmar") return;

        const sessao = ServerBuilder.getSessao(userId);

        if (!sessao || sessao.guildId !== interaction.guild.id) {

            return trocarPorEmbed(interaction, ui.warn("Essa sessão expirou. Use `/criar-servidor` novamente.", "Sessão expirada", interaction));

        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {

            return trocarPorEmbed(interaction, ui.error("Você precisa ser Administrador para confirmar.", "Sem permissão", interaction));

        }

        ServerBuilder.encerrarSessao(userId);

        await trocarPorEmbed(interaction, ui.panel({
            color: ui.COLORS.info,
            emoji: "config",
            title: "Criando o servidor...",
            description: "Isso pode levar de **10 a 60 segundos**, dependendo do tamanho do servidor.\nNão apague nada enquanto eu trabalho.",
            source: interaction
        }));

        try {

            const resultado = await ServerBuilder.aplicarEstrutura(interaction.guild, sessao);
            const resumoEmbed = buildResumoEmbed(sessao, resultado);

            // A mensagem original é ephemeral (ligada ao token da interação), então
            // continua editável mesmo depois que os canais antigos forem apagados.
            // Ainda assim, se o editReply falhar por algum motivo, tenta postar num
            // canal novo do servidor como último recurso.
            try {

                await interaction.editReply({ content: null, embeds: [resumoEmbed] });

            } catch (editErr) {

                const canalDestino = interaction.guild.channels.cache.find(
                    c => c.isTextBased?.() && c.viewable
                );

                if (canalDestino) await canalDestino.send({ embeds: [resumoEmbed] }).catch(() => {});

            }

            try {

                await interaction.user.send({ embeds: [resumoEmbed] });

            } catch {
                // DMs fechadas, segue sem enviar
            }

        } catch (error) {

            console.error("[Criar Servidor IA] Erro:", error);

            const erroEmbed = ui.error(error.message || "Erro inesperado ao criar o servidor.", "Erro ao criar o servidor");

            try {
                await interaction.editReply({ content: null, embeds: [erroEmbed] });
            } catch {
                // a mensagem original pode ter sumido junto com o canal antigo
            }

        }

    }

};
