const {
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js");

const ServerBuilder = require("../../managers/ServerBuilderManager");

function buildResumoEmbed(sessao, resultado) {

    const embed = new EmbedBuilder()

        .setColor(resultado.erros.length ? "#FEE75C" : "#57F287")

        .setTitle("<:Nina_engenheira:1552064823976529951> Servidor criado com sucesso!")

        .setDescription(
            `> **Tema/Prompt:** ${ServerBuilder.resumirTexto(sessao.tema)}\n` +
            `> **Segurança Reforçada:** ${sessao.segurancaReforcada ? "🔒 Ativada" : "⚪ Desativada"}`
        )

        .addFields(
            { name: "👑 Cargos criados", value: `${resultado.cargosCriados}`, inline: true },
            { name: "🗂️ Categorias criadas", value: `${resultado.categoriasCriadas}`, inline: true },
            { name: "💬 Canais criados", value: `${resultado.canaisCriados}`, inline: true }
        );

    if (resultado.erros.length) {

        const lista = resultado.erros.slice(0, 6).map(e => `- ${e}`).join("\n");
        const extra = resultado.erros.length > 6
            ? `\n-# +${resultado.erros.length - 6} outro(s) aviso(s) omitido(s)`
            : "";

        embed.addFields({
            name: "⚠️ Avisos durante a criação",
            value: `${lista}${extra}`
        });

    }

    return embed;

}

module.exports = {

    async execute(interaction) {

        const [, acao, userId] = interaction.customId.split("_");

        if (interaction.user.id !== userId) {

            return interaction.reply({
                content: "❌ Só quem iniciou a criação pode usar este botão.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (acao === "cancelar") {

            ServerBuilder.encerrarSessao(userId);

            return interaction.update({
                content: "❎ Criação cancelada.",
                embeds: [],
                components: []
            });

        }

        if (acao !== "confirmar") return;

        const sessao = ServerBuilder.getSessao(userId);

        if (!sessao || sessao.guildId !== interaction.guild.id) {

            return interaction.update({
                content: "❌ Essa sessão expirou. Use `/criar-servidor` novamente.",
                embeds: [],
                components: []
            });

        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {

            return interaction.update({
                content: "❌ Você precisa ser Administrador para confirmar.",
                embeds: [],
                components: []
            });

        }

        ServerBuilder.encerrarSessao(userId);

        await interaction.update({
            content: "🛠️ Criando o servidor... Isso pode levar de 10 a 60 segundos dependendo do tamanho do servidor.",
            embeds: [],
            components: []
        });

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

            const erroEmbed = new EmbedBuilder()
                .setColor("#ED4245")
                .setTitle("❌ Erro ao criar o servidor")
                .setDescription(error.message || "Erro inesperado ao criar o servidor.");

            try {
                await interaction.editReply({ content: null, embeds: [erroEmbed] });
            } catch {
                // a mensagem original pode ter sumido junto com o canal antigo
            }

        }

    }

};
