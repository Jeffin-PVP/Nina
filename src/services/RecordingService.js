/*
=========================
    SERVIÇO DE GRAVAÇÃO
=========================
Novas gravações usam exclusivamente o backend local da Groq.
O áudio não é guardado; apenas os segmentos transcritos são salvos.

Gravações antigas com IDs sem o prefixo "local:" continuam sendo consultadas
pela API externa para manter compatibilidade com registros existentes.
*/

const Remote = require("./RecordingApiClient");
const Local = require("./LocalTranscriptionBackend");

const isLocalId = id => String(id || "").startsWith(Local.ID_PREFIX);
const forId = id => (isLocalId(id) ? Local : Remote);
const active = () => Local;

module.exports = {
    RecordingApiError: Remote.RecordingApiError,

    isConfigured: () => Local.isConfigured(),

    /** Esta gravação (ou o backend atual, sem id) guarda áudio para download? */
    supportsAudio: id => (id ? !isLocalId(id) : false),

    /** A transcrição é feita durante a gravação, sem botão "Transcrever"? */
    autoTranscribes: id => (id ? isLocalId(id) : true),

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
