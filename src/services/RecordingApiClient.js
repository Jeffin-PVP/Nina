/*
=========================
    CLIENTE DA API DE GRAVAÇÃO / IA
=========================
A Nina NÃO grava áudio em disco. Os pacotes Opus vão da memória direto
para a API separada (RECORDING_API_URL), que cuida de armazenar, mixar e
transcrever. O contrato completo está em docs/RECORDING_API.md.

Variáveis de ambiente:
  RECORDING_API_URL   ex.: https://ia.exemplo.com
  RECORDING_API_KEY   token Bearer enviado em todas as chamadas
*/

class RecordingApiError extends Error {
    constructor(message, { status = 0, code = "api_error" } = {}) {
        super(message);
        this.name = "RecordingApiError";
        this.status = status;
        this.code = code;
    }
}

const DEFAULT_TIMEOUT_MS = 30_000;

function baseUrl() {
    return String(process.env.RECORDING_API_URL || "").trim().replace(/\/+$/, "");
}

function isConfigured() {
    return Boolean(baseUrl() && String(process.env.RECORDING_API_KEY || "").trim());
}

async function request(path, { method = "GET", json, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!isConfigured()) {
        throw new RecordingApiError("A API de gravação não está configurada.", { code: "not_configured" });
    }

    const finalHeaders = {
        Authorization: `Bearer ${process.env.RECORDING_API_KEY}`,
        Accept: "application/json",
        ...headers
    };

    let payload = body;

    if (json !== undefined) {
        finalHeaders["Content-Type"] = "application/json";
        payload = JSON.stringify(json);
    }

    let response;

    try {
        response = await fetch(`${baseUrl()}${path}`, {
            method,
            headers: finalHeaders,
            body: payload,
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
        throw new RecordingApiError(
            timeout ? "A API de gravação demorou demais para responder." : "Não consegui falar com a API de gravação.",
            { code: timeout ? "timeout" : "unreachable" }
        );
    }

    if (!response.ok) {
        let detail = "";
        try { detail = (await response.json())?.error || ""; } catch { /* corpo não é JSON */ }

        throw new RecordingApiError(
            detail || `A API de gravação respondeu com erro ${response.status}.`,
            { status: response.status, code: response.status === 404 ? "not_found" : "api_error" }
        );
    }

    return response;
}

async function requestJson(path, options) {
    const response = await request(path, options);
    if (response.status === 204) return {};
    return response.json().catch(() => ({}));
}

/*
-------------------------
    SESSÃO DE GRAVAÇÃO
-------------------------
*/

/** Abre uma gravação na API. Retorna { id }. */
function createSession({ guildId, channelId, channelName, startedAt }) {
    return requestJson("/v1/recordings", {
        method: "POST",
        json: {
            guild_id: guildId,
            channel_id: channelId,
            channel_name: channelName,
            started_at: new Date(startedAt).toISOString(),
            codec: "opus",
            sample_rate: 48000,
            channels: 2
        }
    });
}

/**
 * Envia um lote de pacotes Opus de UM usuário.
 * Formato binário (big-endian), repetido por pacote:
 *   uint32 offset_ms   (ms desde o início da gravação)
 *   uint16 length
 *   bytes  opus_packet
 */
function encodeFrames(packets) {
    const total = packets.reduce((sum, packet) => sum + 6 + packet.data.length, 0);
    const out = Buffer.allocUnsafe(total);
    let offset = 0;

    for (const packet of packets) {
        out.writeUInt32BE(Math.max(0, packet.t) >>> 0, offset);
        out.writeUInt16BE(packet.data.length, offset + 4);
        packet.data.copy(out, offset + 6);
        offset += 6 + packet.data.length;
    }

    return out;
}

function uploadChunk(remoteId, userId, packets) {
    return request(`/v1/recordings/${encodeURIComponent(remoteId)}/chunks?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: encodeFrames(packets),
        timeoutMs: 60_000
    });
}

function finish(remoteId, { endedAt, participants }) {
    return requestJson(`/v1/recordings/${encodeURIComponent(remoteId)}/finish`, {
        method: "POST",
        json: {
            ended_at: new Date(endedAt).toISOString(),
            participants
        }
    });
}

/*
-------------------------
    CONSULTA / DOWNLOAD
-------------------------
*/

function getRecording(remoteId) {
    return requestJson(`/v1/recordings/${encodeURIComponent(remoteId)}`);
}

/** Abre o áudio mixado como Response (para repassar em stream ao painel web). */
function openAudio(remoteId) {
    return request(`/v1/recordings/${encodeURIComponent(remoteId)}/audio`, {
        headers: { Accept: "audio/*" },
        timeoutMs: 120_000
    });
}

/** Baixa o áudio para a memória, recusando arquivos maiores que maxBytes. */
async function downloadAudio(remoteId, { maxBytes }) {
    const response = await openAudio(remoteId);

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared && maxBytes && declared > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new RecordingApiError("Arquivo grande demais.", { code: "too_large", status: 413 });
    }

    const chunks = [];
    let received = 0;

    for await (const chunk of response.body) {
        received += chunk.length;

        if (maxBytes && received > maxBytes) {
            throw new RecordingApiError("Arquivo grande demais.", { code: "too_large", status: 413 });
        }

        chunks.push(chunk);
    }

    const contentType = response.headers.get("content-type") || "audio/ogg";

    return { buffer: Buffer.concat(chunks), contentType, extension: extensionFor(contentType) };
}

function extensionFor(contentType) {
    const type = String(contentType).toLowerCase();
    if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
    if (type.includes("wav")) return "wav";
    if (type.includes("webm")) return "webm";
    if (type.includes("mp4") || type.includes("m4a")) return "m4a";
    return "ogg";
}

/*
-------------------------
    TRANSCRIÇÃO
-------------------------
*/

function transcribe(remoteId) {
    return requestJson(`/v1/recordings/${encodeURIComponent(remoteId)}/transcribe`, {
        method: "POST",
        json: { language: "pt" }
    });
}

/** Retorna { status, segments: [{ user_id, start_ms, end_ms, text }] }. */
function getTranscript(remoteId) {
    return requestJson(`/v1/recordings/${encodeURIComponent(remoteId)}/transcript`, { timeoutMs: 60_000 });
}

function remove(remoteId) {
    return requestJson(`/v1/recordings/${encodeURIComponent(remoteId)}`, { method: "DELETE" });
}

module.exports = {
    RecordingApiError,
    isConfigured,
    createSession,
    uploadChunk,
    encodeFrames,
    finish,
    getRecording,
    openAudio,
    downloadAudio,
    transcribe,
    getTranscript,
    remove
};
