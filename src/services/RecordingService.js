/*
=========================
    SERVIÇO DE GRAVAÇÃO
=========================
Escolhe o backend de cada gravação:

  • RECORDING_API_URL + RECORDING_API_KEY definidos → API externa (áudio + transcrição)
  • senão, com TRANSCRIPTION_GROQ_API_KEY (ou GROQ_API_KEY) → backend local: transcrição direto no Groq, sem áudio

O backend de uma gravação já existente é decidido pelo prefixo do remote_id
("local:..." = Groq), então mudar o .env não quebra gravações antigas.
*/

const Remote = require("./RecordingApiClient");
const Local = require("./LocalTranscriptionBackend");

const isLocalId = id => String(id || "").startsWith(Local.ID_PREFIX);
const forId = id => (isLocalId(id) ? Local : Remote);
const active = () => (Remote.isConfigured() ? Remote : Local);

module.exports = {
    RecordingApiError: Remote.RecordingApiError,

    isConfigured: () => Remote.isConfigured() || Local.isConfigured(),

    /** Esta gravação (ou o backend atual, sem id) guarda áudio para download? */
    supportsAudio: id => (id ? !isLocalId(id) : Remote.isConfigured()),

    /** A transcrição é feita durante a gravação, sem botão "Transcrever"? */
    autoTranscribes: id => (id ? isLocalId(id) : !Remote.isConfigured()),

    createSession: options => active().createSession(options),
    uploadChunk: (id, userId, packets) => forId(id).uploadChunk(id, userId, packets),
    finish: (id, options) => forId(id).finish(id, options),
    getRecording: id => forId(id).getRecording(id),
    openAudio: id => forId(id).openAudio(id),
    downloadAudio: (id, options) => forId(id).downloadAudio(id, options),
    transcribe: id => forId(id).transcribe(id),
    getTranscript: id => forId(id).getTranscript(id),
    remove: id => forId(id).remove(id)
};
