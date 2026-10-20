/*
=========================
    TRANSCRIÇÃO VIA GROQ
=========================
Envia um trecho de áudio (.ogg) ao Whisper do Groq e devolve os segmentos
já com o tempo em milissegundos (relativo ao início do trecho).

Variáveis de ambiente:
  TRANSCRIPTION_GROQ_API_KEY    chave só da transcrição (separada da IA principal)
  GROQ_API_KEY                  usada como reserva se a de cima não existir
  GROQ_TRANSCRIPTION_MODEL      opcional (padrão: whisper-large-v3-turbo)
*/

const DEFAULT_MODEL = "whisper-large-v3-turbo";
const MAX_ATTEMPTS = 4;

// Frases que o Whisper "alucina" em trechos de ruído/silêncio.
const HALLUCINATION = /amara\.org|legendas?\s+(pela|por|de)\b|obrigad[oa]\s+por\s+assistir|inscreva-se\s+no\s+canal/i;

function apiKey() {
    return String(process.env.TRANSCRIPTION_GROQ_API_KEY || process.env.GROQ_API_KEY || "").trim();
}

function isConfigured() {
    return Boolean(apiKey());
}

let cachedClient = null;
let cachedKey = null;

/** Cliente próprio da transcrição: não mexe no cliente da IA principal. */
function getClient() {
    const key = apiKey();

    if (!cachedClient || cachedKey !== key) {
        const Groq = require("groq-sdk");
        cachedClient = new Groq({ apiKey: key });
        cachedKey = key;
    }

    return cachedClient;
}

/** Decide se um segmento do Whisper parece fala real. */
function keepSegment(segment) {
    const text = String(segment?.text || "").replace(/\s+/g, " ").trim();
    if (!text) return false;
    if (HALLUCINATION.test(text)) return false;

    const noSpeech = Number(segment.no_speech_prob ?? 0);
    const logprob = Number(segment.avg_logprob ?? 0);
    const compression = Number(segment.compression_ratio ?? 0);

    if (noSpeech > 0.8) return false;
    if (noSpeech > 0.5 && logprob < -0.8) return false;
    if (logprob < -1.5) return false;
    if (compression > 2.4) return false;

    return true;
}

function normalizeSegments(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(keepSegment)
        .map(segment => ({
            start_ms: Math.max(0, Math.round(Number(segment.start || 0) * 1000)),
            end_ms: Math.max(0, Math.round(Number(segment.end || 0) * 1000)),
            text: String(segment.text).replace(/\s+/g, " ").trim()
        }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelayMs(error, attempt) {
    const header = error?.headers?.["retry-after"] ?? error?.headers?.get?.("retry-after");
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 60) * 1000;
    return 2000 * 2 ** (attempt - 1);
}

function shouldRetry(error) {
    const status = Number(error?.status || 0);
    return status === 429 || status >= 500 || !status;
}

async function toUploadable(buffer) {
    const Groq = require("groq-sdk");
    const name = "audio.ogg";

    if (typeof Groq.toFile === "function") return Groq.toFile(buffer, name, { type: "audio/ogg" });
    return new File([buffer], name, { type: "audio/ogg" });
}

/**
 * Transcreve um .ogg. Retorna [{ start_ms, end_ms, text }].
 * Repete em caso de limite de taxa (429) ou erro temporário do Groq.
 */
async function transcribe(buffer, { language = "pt" } = {}) {
    if (!isConfigured()) throw new Error("Chave do Groq da transcrição não configurada.");

    const client = getClient();
    const model = String(process.env.GROQ_TRANSCRIPTION_MODEL || "").trim() || DEFAULT_MODEL;

    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await client.audio.transcriptions.create({
                file: await toUploadable(buffer),
                model,
                language,
                response_format: "verbose_json",
                temperature: 0
            });

            return normalizeSegments(result?.segments);
        } catch (error) {
            lastError = error;
            if (attempt === MAX_ATTEMPTS || !shouldRetry(error)) break;
            await sleep(retryDelayMs(error, attempt));
        }
    }

    throw lastError;
}

module.exports = { isConfigured, transcribe, keepSegment, normalizeSegments };
