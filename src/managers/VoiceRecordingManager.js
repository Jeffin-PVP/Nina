const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
    EndBehavior
} = require("@discordjs/voice");

const VoiceRecordingRepository = require("../database/repositories/VoiceRecordingRepository");
const RecordingApi = require("../services/RecordingService");
const ui = require("../utils/ui");

/*
=========================
    GRAVAÇÃO DE CALLS
=========================
Fluxo de áudio (nada vai para disco):

  Discord (Opus) → memória da Nina (buffer pequeno) → API de IA
                                                   ou Groq (Whisper), sem RECORDING_API_URL

- O buffer é esvaziado a cada FLUSH_INTERVAL_MS (ou quando passa de FLUSH_BYTES).
- Se a API ficar fora do ar, os pacotes ficam na RAM até MAX_BUFFER_BYTES;
  passando disso a gravação é encerrada para não estourar a memória do host.
- Só metadados (quem, quando, canal, status) ficam no SQLite.
*/

const TIMEZONE = process.env.NINA_TIMEZONE || "America/Sao_Paulo";

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_BYTES = 256 * 1024;
const MAX_BUFFER_BYTES = Number(process.env.RECORDING_MAX_BUFFER_MB || 48) * 1024 * 1024;
const SILENCE_MS = 800;
const EMPTY_CHANNEL_GRACE_MS = 30_000;
const FINAL_FLUSH_ATTEMPTS = 3;

// Limite de upload por anexo, conforme o nível de boost do servidor.
const ATTACHMENT_LIMITS = { 0: 10, 1: 10, 2: 50, 3: 100 };

const RECORDABLE_TYPES = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

/** guildId → sessão ativa */
const sessions = new Map();

let clientRef = null;

/*
=========================
    REGRAS (funções puras)
=========================
*/

function isManager(member) {
    return Boolean(
        member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)
    );
}

/** Administradores/Gerenciar Servidor sempre podem; os demais precisam de um cargo liberado. */
function canRecord(member, settings) {
    if (!member) return false;
    if (isManager(member)) return true;

    const allowed = settings.allowed_role_ids || [];
    if (!allowed.length) return false;

    const roles = member.roles?.cache;
    return allowed.some(roleId => roles?.has?.(roleId));
}

/** Retorna { ok, reason }. */
function channelStatus(channel, settings) {
    if (!channel || !RECORDABLE_TYPES.has(channel.type)) {
        return { ok: false, reason: "Este tipo de canal não pode ser gravado." };
    }

    if ((settings.blocked_channel_ids || []).includes(channel.id)) {
        return { ok: false, reason: "Este canal está bloqueado para gravação." };
    }

    const allowed = settings.allowed_channel_ids || [];
    if (allowed.length && !allowed.includes(channel.id)) {
        return { ok: false, reason: "Este canal não está na lista de canais liberados para gravação." };
    }

    return { ok: true, reason: null };
}

/** Converte data/hora para "dd/mm/aaaa hh:mm:ss" no fuso configurado. */
function formatDateTime(value, timeZone = TIMEZONE) {
    const parts = new Intl.DateTimeFormat("pt-BR", {
        timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(value));

    const get = type => parts.find(part => part.type === type)?.value || "00";
    return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
    if (m) return `${m}min ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
}

function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
}

function oneLine(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Monta o .txt da transcrição: ordem cronológica, com data e hora, e para cada
 * fala o nome público, o nickname e o ID de quem falou.
 */
function buildTranscriptText({ recording, guildName, segments }) {
    const people = new Map(recording.participants.map(p => [String(p.id), p]));

    const lines = [...segments]
        .filter(segment => oneLine(segment.text))
        .map(segment => ({
            at: recording.started_at + Number(segment.start_ms || 0),
            userId: String(segment.user_id),
            text: oneLine(segment.text)
        }))
        .sort((a, b) => a.at - b.at);

    const header = [
        "TRANSCRIÇÃO DE CALL — NINA",
        "════════════════════════════════════════",
        `Servidor: ${guildName} (${recording.guild_id})`,
        `Canal: ${recording.channel_name || "—"} (${recording.channel_id})`,
        `Início: ${formatDateTime(recording.started_at)}`,
        `Fim: ${recording.ended_at ? formatDateTime(recording.ended_at) : "—"}`,
        `Duração: ${formatDuration(recording.duration_ms || 0)}`,
        `Gravação iniciada por: ${recording.started_by_name || "—"} (${recording.started_by})`,
        `Participantes: ${recording.participants.length}`,
        `Fuso horário: ${TIMEZONE}`,
        "════════════════════════════════════════",
        ""
    ];

    const body = lines.map(line => {
        const person = people.get(line.userId);
        const publicName = person?.globalName || person?.username || "Usuário desconhecido";
        const nickname = person?.nickname || "—";
        return `[${formatDateTime(line.at)}] ${publicName} | Nickname: ${nickname} | ID: ${line.userId}\n    ${line.text}`;
    });

    if (!body.length) body.push("(Nenhuma fala foi identificada nesta gravação.)");

    return `${header.join("\n")}${body.join("\n\n")}\n`;
}

/*
=========================
    SESSÃO ATIVA
=========================
*/

function snapshotParticipant(session, userId) {
    if (session.participants.has(userId)) return;

    const member = session.guild.members.cache.get(userId);
    const user = member?.user || clientRef?.users?.cache?.get(userId);

    session.participants.set(userId, {
        id: userId,
        username: user?.username || null,
        globalName: user?.globalName || null,
        nickname: member?.nickname || null
    });

    // Se o membro não estava em cache, completa os dados em segundo plano.
    if (!member) {
        session.guild.members.fetch(userId).then(fetched => {
            session.participants.set(userId, {
                id: userId,
                username: fetched.user.username,
                globalName: fetched.user.globalName || null,
                nickname: fetched.nickname || null
            });
        }).catch(() => {});
    }
}

function subscribeUser(session, userId) {
    if (session.stopping) return;

    const user = clientRef?.users?.cache?.get(userId);
    if (user?.bot) return;

    let track = session.tracks.get(userId);

    if (!track) {
        track = { packets: [], bytes: 0, stream: null };
        session.tracks.set(userId, track);
    }

    if (track.stream) return;

    snapshotParticipant(session, userId);

    const stream = session.connection.receiver.subscribe(userId, {
        end: { behavior: EndBehavior.AfterSilence, duration: SILENCE_MS }
    });

    track.stream = stream;

    stream.on("data", chunk => {
        if (session.stopping) return;

        track.packets.push({ t: Date.now() - session.startedAt, data: Buffer.from(chunk) });
        track.bytes += chunk.length;
        session.bufferedBytes += chunk.length;

        if (session.bufferedBytes > MAX_BUFFER_BYTES) {
            stop(session.guild.id, "buffer").catch(() => {});
        } else if (track.bytes >= FLUSH_BYTES) {
            flush(session).catch(() => {});
        }
    });

    const release = () => {
        if (track.stream === stream) track.stream = null;
    };

    stream.once("end", release);
    stream.once("close", release);
    stream.once("error", error => {
        console.error(`[Gravação] Erro no stream de ${userId}:`, error.message);
        release();
    });
}

/** Envia o que está no buffer. Em caso de falha, devolve os pacotes ao buffer. */
async function flush(session) {
    if (session.flushing) return true;
    session.flushing = true;

    let allOk = true;

    try {
        for (const [userId, track] of session.tracks) {
            if (!track.packets.length) continue;

            const batch = track.packets;
            const batchBytes = track.bytes;

            track.packets = [];
            track.bytes = 0;

            try {
                await RecordingApi.uploadChunk(session.remoteId, userId, batch);
                session.bufferedBytes = Math.max(0, session.bufferedBytes - batchBytes);
                session.uploadedBytes += batchBytes;
            } catch (error) {
                allOk = false;
                // Mantém a ordem cronológica: o lote antigo volta na frente.
                track.packets = batch.concat(track.packets);
                track.bytes += batchBytes;
                console.error(`[Gravação] Falha ao enviar áudio (${session.guild.id}):`, error.message);
            }
        }
    } finally {
        session.flushing = false;
    }

    return allOk;
}

async function announce(session, content) {
    try {
        await session.channel.send({ content, allowedMentions: { parse: [] } });
        return true;
    } catch {
        return false;
    }
}

/*
=========================
    INICIAR / PARAR
=========================
*/

function getSession(guildId) {
    return sessions.get(guildId) || null;
}

/**
 * Inicia a gravação do canal de voz onde o membro está.
 * Retorna { ok: true, recordingId, announced } ou { ok: false, error }.
 */
async function start({ guild, member, channel }) {
    const settings = await VoiceRecordingRepository.get(guild.id);

    if (!settings.enabled) return { ok: false, error: "A gravação de calls está desativada neste servidor." };
    if (!RecordingApi.isConfigured()) return { ok: false, error: "O serviço de gravação ainda não foi configurado pelo dono da Nina." };
    if (!canRecord(member, settings)) return { ok: false, error: "Você não tem um cargo autorizado a gravar calls." };

    const status = channelStatus(channel, settings);
    if (!status.ok) return { ok: false, error: status.reason };

    if (sessions.has(guild.id)) {
        return { ok: false, error: "Já existe uma gravação em andamento neste servidor." };
    }

    const existingConnection = guild.members.me?.voice?.channelId;
    if (existingConnection && existingConnection !== channel.id) {
        return { ok: false, error: "A Nina já está em outro canal de voz deste servidor." };
    }

    const me = guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
        return { ok: false, error: "Não tenho permissão para ver e entrar neste canal de voz." };
    }

    // Reserva o slot antes de qualquer await para evitar duas gravações simultâneas.
    const session = {
        guild,
        channel,
        startedAt: Date.now(),
        startedBy: member.id,
        tracks: new Map(),
        participants: new Map(),
        bufferedBytes: 0,
        uploadedBytes: 0,
        flushing: false,
        stopping: false,
        connection: null,
        remoteId: null,
        recordingId: null,
        timers: []
    };

    sessions.set(guild.id, session);

    try {
        const remote = await RecordingApi.createSession({
            guildId: guild.id,
            channelId: channel.id,
            channelName: channel.name,
            startedAt: session.startedAt
        });

        if (!remote?.id) throw new Error("A API não devolveu o ID da gravação.");
        session.remoteId = String(remote.id);

        session.recordingId = await VoiceRecordingRepository.create({
            guildId: guild.id,
            channelId: channel.id,
            channelName: channel.name,
            startedBy: member.id,
            startedByName: member.displayName || member.user.username,
            startedAt: session.startedAt,
            remoteId: session.remoteId
        });

        session.connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
        console.error(`[Gravação] Falha ao iniciar em ${guild.id}:`, error.message);
        await abort(session);
        return { ok: false, error: "Não consegui iniciar a gravação agora. Tente de novo em instantes." };
    }

    const { receiver } = session.connection;
    receiver.speaking.on("start", userId => subscribeUser(session, userId));

    // Reconexão curta; se não voltar, encerra e salva o que já foi enviado.
    session.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(session.connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(session.connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
        } catch {
            stop(guild.id, "disconnected").catch(() => {});
        }
    });

    session.timers.push(setInterval(() => {
        if (session.bufferedBytes > 0) flush(session).catch(() => {});
    }, FLUSH_INTERVAL_MS));

    session.timers.push(setTimeout(() => {
        stop(guild.id, "max_duration").catch(() => {});
    }, settings.max_minutes * 60_000));

    // Aviso de gravação no chat do canal de voz (transparência com os participantes).
    const keepsAudio = RecordingApi.supportsAudio(session.remoteId);

    const announced = await announce(
        session,
        `🔴 **Esta call está sendo gravada** por ${member.displayName || member.user.username} ` +
        `(limite de ${settings.max_minutes} min). ` +
        (keepsAudio
            ? "O áudio e a transcrição ficam disponíveis para a equipe autorizada deste servidor. "
            : "A fala é transcrita por IA e só o texto fica disponível para a equipe autorizada deste servidor; o áudio não é guardado. ") +
        "Se não concorda, saia do canal."
    );

    session.announced = announced;

    console.log(`[Gravação] Iniciada em ${guild.id}#${channel.id} por ${member.id}`);

    return { ok: true, recordingId: session.recordingId, announced };
}

/** Desfaz uma sessão que falhou antes de começar de fato. */
async function abort(session) {
    sessions.delete(session.guild.id);
    clearTimers(session);

    try { session.connection?.destroy(); } catch { /* já destruída */ }

    if (session.remoteId) await RecordingApi.remove(session.remoteId).catch(() => {});
    if (session.recordingId) await VoiceRecordingRepository.remove(session.guild.id, session.recordingId).catch(() => {});
}

function clearTimers(session) {
    for (const timer of session.timers) {
        clearInterval(timer);
        clearTimeout(timer);
    }
    session.timers = [];
    if (session.emptyTimer) clearTimeout(session.emptyTimer);
}

const STOP_MESSAGES = {
    manual: null,
    max_duration: "⏱️ A gravação atingiu o tempo máximo e foi encerrada.",
    empty: "⚪ A gravação foi encerrada porque a call ficou vazia.",
    disconnected: "⚠️ A Nina perdeu a conexão com o canal e a gravação foi encerrada.",
    buffer: "⚠️ A gravação foi encerrada porque o serviço de áudio ficou indisponível."
};

/** Encerra a gravação, envia o que restou e fecha a sessão na API. */
async function stop(guildId, reason = "manual") {
    const session = sessions.get(guildId);
    if (!session || session.stopping) return { ok: false, error: "Não há gravação em andamento." };

    session.stopping = true;
    clearTimers(session);

    for (const track of session.tracks.values()) {
        try { track.stream?.destroy(); } catch { /* já fechado */ }
    }

    try { session.connection?.destroy(); } catch { /* já destruída */ }

    const endedAt = Date.now();

    // Envio final com tentativas: é a última chance de não perder o áudio restante.
    for (let attempt = 1; attempt <= FINAL_FLUSH_ATTEMPTS; attempt++) {
        if (await flush(session)) break;
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }

    const participants = [...session.participants.values()];
    let status = "processing";

    try {
        await RecordingApi.finish(session.remoteId, { endedAt, participants });
    } catch (error) {
        console.error(`[Gravação] Falha ao finalizar na API (${guildId}):`, error.message);
        status = "failed";
    }

    await VoiceRecordingRepository.patch(guildId, session.recordingId, {
        ended_at: endedAt,
        duration_ms: endedAt - session.startedAt,
        size_bytes: session.uploadedBytes,
        participants,
        status,
        // Com a transcrição direto no Groq ela já roda durante a gravação.
        ...(status !== "failed" && RecordingApi.autoTranscribes(session.remoteId) ? { transcript_status: "pending" } : {})
    });

    sessions.delete(guildId);

    const note = STOP_MESSAGES[reason];
    await announce(session, `⏹️ **Gravação encerrada.**${note ? `\n${note}` : ""}`);

    console.log(`[Gravação] Encerrada em ${guildId} (${reason}), status ${status}`);

    return { ok: status !== "failed", recordingId: session.recordingId, status, reason };
}

/*
=========================
    EVENTOS DE VOZ
=========================
*/

function humansIn(channel) {
    return channel?.members?.filter?.(m => !m.user.bot).size ?? 0;
}

/** Chamado pelo evento voiceStateUpdate (antes do filtro de bots). */
function handleVoiceStateUpdate(oldState, newState) {
    const guildId = (newState.guild || oldState.guild)?.id;
    const session = sessions.get(guildId);
    if (!session || session.stopping) return;

    const botId = clientRef?.user?.id;

    // A própria Nina foi desconectada/movida.
    if (oldState.id === botId && newState.channelId !== session.channel.id) {
        stop(guildId, "disconnected").catch(() => {});
        return;
    }

    // Call esvaziou: espera um pouco e encerra.
    if (humansIn(session.channel) === 0) {
        if (!session.emptyTimer) {
            session.emptyTimer = setTimeout(() => {
                session.emptyTimer = null;
                if (humansIn(session.channel) === 0) stop(guildId, "empty").catch(() => {});
            }, EMPTY_CHANNEL_GRACE_MS);
        }
    } else if (session.emptyTimer) {
        clearTimeout(session.emptyTimer);
        session.emptyTimer = null;
    }
}

/** No boot: finaliza na API as gravações que ficaram "em andamento" por causa de um reinício. */
async function recoverInterrupted(client) {
    clientRef = client;

    try {
        const pending = await VoiceRecordingRepository.listByStatus("recording");

        for (const recording of pending) {
            let status = "processing";

            try {
                await RecordingApi.finish(recording.remote_id, {
                    endedAt: Date.now(),
                    participants: recording.participants
                });
            } catch {
                status = "failed";
            }

            await VoiceRecordingRepository.patch(recording.guild_id, recording.id, {
                ended_at: Date.now(),
                duration_ms: Date.now() - recording.started_at,
                status
            });
        }

        if (pending.length) console.log(`[Gravação] ${pending.length} gravação(ões) interrompida(s) por reinício foram finalizadas.`);
    } catch (error) {
        console.error("[Gravação] Falha ao recuperar gravações interrompidas:", error.message);
    }
}

function init(client) {
    clientRef = client;
}

/*
=========================
    STATUS / TRANSCRIÇÃO
=========================
*/

/** Sincroniza o status local com o da API (processamento do áudio e da transcrição). */
async function refreshRecording(recording) {
    if (!recording?.remote_id) return recording;
    if (recording.status === "recording") return recording;

    try {
        const remote = await RecordingApi.getRecording(recording.remote_id);
        const patch = {};

        if (["processing", "ready", "failed"].includes(remote.status)) patch.status = remote.status;
        if (["none", "pending", "ready", "failed"].includes(remote.transcript_status)) patch.transcript_status = remote.transcript_status;
        if (Number(remote.duration_ms) > 0) patch.duration_ms = Number(remote.duration_ms);
        if (Number(remote.size_bytes) > 0) patch.size_bytes = Number(remote.size_bytes);

        if (Object.keys(patch).length) {
            await VoiceRecordingRepository.patch(recording.guild_id, recording.id, patch);
            return { ...recording, ...patch };
        }
    } catch (error) {
        if (error.code === "not_found") {
            await VoiceRecordingRepository.patch(recording.guild_id, recording.id, { status: "failed" });
            return { ...recording, status: "failed" };
        }
        // API indisponível: mantém o status salvo.
    }

    return recording;
}

async function requestTranscription(recording) {
    await RecordingApi.transcribe(recording.remote_id);
    await VoiceRecordingRepository.patch(recording.guild_id, recording.id, { transcript_status: "pending" });
    return { ...recording, transcript_status: "pending" };
}

async function buildTranscriptFile(guild, recording) {
    const result = await RecordingApi.getTranscript(recording.remote_id);

    if (result.status && result.status !== "ready") {
        return { ready: false, status: result.status };
    }

    const text = buildTranscriptText({
        recording,
        guildName: guild.name,
        segments: Array.isArray(result.segments) ? result.segments : []
    });

    return { ready: true, buffer: Buffer.from(text, "utf8") };
}

function attachmentLimitBytes(guild) {
    return (ATTACHMENT_LIMITS[guild.premiumTier] || 10) * 1024 * 1024 - 64 * 1024;
}

function fileStamp(recording) {
    return formatDateTime(recording.started_at).replace(/[/:]/g, "-").replace(" ", "_");
}

/*
=========================
    PAINEL (/voicepanel)
=========================
Components V2, sempre efêmero: só quem abriu vê.
*/

const text = content => new TextDisplayBuilder().setContent(ui.clip(content || "—", 3500));
const separator = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const row = (...components) => new ActionRowBuilder().addComponents(...components);

const button = (id, label, emoji, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);

const STATUS_LABELS = {
    recording: "🔴 Gravando",
    processing: "⏳ Processando",
    ready: "✅ Pronta",
    failed: "❌ Falhou"
};

const TRANSCRIPT_LABELS = {
    none: "Não transcrita",
    pending: "⏳ Transcrevendo…",
    ready: "✅ Pronta",
    failed: "❌ Falhou"
};

/** Cria o container já com o aviso (se houver) no topo. */
const startContainer = (color, notice) => {
    const container = new ContainerBuilder().setAccentColor(color);

    if (notice) {
        container.addTextDisplayComponents(text(`> ${notice}`));
        container.addSeparatorComponents(separator());
    }

    return container;
};

const finish = container => ({
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [container],
    allowedMentions: { parse: [] }
});

async function buildHome({ guild, member, notice = null }) {
    const settings = await VoiceRecordingRepository.get(guild.id);
    const channel = member.voice?.channel || null;
    const session = getSession(guild.id);
    const total = await VoiceRecordingRepository.count(guild.id);

    const allowed = canRecord(member, settings);
    const channelState = channel ? channelStatus(channel, settings) : { ok: false, reason: "Entre em um canal de voz para gravar." };
    const sameChannel = session && channel && session.channel.id === channel.id;

    const lines = [];

    lines.push(`**Canal atual:** ${channel ? `<#${channel.id}>` : "*você não está em um canal de voz*"}`);

    if (session) {
        lines.push(`**Gravação:** 🔴 em andamento em <#${session.channel.id}> desde <t:${Math.floor(session.startedAt / 1000)}:R> (iniciada por <@${session.startedBy}>)`);
    } else {
        lines.push("**Gravação:** ⚪ nenhuma em andamento");
    }

    lines.push(`**Este canal pode ser gravado:** ${channelState.ok ? "✅ sim" : `❌ não — ${channelState.reason}`}`);
    lines.push(`**Sua permissão:** ${allowed ? "✅ autorizado" : "❌ sem cargo autorizado"}`);
    lines.push(`**Limite por gravação:** ${settings.max_minutes} min · **Gravações salvas:** ${total}`);

    if (!settings.enabled) lines.push("\n⚠️ A gravação está **desativada** neste servidor (ative em `/config`).");
    if (!RecordingApi.isConfigured()) lines.push("\n⚠️ O serviço de gravação ainda não foi configurado no host da Nina.");

    const canStart = settings.enabled && RecordingApi.isConfigured() && allowed && channelState.ok && !session;
    const canStop = Boolean(session) && allowed && (sameChannel || isManager(member));

    const container = startContainer(session ? ui.COLORS.error : ui.COLORS.brand, notice);

    container.addTextDisplayComponents(text("## 🎙️  Gravação de calls\nGrave a call, transcreva com IA e baixe o resultado."));
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(text(lines.join("\n")));
    container.addSeparatorComponents(separator());
    container.addActionRowComponents(row(
        button("voicerec:start", "Iniciar gravação", "⏺️", ButtonStyle.Success).setDisabled(!canStart),
        button("voicerec:stop", "Parar gravação", "⏹️", ButtonStyle.Danger).setDisabled(!canStop),
        button("voicerec:list", "Ver gravações", "📂", ButtonStyle.Primary).setDisabled(!allowed),
        button("voicerec:home", "Atualizar", "🔄")
    ));
    container.addTextDisplayComponents(text("-# Os participantes são avisados no chat do canal quando a gravação começa. O áudio não é salvo no servidor da Nina."));

    return finish(container);
}

async function buildList({ guild, member, notice = null }) {
    const settings = await VoiceRecordingRepository.get(guild.id);
    const recordings = await VoiceRecordingRepository.list(guild.id, 25);

    const container = startContainer(ui.COLORS.info, notice);

    container.addTextDisplayComponents(text(`## 📂  Gravações de ${ui.clip(guild.name, 60)}\nSelecione uma gravação para baixar ou transcrever.`));
    container.addSeparatorComponents(separator());

    if (!canRecord(member, settings)) {
        container.addTextDisplayComponents(text("Você não tem um cargo autorizado a ver gravações."));
    } else if (!recordings.length) {
        container.addTextDisplayComponents(text("Nenhuma gravação neste servidor ainda."));
    } else {
        container.addActionRowComponents(row(
            new StringSelectMenuBuilder()
                .setCustomId("voicerec_select:pick")
                .setPlaceholder("Escolha uma gravação…")
                .addOptions(recordings.map(recording => ({
                    label: ui.clip(`${formatDateTime(recording.started_at)} · ${recording.channel_name || "canal"}`, 100),
                    value: recording.id,
                    description: ui.clip(`${STATUS_LABELS[recording.status] || recording.status} · ${formatDuration(recording.duration_ms)} · transcrição: ${TRANSCRIPT_LABELS[recording.transcript_status] || "—"}`, 100)
                })))
        ));

        if (recordings.length === 25) container.addTextDisplayComponents(text("-# Mostrando as 25 mais recentes."));
    }

    container.addSeparatorComponents(separator());
    container.addActionRowComponents(row(button("voicerec:home", "Voltar", "⬅️")));

    return finish(container);
}

async function buildDetail({ guild, member, recording, notice = null }) {
    const settings = await VoiceRecordingRepository.get(guild.id);
    const allowed = canRecord(member, settings);

    const audioReady = recording.status === "ready";
    const canTranscribe = allowed && audioReady && ["none", "failed"].includes(recording.transcript_status);
    const transcriptReady = allowed && recording.transcript_status === "ready";

    const container = startContainer(audioReady ? ui.COLORS.success : ui.COLORS.neutral, notice);

    container.addTextDisplayComponents(text(`## 🎧  Gravação de ${formatDateTime(recording.started_at)}`));
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(text([
        `**Canal:** ${recording.channel_name ? `#${recording.channel_name}` : "—"} (<#${recording.channel_id}>)`,
        `**Iniciada por:** <@${recording.started_by}>`,
        `**Duração:** ${formatDuration(recording.duration_ms)} · **Tamanho:** ${recording.size_bytes ? formatBytes(recording.size_bytes) : "—"}`,
        `**Participantes:** ${recording.participants.length}`,
        `**Áudio:** ${STATUS_LABELS[recording.status] || recording.status}`,
        `**Transcrição:** ${TRANSCRIPT_LABELS[recording.transcript_status] || "—"}`
    ].join("\n")));
    container.addSeparatorComponents(separator());
    container.addActionRowComponents(row(
        button(`voicerec:dl:${recording.id}`, "Baixar gravação", "💾", ButtonStyle.Primary).setDisabled(!allowed || !audioReady || !RecordingApi.supportsAudio(recording.remote_id)),
        button(`voicerec:tr:${recording.id}`, "Transcrever", "📝", ButtonStyle.Success).setDisabled(!canTranscribe),
        button(`voicerec:dltr:${recording.id}`, "Baixar transcrição", "📄", ButtonStyle.Primary).setDisabled(!transcriptReady)
    ));
    container.addActionRowComponents(row(
        button(`voicerec:view:${recording.id}`, "Atualizar status", "🔄"),
        button("voicerec:list", "Voltar", "⬅️")
    ));

    return finish(container);
}

module.exports = {
    // regras
    isManager,
    canRecord,
    channelStatus,
    // formatação
    formatDateTime,
    formatDuration,
    formatBytes,
    buildTranscriptText,
    fileStamp,
    attachmentLimitBytes,
    // ciclo de vida
    init,
    start,
    stop,
    getSession,
    handleVoiceStateUpdate,
    recoverInterrupted,
    // status e transcrição
    refreshRecording,
    requestTranscription,
    buildTranscriptFile,
    // painel
    buildHome,
    buildList,
    buildDetail
};
