const crypto = require("node:crypto");
const database = require("../database");

/*
=========================
    GRAVAÇÃO DE CALLS
=========================
Só guarda configurações e METADADOS. O áudio não é salvo aqui nem em disco.
Toda consulta de gravação exige o guild_id: um servidor nunca enxerga
(nem altera) as gravações de outro.
*/

const MAX_MINUTES_OPTIONS = [30, 60, 120, 240];

const DEFAULTS = {
    enabled: 0,
    allowed_role_ids: [],
    allowed_channel_ids: [],
    blocked_channel_ids: [],
    max_minutes: 120
};

const LIST_FIELDS = ["allowed_role_ids", "allowed_channel_ids", "blocked_channel_ids"];
const SETTINGS_FIELDS = new Set(["enabled", "max_minutes", ...LIST_FIELDS]);

function parseList(value) {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function parseRecording(row) {
    if (!row) return null;
    return { ...row, participants: safeParse(row.participants) };
}

function safeParse(value) {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

class VoiceRecordingRepository {
    static MAX_MINUTES_OPTIONS = MAX_MINUTES_OPTIONS;

    /*
    ----- configurações -----
    */

    static async get(guildId) {
        let row = await database.get(
            `SELECT * FROM voice_recording_settings WHERE guild_id = ?`,
            [guildId]
        );

        if (!row) {
            await database.run(
                `INSERT OR IGNORE INTO voice_recording_settings (guild_id) VALUES (?)`,
                [guildId]
            );
            row = await database.get(
                `SELECT * FROM voice_recording_settings WHERE guild_id = ?`,
                [guildId]
            );
        }

        const merged = { ...DEFAULTS, ...row };
        for (const field of LIST_FIELDS) merged[field] = parseList(row?.[field]);
        return merged;
    }

    static async update(guildId, values) {
        await this.get(guildId);

        const keys = Object.keys(values).filter(key => SETTINGS_FIELDS.has(key));
        if (!keys.length) return this.get(guildId);

        const params = keys.map(key => {
            const value = values[key];
            if (LIST_FIELDS.includes(key)) return JSON.stringify([...new Set((value || []).map(String))]);
            return value;
        });

        await database.run(
            `UPDATE voice_recording_settings SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE guild_id = ?`,
            [...params, guildId]
        );

        return this.get(guildId);
    }

    /*
    ----- gravações (metadados) -----
    */

    static async create({ guildId, channelId, channelName, startedBy, startedByName, startedAt, remoteId }) {
        const id = crypto.randomUUID();

        await database.run(
            `INSERT INTO voice_recordings
             (id, guild_id, channel_id, channel_name, started_by, started_by_name, started_at, remote_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recording')`,
            [id, guildId, channelId, channelName || "", startedBy, startedByName || "", startedAt, remoteId]
        );

        return id;
    }

    static async getRecording(guildId, id) {
        return parseRecording(await database.get(
            `SELECT * FROM voice_recordings WHERE guild_id = ? AND id = ?`,
            [guildId, id]
        ));
    }

    static async list(guildId, limit = 25) {
        const rows = await database.all(
            `SELECT * FROM voice_recordings WHERE guild_id = ? ORDER BY started_at DESC LIMIT ?`,
            [guildId, limit]
        );
        return rows.map(parseRecording);
    }

    static async count(guildId) {
        const row = await database.get(
            `SELECT COUNT(*) AS total FROM voice_recordings WHERE guild_id = ?`,
            [guildId]
        );
        return Number(row?.total || 0);
    }

    static async listByStatus(status) {
        const rows = await database.all(
            `SELECT * FROM voice_recordings WHERE status = ?`,
            [status]
        );
        return rows.map(parseRecording);
    }

    static async patch(guildId, id, values) {
        const allowed = ["ended_at", "duration_ms", "size_bytes", "status", "transcript_status", "participants", "channel_name"];
        const keys = Object.keys(values).filter(key => allowed.includes(key));
        if (!keys.length) return;

        const params = keys.map(key => key === "participants" ? JSON.stringify(values[key] || []) : values[key]);

        await database.run(
            `UPDATE voice_recordings SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE guild_id = ? AND id = ?`,
            [...params, guildId, id]
        );
    }

    static async remove(guildId, id) {
        const result = await database.run(
            `DELETE FROM voice_recordings WHERE guild_id = ? AND id = ?`,
            [guildId, id]
        );
        return result.changes > 0;
    }
}

module.exports = VoiceRecordingRepository;
