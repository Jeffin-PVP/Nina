const test = require("node:test");
const assert = require("node:assert/strict");

const OggOpus = require("../src/services/OggOpus");
const GroqTranscriber = require("../src/services/GroqTranscriber");
const Local = require("../src/services/LocalTranscriptionBackend");
const RecordingService = require("../src/services/RecordingService");

// Pacote Opus válido de 20 ms (TOC 0xF8 = CELT fullband, 1 frame).
const packet = () => Buffer.from([0xf8, 1, 2, 3, 4]);

/** Gera `count` pacotes de 20 ms a partir do instante `from` (ms). */
const speech = (from, count) => Array.from({ length: count }, (_, i) => ({ t: from + i * 20, data: packet() }));

function memoryStore() {
    const rows = [];
    return {
        rows,
        async insert(recordingId, userId, list) { for (const row of list) rows.push({ recording_id: recordingId, user_id: String(userId), ...row }); },
        async load(recordingId) { return rows.filter(r => r.recording_id === recordingId).sort((a, b) => a.start_ms - b.start_ms); },
        async remove(recordingId) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].recording_id === recordingId) rows.splice(i, 1); }
    };
}

async function settle(id) {
    for (let i = 0; i < 100; i++) {
        const info = await Local.getRecording(id);
        if (info.transcript_status === "ready") return;
        await new Promise(resolve => setImmediate(resolve));
    }
    throw new Error("a transcrição não terminou");
}

test("duração dos pacotes Opus é lida do byte TOC", () => {
    assert.equal(OggOpus.opusPacketSamples(Buffer.from([0xf8])), 960);          // CELT 20 ms
    assert.equal(OggOpus.opusPacketSamples(Buffer.from([0x78])), 960);          // SILK WB 20 ms
    assert.equal(OggOpus.opusPacketSamples(Buffer.from([0xf9, 0x00])), 1920);   // 2 frames de 20 ms
    assert.equal(OggOpus.opusPacketSamples(Buffer.alloc(0)), 0);
});

test("o .ogg gerado tem cabeçalhos, CRC válido e termina com EOS", () => {
    const ogg = OggOpus.mux(Array.from({ length: 60 }, packet));

    assert.equal(ogg.toString("ascii", 0, 4), "OggS");
    assert.ok(ogg.includes(Buffer.from("OpusHead")));
    assert.ok(ogg.includes(Buffer.from("OpusTags")));

    let pos = 0;
    let pages = 0;
    let lastType = 0;

    while (pos < ogg.length) {
        const segments = ogg[pos + 26];
        const size = 27 + segments + ogg.subarray(pos + 27, pos + 27 + segments).reduce((a, b) => a + b, 0);
        const page = Buffer.from(ogg.subarray(pos, pos + size));
        const stored = page.readUInt32LE(22);

        page.writeUInt32LE(0, 22);
        assert.equal(OggOpus.crc32(page), stored, `CRC da página ${pages}`);

        lastType = ogg[pos + 5];
        pos += size;
        pages++;
    }

    assert.equal(pages, 2 + 3);            // 2 cabeçalhos + 60 pacotes em páginas de 25
    assert.equal(lastType & 0x04, 0x04);   // última página marcada como fim
});

test("filtra alucinações típicas do Whisper e mantém fala real", () => {
    const good = { text: " Bom dia, pessoal ", avg_logprob: -0.3, no_speech_prob: 0.02, compression_ratio: 1.4 };

    assert.equal(GroqTranscriber.keepSegment(good), true);
    assert.equal(GroqTranscriber.keepSegment({ ...good, text: "   " }), false);
    assert.equal(GroqTranscriber.keepSegment({ ...good, text: "Legendas pela comunidade Amara.org" }), false);
    assert.equal(GroqTranscriber.keepSegment({ ...good, no_speech_prob: 0.9 }), false);
    assert.equal(GroqTranscriber.keepSegment({ ...good, no_speech_prob: 0.6, avg_logprob: -1 }), false);
    assert.equal(GroqTranscriber.keepSegment({ ...good, compression_ratio: 3 }), false);

    const [segment] = GroqTranscriber.normalizeSegments([good]);
    assert.deepEqual(segment, { start_ms: 0, end_ms: 0, text: "Bom dia, pessoal" });
});

test("converte o tempo do arquivo enviado ao Groq para o tempo real da call", () => {
    const spans = [{ local: 0, real: 1000 }, { local: 1000, real: 3000 }];

    assert.equal(Local._internal.toRealTime(spans, 100), 1100);
    assert.equal(Local._internal.toRealTime(spans, 1200), 3200);
});

test("backend local: junta falas próximas num bloco, separa após silêncio e mapeia os tempos", async () => {
    const store = memoryStore();
    const calls = [];

    Local.setDependenciesForTests({
        store,
        transcribe: async buffer => {
            calls.push(buffer.length);
            // Primeiro bloco tem duas falas (1 s + 1 s de áudio, sem a pausa).
            return calls.length === 1
                ? [{ start_ms: 1200, end_ms: 1900, text: "segunda fala" }, { start_ms: 100, end_ms: 800, text: "primeira fala" }]
                : [{ start_ms: 0, end_ms: 500, text: "depois do silêncio" }];
        }
    });

    const { id } = await Local.createSession({ startedAt: Date.now() });
    assert.ok(id.startsWith(Local.ID_PREFIX));

    await Local.uploadChunk(id, "42", speech(1000, 50));   // 1000–2000 ms
    await Local.uploadChunk(id, "42", speech(3000, 50));   // pausa de 1 s, mesmo bloco
    await Local.uploadChunk(id, "42", speech(20_000, 50)); // 17 s de silêncio: novo bloco

    assert.equal((await Local.getRecording(id)).status, "recording");

    await Local.finish(id, { endedAt: Date.now() });
    await settle(id);

    assert.equal(calls.length, 2);

    const transcript = await Local.getTranscript(id);
    assert.equal(transcript.status, "ready");
    assert.deepEqual(
        transcript.segments.map(s => [s.user_id, s.start_ms, s.text]),
        [["42", 1100, "primeira fala"], ["42", 3200, "segunda fala"], ["42", 20_000, "depois do silêncio"]]
    );
});

test("backend local: ruído muito curto não vai ao Groq e falha vira marcador no texto", async () => {
    const store = memoryStore();
    let calls = 0;

    Local.setDependenciesForTests({
        store,
        transcribe: async () => { calls++; throw new Error("429"); }
    });

    const { id } = await Local.createSession({ startedAt: Date.now() });

    await Local.uploadChunk(id, "1", speech(500, 5));      // 100 ms: descartado
    await Local.uploadChunk(id, "2", speech(800, 100));    // 2 s: tenta e falha

    await Local.finish(id, { endedAt: Date.now() });
    await settle(id);

    assert.equal(calls, 1);

    const { segments } = await Local.getTranscript(id);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].user_id, "2");
    assert.match(segments[0].text, /não transcrito/);
});

test("backend local: não guarda áudio e remove o texto ao excluir", async () => {
    const store = memoryStore();
    Local.setDependenciesForTests({ store, transcribe: async () => [{ start_ms: 0, end_ms: 100, text: "oi" }] });

    const { id } = await Local.createSession({ startedAt: Date.now() });
    await Local.uploadChunk(id, "1", speech(0, 50));
    await Local.finish(id, { endedAt: Date.now() });
    await settle(id);

    await assert.rejects(() => Local.openAudio(id), error => error.code === "unsupported");
    assert.equal(store.rows.length, 1);

    await Local.remove(id);
    assert.equal(store.rows.length, 0);
});

test("a transcrição usa a chave própria e cai na principal só como reserva", () => {
    const saved = { ...process.env };

    try {
        delete process.env.TRANSCRIPTION_GROQ_API_KEY;
        delete process.env.GROQ_API_KEY;
        assert.equal(GroqTranscriber.isConfigured(), false);

        process.env.TRANSCRIPTION_GROQ_API_KEY = "so-transcricao";
        assert.equal(GroqTranscriber.isConfigured(), true);

        delete process.env.TRANSCRIPTION_GROQ_API_KEY;
        process.env.GROQ_API_KEY = "principal";
        assert.equal(GroqTranscriber.isConfigured(), true);
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
        Object.assign(process.env, saved);
    }
});

test("o serviço usa o Groq sem RECORDING_API_URL e respeita o prefixo das gravações existentes", async () => {
    const saved = { ...process.env };

    try {
        delete process.env.RECORDING_API_URL;
        delete process.env.RECORDING_API_KEY;
        process.env.GROQ_API_KEY = "teste";

        assert.equal(RecordingService.isConfigured(), true);
        assert.equal(RecordingService.supportsAudio(), false);
        assert.equal(RecordingService.autoTranscribes(), true);

        Local.setDependenciesForTests({ store: memoryStore(), transcribe: async () => [] });
        const { id } = await RecordingService.createSession({ startedAt: Date.now() });
        assert.ok(id.startsWith("local:"));
        assert.equal(RecordingService.supportsAudio(id), false);
        assert.equal(RecordingService.supportsAudio("abc123"), true); // id da API externa

        delete process.env.GROQ_API_KEY;
        assert.equal(RecordingService.isConfigured(), false);

        process.env.RECORDING_API_URL = "https://ia.exemplo.com";
        process.env.RECORDING_API_KEY = "k";
        assert.equal(RecordingService.supportsAudio(), true);
        assert.equal(RecordingService.autoTranscribes(), false);
    } finally {
        for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
        Object.assign(process.env, saved);
    }
});
