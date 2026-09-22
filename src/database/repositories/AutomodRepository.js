const database = require("../database");

const PADRAO = {
    enabled: 0,
    ignored_channels: "",
    ignored_roles: "",
    mute_duration_minutes: 10,

    spam_enabled: 1,
    spam_max_messages: 6,
    spam_interval_seconds: 6,
    spam_actions: "delete,notify,warn",

    emoji_enabled: 1,
    emoji_max_count: 10,
    emoji_actions: "delete,notify",

    swear_enabled: 1,
    swear_actions: "delete,notify,warn",
    swear_custom_words: "",

    mention_enabled: 1,
    mention_max_count: 5,
    mention_actions: "delete,warn,mute",

    invite_enabled: 0,
    invite_actions: "delete,notify",

    raid_enabled: 0,
    raid_join_threshold: 10,
    raid_interval_seconds: 60,
    raid_action: "lockdown"
};

const CAMPOS = Object.keys(PADRAO);

class AutomodRepository {

    static async get(guildId) {

        const row = await database.get(

            `
            SELECT *
            FROM automod_settings
            WHERE guild_id = ?
            `,

            [guildId]

        );

        if (!row) return { guild_id: guildId, ...PADRAO };

        return { guild_id: guildId, ...PADRAO, ...row };

    }

    // Atualiza só os campos passados, criando a linha se não existir ainda
    static async update(guildId, campos) {

        const atual = await AutomodRepository.get(guildId);
        const novo = { ...atual, ...campos };

        const colunas = CAMPOS;
        const valores = colunas.map(c => novo[c]);

        await database.run(

            `
            INSERT INTO automod_settings (guild_id, ${colunas.join(", ")})
            VALUES (?, ${colunas.map(() => "?").join(", ")})
            ON CONFLICT(guild_id) DO UPDATE SET
                ${colunas.map(c => `${c} = excluded.${c}`).join(", ")}
            `,

            [guildId, ...valores]

        );

        return AutomodRepository.get(guildId);

    }

    /*
    =========================
        LISTAS (CSV simples)
    =========================
    */

    static parseLista(csv) {

        return String(csv || "").split(",").map(s => s.trim()).filter(Boolean);

    }

    static async adicionarNaLista(guildId, campo, valor) {

        const atual = await AutomodRepository.get(guildId);
        const lista = AutomodRepository.parseLista(atual[campo]);

        if (!lista.includes(valor)) lista.push(valor);

        return AutomodRepository.update(guildId, { [campo]: lista.join(",") });

    }

    static async removerDaLista(guildId, campo, valor) {

        const atual = await AutomodRepository.get(guildId);
        const lista = AutomodRepository.parseLista(atual[campo]).filter(v => v !== valor);

        return AutomodRepository.update(guildId, { [campo]: lista.join(",") });

    }

    /*
    =========================
        LOCKS DE RAID (canais travados pelo anti-raid)
    =========================
    */

    static async addRaidLock(guildId, channelId) {

        await database.run(

            `
            INSERT OR IGNORE INTO automod_raid_locks (guild_id, channel_id)
            VALUES (?, ?)
            `,

            [guildId, channelId]

        );

    }

    static async listRaidLocks(guildId) {

        const rows = await database.all(

            `
            SELECT channel_id
            FROM automod_raid_locks
            WHERE guild_id = ?
            `,

            [guildId]

        );

        return rows.map(r => r.channel_id);

    }

    static async clearRaidLocks(guildId) {

        await database.run(

            `
            DELETE FROM automod_raid_locks
            WHERE guild_id = ?
            `,

            [guildId]

        );

    }

}

module.exports = AutomodRepository;
