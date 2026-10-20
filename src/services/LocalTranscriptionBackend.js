/*
=========================
    BACKEND LOCAL (GROQ)
=========================
Faz o papel da API de gravação externa, mas só para TRANSCRIÇÃO e sem
RECORDING_API_URL. Tem a mesma interface do RecordingApiClient.

Fluxo:
  pacotes Opus (RAM) → blocos de fala por usuário → .ogg em memória → Groq
  → segmentos de texto salvos no SQLite

- O áudio NÃO é guardado (nem em disco, nem no banco): só o texto.
- A transcrição acontece durante a gravação, então ao parar ela já está
  (quase) pronta. Por isso não existe "Baixar gravação" neste modo.
- Blocos de até ~40 s por usuário mantêm poucas requisições ao Groq
  (o plano gratuito limita requisições por minuto).
*/

const crypto = require("node:crypto");

const { RecordingApiError } = require("./RecordingApiClient");
const GroqTranscriber = require("./GroqTranscriber");
const OggOpus = require("./OggOpus");

const ID_PREFIX = "local:";

const SPAN_GAP_MS = 250;        // pausa que marca uma nova fala dentro do bloco
const BLOCK_IDLE_MS = 5_000;    // silêncio que fecha o bloco do usuário
const MAX_BLOCK_MS = 40_000;    // duração máxima de áudio por requisição
const MIN_BLOCK_MS = 400;       // menos que isso é ruído/clique
const MAX_QUEUE = 200;          // blocos esperando o Groq

const FAILURE_TEXT = "[trecho não transcrito: falha no serviço de transcrição]";

/** id → sessão em andamento (só existe enquanto há trabalho pendente). */
const sessions = new Map();

let chain = Promise.resolve();
let queued = 0;

/*
-------------------------
    ARMAZENAMENTO
-------------------------
*/

const sqliteStore = {
    async insert(recordingId, userId, rows) {
        const database = require("../database/database");

        for (const row of rows) {
            await database.run(
                `INSERT INTO voice_transcript_segments (recording_id, user_id, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)`,
                [recordingId, String(userId), row.start_ms, row.end_ms, row.text]
            );
        }
    },

    async load(recordingId) {
        const database = require("../database/database");

        return database.all(
            `SELECT user_id, start_ms, end_ms, text FROM voice_transcript_segments WHERE recording_id = ? ORDER BY start_ms ASC, rowid ASC`,
            [recordingId]
        );
    },

    async remove(recordingId) {
        const database = require("../database/database");
        await database.run(`DELETE FROM voice_transcript_segments WHERE recording_id = ?`, [recordingId]);
    }
};

const deps = {
    transcribe: (buffer, options) => GroqTranscriber.transcribe(buffer, options),
    store: sqliteStore
};

/** Só para testes: troca o Groq e o banco por versões falsas. */
function setDependenciesForTests(overrides = {}) {
    if (overrides.transcribe) deps.transcribe = overrides.transcribe;
    if (overrides.store) deps.store = overrides.store;
}

/*
-------------------------
    BLOCOS DE FALA
-------------------------
*/

/** Converte um tempo do arquivo enviado ao Groq para o tempo real da gravação. */
function toRealTime(spans, localMs) {
    for (let i = spans.length - 1; i >= 0; i--) {
        if (spans[i].local <= localMs) return spans[i].real + (localMs - spans[i].local);
    }

    return (spans[0]?.real || 0) + localMs;
}

function release(session) {
    if (session.finished && session.pending === 0) sessions.delete(session.id);
}

function schedule(session, task) {
    session.pending++;
    queued++;

    chain = chain
        .then(task)
        .catch(error => console.error("[Gravação] Erro na fila de transcrição:", error.message))
        .then(() => {
            session.pending--;
            queued--;
            release(session);
        });
}

async function transcribeBlock(session, userId, block, buffer) {
    try {
        const segments = await deps.transcribe(buffer, { language: "pt" });

        const rows = segments.map(segment => {
            const start = toRealTime(block.spans, segment.start_ms);
            return { start_ms: start, end_ms: start + Math.max(0, segment.end_ms - segment.start_ms), text: segment.text };
        });

        if (rows.length) await deps.store.insert(session.id, userId, rows);
    } catch (error) {
        session.failedBlocks++;
        console.error(`[Gravação] Falha ao transcrever trecho (${session.id}):`, error.message);

        const at = block.spans[0]?.real || 0;
        await deps.store.insert(session.id, userId, [{ start_ms: at, end_ms: at, text: FAILURE_TEXT }]).catch(() => {});
    }
}

function closeBlock(session, userId, block) {
    if (!block || block.audioMs < MIN_BLOCK_MS) return;

    const buffer = OggOpus.mux(block.packets);
    const spans = block.spans;
    block.packets = null;

    const closed = { spans };

    if (queued >= MAX_QUEUE) {
        session.failedBlocks++;
        deps.store.insert(session.id, userId, [{ start_ms: spans[0].real, end_ms: spans[0].real, text: FAILURE_TEXT }]).catch(() => {});
        return;
    }

    schedule(session, () => transcribeBlock(session, userId, closed, buffer));
}

function feed(session, userId, packet) {
    const duration = OggOpus.opusPacketSamples(packet.data) / 48;
    if (!duration) return;

    let block = session.users.get(userId);

    if (block && (block.audioMs >= MAX_BLOCK_MS || packet.t - block.lastT > BLOCK_IDLE_MS)) {
        closeBlock(session, userId, block);
        block = null;
    }

    if (!block) {
        block = { packets: [], spans: [], audioMs: 0, lastT: packet.t };
        session.users.set(userId, block);
    }

    if (!block.spans.length || packet.t - block.lastT > SPAN_GAP_MS) {
        block.spans.push({ local: block.audioMs, real: packet.t });
    }

    block.packets.push(packet.data);
    block.audioMs += duration;
    block.lastT = packet.t;
}

/*
-------------------------
    INTERFACE (igual à da API externa)
-------------------------
*/

function isConfigured() {
    return GroqTranscriber.isConfigured();
}

async function createSession({ startedAt }) {
    const id = `${ID_PREFIX}${crypto.randomUUID()}`;

    sessions.set(id, {
        id,
        startedAt: new Date(startedAt).getTime(),
        users: new Map(),
        pending: 0,
        failedBlocks: 0,
        finished: false,
        endedAt: null
    });

    return { id };
}

async function uploadChunk(remoteId, userId, packets) {
    const session = sessions.get(remoteId);
    if (!session) throw new RecordingApiError("Sessão de gravação não encontrada.", { code: "not_found", status: 404 });

    for (const packet of packets) feed(session, String(userId), packet);

    return {};
}

async function finish(remoteId, { endedAt } = {}) {
    const session = sessions.get(remoteId);

    // Depois de um reinício a sessão some da memória; o que já foi transcrito está no banco.
    if (!session) return {};

    for (const [userId, block] of session.users) closeBlock(session, userId, block);

    session.users.clear();
    session.finished = true;
    session.endedAt = endedAt ? new Date(endedAt).getTime() : Date.now();

    release(session);

    return {};
}

async function getRecording(remoteId) {
    const session = sessions.get(remoteId);

    if (!session) return { status: "ready", transcript_status: "ready" };

    const working = !session.finished || session.pending > 0;

    return {
        status: !session.finished ? "recording" : (working ? "processing" : "ready"),
        transcript_status: working ? "pending" : "ready",
        duration_ms: session.endedAt ? session.endedAt - session.startedAt : 0
    };
}

async function getTranscript(remoteId) {
    const session = sessions.get(remoteId);

    if (session && (!session.finished || session.pending > 0)) {
        return { status: "pending", segments: [] };
    }

    const rows = await deps.store.load(remoteId);

    return {
        status: "ready",
        segments: rows.map(row => ({
            user_id: row.user_id,
            start_ms: row.start_ms,
            end_ms: row.end_ms,
            text: row.text
        }))
    };
}

/** A transcrição já acontece durante a gravação; não há o que "pedir" depois. */
async function transcribe() {
    return {};
}

async function remove(remoteId) {
    sessions.delete(remoteId);
    await deps.store.remove(remoteId);
    return {};
}

function noAudio() {
    throw new RecordingApiError("Neste modo só a transcrição é guardada; o áudio não é salvo.", { code: "unsupported", status: 501 });
}

module.exports = {
    ID_PREFIX,
    isConfigured,
    createSession,
    uploadChunk,
    finish,
    getRecording,
    getTranscript,
    transcribe,
    remove,
    openAudio: async () => noAudio(),
    downloadAudio: async () => noAudio(),
    setDependenciesForTests,
    _internal: { toRealTime, sessions }
};
