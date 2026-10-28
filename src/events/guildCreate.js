const { E } = require("../config/emojiRegistry");
const {
    Events,
    EmbedBuilder
} = require("discord.js");

const { encontrarCanalDeAnuncio } = require("../utils/findAnnounceChannel");
const BannedGuildRepository = require("../database/repositories/BannedGuildRepository");
const NativeAutomodSync = require("../managers/NativeAutomodSync");

/*
=========================
    EMBED DE APRESENTAÇÃO
=========================
*/

function buildEmbedApresentacao(guild) {

    return new EmbedBuilder()

        .setColor("#5865F2")

        .setAuthor({
            name: "Nina",
            iconURL: guild.client.user.displayAvatarURL()
        })

        .setTitle(`${E("aceno")} Olá, ${guild.name}!`)

        .setDescription(
            "Obrigada por me adicionar! Eu sou a **Nina**, uma assistente inteligente para Discord " +
            "criada por **JeffinPVP**.\n\n" +
            "Converse comigo mencionando `@Nina` em qualquer canal ou explore meus recursos:"
        )

        .addFields(

            {
                name: "🛡️ Moderação",
                value: "Ban, kick, timeout, avisos, canais trancados e muito mais.",
                inline: true
            },

            {
                name: "🎭 Cargos automáticos",
                value: "Auto-role de entrada, self-role e cargos por nível.",
                inline: true
            },

            {
                name: "🎫 Tickets",
                value: "Sistema completo de atendimento por tickets.",
                inline: true
            },

            {
                name: "💰 Economia",
                value: "Moedas, trabalho, diária, apostas e ranking.",
                inline: true
            },

            {
                name: "📜 Logs",
                value: "Registro de tudo que acontece no servidor.",
                inline: true
            },

            {
                name: "🏗️ Criar Servidor com IA",
                value: "Use `/criar-servidor` para gerar uma estrutura completa do zero.",
                inline: true
            },

            {
                name: "🔊 Temp-Voice",
                value: "cria canais de voz temporários automaticamente.",
                inline: true
            },

            {
                name: "🍯 HoneyPot",
                value: "Sistema de armadilhas para detectar e punir usuários mal-intencionados.",
                inline: true
            }

        )

        .addFields({
            name: "⚙️ Primeiros passos",
            value: "Use `/config` para ver e ajustar minhas configurações neste servidor."
        })

        .setThumbnail(guild.client.user.displayAvatarURL())

        .setFooter({ text: "Nina • Desenvolvida por JeffinPVP" })

        .setTimestamp();

}

module.exports = {

    name: Events.GuildCreate,

    async execute(guild) {

        console.log(`✔ Entrei em um novo servidor: ${guild.name} (${guild.id})`);

        // Servidor banido pelo dono via dashboard: sai na hora, sem anunciar nada
        const banido = await BannedGuildRepository.isBanned(guild.id).catch(() => false);

        if (banido) {

            console.log(`🚫 Servidor "${guild.name}" está banido — saindo automaticamente.`);
            await guild.leave().catch(() => {});
            return;

        }

        // Cria as regras nativas de AutoMod do Discord no servidor novo
        NativeAutomodSync.schedule(guild.id);

        try {

            const canal = await encontrarCanalDeAnuncio(guild);

            if (!canal) {

                console.log(`⚠️ Nenhum canal disponível para anunciar a chegada em "${guild.name}".`);
                return;

            }

            await canal.send({ embeds: [buildEmbedApresentacao(guild)] });

        } catch (error) {

            console.error(`❌ Falha ao enviar mensagem de boas-vindas em "${guild.name}":`, error);

        }

    }

};
