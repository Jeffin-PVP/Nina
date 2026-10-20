const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection, PermissionFlagsBits, ChannelType } = require("discord.js");

const VoiceRecordingManager = require("../src/managers/VoiceRecordingManager");
const RecordingApi = require("../src/services/RecordingApiClient");

const member = ({ roles = [], admin = false, manageGuild = false } = {}) => ({
    permissions: {
        has: flag =>
            (admin && flag === PermissionFlagsBits.Administrator) ||
            (manageGuild && flag === PermissionFlagsBits.ManageGuild)
    },
    roles: { cache: new Collection(roles.map(id => [id, { id }])) }
});

const settings = (extra = {}) => ({
    enabled: 1,
    allowed_role_ids: [],
    allowed_channel_ids: [],
    blocked_channel_ids: [],
    max_minutes: 120,
    ...extra
});

test("só administradores, Gerenciar Servidor ou cargos liberados podem gravar", () => {
    const { canRecord } = VoiceRecordingManager;

    assert.equal(canRecord(member({ admin: true }), settings()), true);
    assert.equal(canRecord(member({ manageGuild: true }), settings()), true);
    assert.equal(canRecord(member(), settings()), false);
    assert.equal(canRecord(member({ roles: ["111"] }), settings({ allowed_role_ids: ["111"] })), true);
    assert.equal(canRecord(member({ roles: ["222"] }), settings({ allowed_role_ids: ["111"] })), false);
    assert.equal(canRecord(null, settings()), false);
});

test("canais bloqueados têm prioridade e a lista de liberados restringe os demais", () => {
    const { channelStatus } = VoiceRecordingManager;
    const voice = id => ({ id, type: ChannelType.GuildVoice });

    assert.equal(channelStatus(voice("1"), settings()).ok, true);
    assert.equal(channelStatus(voice("1"), settings({ blocked_channel_ids: ["1"] })).ok, false);
    assert.equal(channelStatus(voice("1"), settings({ allowed_channel_ids: ["2"] })).ok, false);
    assert.equal(channelStatus(voice("2"), settings({ allowed_channel_ids: ["2"] })).ok, true);
    assert.equal(channelStatus(voice("2"), settings({ allowed_channel_ids: ["2"], blocked_channel_ids: ["2"] })).ok, false);
    assert.equal(channelStatus({ id: "3", type: ChannelType.GuildText }, settings()).ok, false);
});

test("a transcrição sai em ordem cronológica com nome público, nickname e ID", () => {
    const startedAt = Date.UTC(2026, 9, 20, 17, 0, 0); // 14:00:00 em America/Sao_Paulo

    const text = VoiceRecordingManager.buildTranscriptText({
        guildName: "Servidor Teste",
        recording: {
            guild_id: "100",
            channel_id: "200",
            channel_name: "geral",
            started_at: startedAt,
            ended_at: startedAt + 600_000,
            duration_ms: 600_000,
            started_by: "1",
            started_by_name: "Ana",
            participants: [
                { id: "1", username: "ana", globalName: "Ana Silva", nickname: "Aninha" },
                { id: "2", username: "beto", globalName: null, nickname: null }
            ]
        },
        segments: [
            { user_id: "2", start_ms: 65_000, end_ms: 70_000, text: "  Segunda   fala  " },
            { user_id: "1", start_ms: 5_000, end_ms: 9_000, text: "Primeira fala" },
            { user_id: "9", start_ms: 90_000, end_ms: 95_000, text: "Quem sou eu?" },
            { user_id: "1", start_ms: 100_000, end_ms: 101_000, text: "   " }
        ]
    });

    const first = text.indexOf("Primeira fala");
    const second = text.indexOf("Segunda fala");
    const third = text.indexOf("Quem sou eu?");

    assert.ok(first > 0 && first < second && second < third, "ordem cronológica");
    assert.match(text, /\[20\/10\/2026 14:00:05\] Ana Silva \| Nickname: Aninha \| ID: 1/);
    assert.match(text, /\[20\/10\/2026 14:01:05\] beto \| Nickname: — \| ID: 2/);
    assert.match(text, /Usuário desconhecido \| Nickname: — \| ID: 9/);
    assert.doesNotMatch(text, /\n\s*\n\s*\n\s*\n/);
});

test("lotes de áudio são codificados em frames [uint32 offset][uint16 tamanho][opus]", () => {
    const frames = RecordingApi.encodeFrames([
        { t: 1500, data: Buffer.from([1, 2, 3]) },
        { t: 1520, data: Buffer.from([9]) }
    ]);

    assert.equal(frames.length, 6 + 3 + 6 + 1);
    assert.equal(frames.readUInt32BE(0), 1500);
    assert.equal(frames.readUInt16BE(4), 3);
    assert.deepEqual([...frames.subarray(6, 9)], [1, 2, 3]);
    assert.equal(frames.readUInt32BE(9), 1520);
    assert.equal(frames.readUInt16BE(13), 1);
    assert.equal(frames[15], 9);
});

test("formatação de duração e tamanho", () => {
    assert.equal(VoiceRecordingManager.formatDuration(45_000), "45s");
    assert.equal(VoiceRecordingManager.formatDuration(125_000), "2min 05s");
    assert.equal(VoiceRecordingManager.formatDuration(3_725_000), "1h 02min 05s");
    assert.equal(VoiceRecordingManager.formatBytes(2 * 1024 * 1024), "2.0 MB");
});
