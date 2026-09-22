const { PermissionFlagsBits } = require("discord.js");

const AutomodRepository = require("../database/repositories/AutomodRepository");
const WarningRepository = require("../database/repositories/WarningRepository");
const LogManager = require("./LogManager");
const LogTypes = require("./LogTypes");

// "Executor" usado nos logs pra deixar claro que foi o AutoMod, não um humano
const EXECUTOR_AUTOMOD = { tag: "🤖 AutoMod", username: "AutoMod" };

/*
=========================
    LISTA BÁSICA DE PALAVRÕES (embutida)
=========================
    Propositalmente curta e com termos genéricos (sem xingamentos de ódio/
    discriminatórios) — cada servidor deve completar a lista com
    /automod palavras adicionar de acordo com o que faz sentido pra sua
    comunidade.
*/

const PALAVROES_PADRAO = [
    "porra", "caralho", "merda", "bosta", "cacete", "desgraca",
    "puta", "fdp", "foda-se", "fodase", "arrombado", "cuzao", "otario"
];

/*
=========================
    NORMALIZAÇÃO DE TEXTO (pra pegar tentativas de burlar o filtro)
=========================
*/

function normalizar(texto) {

    return String(texto || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9\s]/g, " ") // pontuação/símbolos viram espaço
        .replace(/(.)\1{2,}/g, "$1$1") // "caraaaaalho" -> "caraalho"
        .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
        .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
        .replace(/\s+/g, " ")
        .trim();

}

function contemPalavrao(conteudo, palavrasCustom) {

    const textoNormalizado = normalizar(conteudo);

    if (!textoNormalizado) return false;

    const lista = [...PALAVROES_PADRAO, ...AutomodRepository.parseLista(palavrasCustom)];

    return lista.some(palavra => {

        const p = normalizar(palavra);

        if (!p) return false;

        return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(textoNormalizado);

    });

}

/*
=========================
    CONTAGEM DE EMOJIS E MENÇÕES
=========================
*/

const REGEX_EMOJI_UNICODE = /\p{Extended_Pictographic}/gu;
const REGEX_EMOJI_CUSTOM = /<a?:\w+:\d+>/g;
const REGEX_INVITE = /(discord\.gg\/|discord(app)?\.com\/invite\/)[a-zA-Z0-9-]+/i;

function contarEmojis(conteudo) {

    const unicode = conteudo.match(REGEX_EMOJI_UNICODE) || [];
    const custom = conteudo.match(REGEX_EMOJI_CUSTOM) || [];

    return unicode.length + custom.length;

}

function contarMencoes(message) {

    let total = message.mentions.users.size + message.mentions.roles.size;

    // não penaliza quem só respondeu a alguém (isso conta como menção também)
    if (message.mentions.repliedUser && message.mentions.users.has(message.mentions.repliedUser.id)) {

        total -= 1;

    }

    return total;

}

/*
=========================
    RASTREAMENTO DE FLOOD (spam de mensagens)
=========================
*/

const historicoFlood = new Map(); // "guildId:userId" -> { timestamps: number[], ultimoConteudo, repeticoes }

function checarFlood(message, config) {

    const chave = `${message.guild.id}:${message.author.id}`;
    const agora = Date.now();
    const janelaMs = config.spam_interval_seconds * 1000;

    const registro = historicoFlood.get(chave) || { timestamps: [], ultimoConteudo: null, repeticoes: 0 };

    registro.timestamps = registro.timestamps.filter(ts => agora - ts < janelaMs);
    registro.timestamps.push(agora);

    const conteudoNormalizado = normalizar(message.content);

    if (conteudoNormalizado && conteudoNormalizado === registro.ultimoConteudo) {

        registro.repeticoes += 1;

    } else {

        registro.ultimoConteudo = conteudoNormalizado;
        registro.repeticoes = 1;

    }

    historicoFlood.set(chave, registro);

    const estourouLimite = registro.timestamps.length > config.spam_max_messages;
    const mensagemRepetida = conteudoNormalizado && registro.repeticoes >= 4;

    if (estourouLimite || mensagemRepetida) {

        // reseta pra não disparar de novo em toda mensagem seguinte
        historicoFlood.set(chave, { timestamps: [], ultimoConteudo: null, repeticoes: 0 });
        return true;

    }

    return false;

}

/*
=========================
    ISENÇÕES (quem o automod NUNCA mexe)
=========================
*/

function estaIsento(message, config) {

    const member = message.member;

    if (!member) return true;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

    const canaisIgnorados = AutomodRepository.parseLista(config.ignored_channels);
    if (canaisIgnorados.includes(message.channel.id)) return true;

    const cargosIgnorados = AutomodRepository.parseLista(config.ignored_roles);
    if (cargosIgnorados.some(id => member.roles.cache.has(id))) return true;

    return false;

}

/*
=========================
    APLICAÇÃO DAS AÇÕES CONFIGURADAS
=========================
*/

async function aplicarAcoes(message, acoesCsv, motivo, duracaoMuteMinutos) {

    const acoes = AutomodRepository.parseLista(acoesCsv);

    if (acoes.includes("delete")) {

        await message.delete().catch(() => {});

    }

    if (acoes.includes("notify")) {

        const aviso = await message.channel.send({
            content: `⚠️ ${message.author}, sua mensagem foi removida pelo AutoMod: **${motivo}**`
        }).catch(() => null);

        if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 7000);

    }

    if (acoes.includes("warn")) {

        await registrarWarn(message, motivo);

    }

    if (acoes.includes("mute")) {

        await aplicarMute(message, duracaoMuteMinutos, motivo);

    }

    await LogManager.send({
        type: LogTypes.AUTOMOD_ACTION,
        guild: message.guild,
        executor: EXECUTOR_AUTOMOD,
        target: { id: message.author.id, username: message.author.username, displayName: message.member?.displayName },
        reason: motivo,
        extra: { channelId: message.channel.id, actions: acoes.join(", ") }
    }).catch(() => {});

}

async function registrarWarn(message, motivo) {

    try {

        await WarningRepository.create({
            guildId: message.guild.id,
            userId: message.author.id,
            moderatorId: message.client.user.id,
            reason: `[AutoMod] ${motivo}`
        });

    } catch (error) {

        console.error("[AutoMod] Falha ao registrar warn:", error);

    }

}

async function aplicarMute(message, minutos, motivo) {

    try {

        const member = message.member;

        if (!member || !member.moderatable) return;

        await member.timeout((minutos || 10) * 60 * 1000, `[AutoMod] ${motivo}`);

    } catch (error) {

        console.error("[AutoMod] Falha ao aplicar mute:", error);

    }

}

/*
=========================
    VERIFICAÇÃO PRINCIPAL DE MENSAGEM
=========================
    Retorna true se a mensagem foi tratada (apagada/penalizada) — quem chamar
    isso deve parar de processar a mensagem (XP, resposta de IA, etc).
*/

async function checkMessage(message) {

    if (!message.guild || message.author.bot) return false;

    const config = await AutomodRepository.get(message.guild.id);

    if (!config.enabled) return false;

    if (estaIsento(message, config)) return false;

    const conteudo = message.content || "";

    // flood sempre atualiza o rastreamento, mesmo que outra regra já tenha disparado
    const flooded = config.spam_enabled ? checarFlood(message, config) : false;

    if (config.swear_enabled && contemPalavrao(conteudo, config.swear_custom_words)) {

        await aplicarAcoes(message, config.swear_actions, "Linguagem imprópria", config.mute_duration_minutes);
        return true;

    }

    if (config.invite_enabled && REGEX_INVITE.test(conteudo)) {

        await aplicarAcoes(message, config.invite_actions, "Link de convite não permitido", config.mute_duration_minutes);
        return true;

    }

    if (config.mention_enabled && contarMencoes(message) > config.mention_max_count) {

        await aplicarAcoes(message, config.mention_actions, "Spam de menções", config.mute_duration_minutes);
        return true;

    }

    if (config.emoji_enabled && contarEmojis(conteudo) > config.emoji_max_count) {

        await aplicarAcoes(message, config.emoji_actions, "Spam de emojis", config.mute_duration_minutes);
        return true;

    }

    if (flooded) {

        await aplicarAcoes(message, config.spam_actions, "Spam de mensagens", config.mute_duration_minutes);
        return true;

    }

    return false;

}

/*
=========================
    ANTI-RAID
=========================
*/

const entradasRecentes = new Map(); // guildId -> { id, ts }[]
const raidAtivo = new Set(); // guildId

async function registrarEntrada(member) {

    const config = await AutomodRepository.get(member.guild.id);

    if (!config.raid_enabled) return;

    const guildId = member.guild.id;
    const agora = Date.now();
    const janelaMs = (config.raid_interval_seconds || 60) * 1000;

    const lista = (entradasRecentes.get(guildId) || []).filter(e => agora - e.ts < janelaMs);
    lista.push({ id: member.id, ts: agora });
    entradasRecentes.set(guildId, lista);

    if (lista.length >= config.raid_join_threshold && !raidAtivo.has(guildId)) {

        raidAtivo.add(guildId);

        await ativarModoRaid(member.guild, config, lista.map(e => e.id));

    }

}

async function ativarModoRaid(guild, config, membrosNaJanela) {

    await LogManager.send({
        type: LogTypes.RAID_DETECTED,
        guild,
        executor: EXECUTOR_AUTOMOD,
        extra: { joins: membrosNaJanela.length, windowSeconds: config.raid_interval_seconds, action: config.raid_action }
    }).catch(() => {});

    if (config.raid_action === "lockdown") {

        await travarServidor(guild);
        return;

    }

    // kick_new / ban_new: age apenas nos membros que dispararam a detecção
    for (const userId of membrosNaJanela) {

        const membro = await guild.members.fetch(userId).catch(() => null);

        if (!membro || !membro.kickable) continue;

        try {

            if (config.raid_action === "ban_new") {

                await membro.ban({ reason: "AutoMod: anti-raid (entrada em massa detectada)" });

            } else {

                await membro.kick("AutoMod: anti-raid (entrada em massa detectada)");

            }

        } catch {
            // segue tentando os próximos
        }

    }

}

async function travarServidor(guild) {

    const botMember = await guild.members.fetchMe();

    const canais = guild.channels.cache.filter(c =>
        c.isTextBased?.() &&
        !c.isThread?.() &&
        c.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageChannels)
    );

    for (const canal of canais.values()) {

        try {

            const overwrite = canal.permissionOverwrites.cache.get(guild.id);
            const jaTrancado = overwrite?.deny.has(PermissionFlagsBits.SendMessages);

            if (jaTrancado) continue;

            await canal.permissionOverwrites.edit(guild.id, { SendMessages: false }, { reason: "AutoMod: lockdown de anti-raid" });
            await AutomodRepository.addRaidLock(guild.id, canal.id);

        } catch {
            // segue tentando os próximos canais
        }

    }

}

async function encerrarModoRaid(guild) {

    const canaisTravados = await AutomodRepository.listRaidLocks(guild.id);
    const botMember = await guild.members.fetchMe();

    let destravados = 0;

    for (const channelId of canaisTravados) {

        const canal = guild.channels.cache.get(channelId);

        if (!canal || !canal.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageChannels)) continue;

        try {

            await canal.permissionOverwrites.edit(guild.id, { SendMessages: null }, { reason: "AutoMod: fim do lockdown de anti-raid" });
            destravados++;

        } catch {
            // segue tentando os próximos
        }

    }

    await AutomodRepository.clearRaidLocks(guild.id);
    raidAtivo.delete(guild.id);
    entradasRecentes.delete(guild.id);

    await LogManager.send({
        type: LogTypes.RAID_LOCKDOWN_LIFT,
        guild,
        executor: EXECUTOR_AUTOMOD,
        extra: { channelsUnlocked: destravados }
    }).catch(() => {});

    return destravados;

}

module.exports = {
    checkMessage,
    registrarEntrada,
    encerrarModoRaid,
    PALAVROES_PADRAO
};
