const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Local do banco
const dbPath = path.join(
    __dirname,
    "bot.sqlite"
);

// Criar conexão
const db = new sqlite3.Database(
    dbPath,
    (err) => {

        if (err) {

            console.error(
                "❌ Erro ao conectar SQLite:",
                err
            );

        } else {

            console.log(
                "🗄️ SQLite conectado"
            );

        }

    }
);

// Ativar foreign keys
db.run(`
    PRAGMA foreign_keys = ON;
`);

// Criar tabelas
db.serialize(() => {

    /*
    =========================
        ECONOMY USERS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS economy_users (

            guild_id TEXT NOT NULL,

            user_id TEXT NOT NULL,

            wallet INTEGER DEFAULT 0,

            bank INTEGER DEFAULT 0,

            xp INTEGER DEFAULT 0,

            level INTEGER DEFAULT 1,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (
                guild_id,
                user_id
            )

        );
    `);

    db.run(`
ALTER TABLE economy_users
ADD COLUMN daily_at INTEGER DEFAULT NULL;
`, err => {

        if (
            err &&
            !err.message.includes("duplicate column")
        ) {

            console.error(err);

        }

    });

    db.run(`
ALTER TABLE economy_users
ADD COLUMN work_at INTEGER DEFAULT NULL;
`, err => {

        if (
            err &&
            !err.message.includes("duplicate column")
        ) {

            console.error(err);

        }

    });

    /*
    =========================
        ECONOMY TRANSACTIONS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS economy_transactions (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        guild_id TEXT NOT NULL,

        user_id TEXT NOT NULL,

        amount INTEGER NOT NULL,

        type TEXT NOT NULL,

        description TEXT,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

    `);

    /*
    =========================
        WARNINGS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS warnings (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            guild_id TEXT NOT NULL,

            user_id TEXT NOT NULL,

            moderator_id TEXT NOT NULL,

            reason TEXT NOT NULL,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );

    `);

    /*
    =========================
        INVENTÁRIO
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS inventories (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT NOT NULL,

            guild_id TEXT NOT NULL,

            item_id TEXT NOT NULL,

            quantity INTEGER DEFAULT 1,

            UNIQUE(
                user_id,
                guild_id,
                item_id
            )

        );

    `);

    /*
    =========================
        COOLDOWNS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS cooldowns (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT NOT NULL,

            guild_id TEXT NOT NULL,

            command TEXT NOT NULL,

            expires_at INTEGER NOT NULL,

            UNIQUE(
                user_id,
                guild_id,
                command
            )

        );

    `);

    /*
    =========================
        CONFIGURAÇÕES
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS guild_settings (

            guild_id TEXT PRIMARY KEY,

            log_channel TEXT,

            economy_enabled INTEGER DEFAULT 1,

            moderation_enabled INTEGER DEFAULT 1,

            prefix TEXT DEFAULT "!"

        );

    `);

    db.run(`
ALTER TABLE guild_settings
ADD COLUMN log_disabled_categories TEXT DEFAULT '';
`, err => {

        if (
            err &&
            !err.message.includes("duplicate column")
        ) {

            console.error(err);

        }

    });

    /*
    =========================
        TICKETS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS ticket_config (

            guild_id TEXT PRIMARY KEY,

            parent_channel_id TEXT,

            support_role_id TEXT,

            panel_channel_id TEXT,

            next_number INTEGER DEFAULT 1,

            enabled INTEGER DEFAULT 1

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS tickets (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            guild_id TEXT NOT NULL,

            number INTEGER NOT NULL,

            thread_id TEXT NOT NULL UNIQUE,

            parent_channel_id TEXT NOT NULL,

            user_id TEXT NOT NULL,

            status TEXT NOT NULL DEFAULT 'open',

            claimed_by TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            closed_at DATETIME,

            closed_by TEXT

        );

    `);

    /*
    =========================
        AUTO-ROLE
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS autorole_join (

            guild_id TEXT PRIMARY KEY,

            role_ids TEXT DEFAULT ''

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS autorole_selfroles (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            guild_id TEXT NOT NULL,

            role_id TEXT NOT NULL,

            label TEXT NOT NULL,

            emoji TEXT,

            UNIQUE(guild_id, role_id)

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS autorole_levels (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            guild_id TEXT NOT NULL,

            level INTEGER NOT NULL,

            role_id TEXT NOT NULL,

            UNIQUE(guild_id, level)

        );

    `);

    db.run(`
ALTER TABLE guild_settings
ADD COLUMN levelup_enabled INTEGER DEFAULT 1;
`, err => {

        if (
            err &&
            !err.message.includes("duplicate column")
        ) {

            console.error(err);

        }

    });

    /*
    =========================
        SORTEIOS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS giveaways (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            guild_id TEXT NOT NULL,

            channel_id TEXT NOT NULL,

            message_id TEXT,

            host_id TEXT NOT NULL,

            prize TEXT NOT NULL,

            winners_count INTEGER NOT NULL DEFAULT 1,

            required_role_id TEXT,

            ends_at INTEGER NOT NULL,

            status TEXT NOT NULL DEFAULT 'running',

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS giveaway_entries (

            giveaway_id INTEGER NOT NULL,

            user_id TEXT NOT NULL,

            entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (giveaway_id, user_id)

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS giveaway_multipliers (

            guild_id TEXT NOT NULL,

            role_id TEXT NOT NULL,

            multiplier INTEGER NOT NULL DEFAULT 2,

            PRIMARY KEY (guild_id, role_id)

        );

    `);

    /*
    =========================
        DASHBOARD DO DONO
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS bot_presence (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            type TEXT NOT NULL DEFAULT 'WATCHING',

            text TEXT NOT NULL,

            position INTEGER NOT NULL DEFAULT 0

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS bot_settings (

            key TEXT PRIMARY KEY,

            value TEXT

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS bot_stats_history (

            date TEXT PRIMARY KEY,

            servers INTEGER NOT NULL,

            members INTEGER NOT NULL

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS broadcasts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT,

            description TEXT NOT NULL,

            color TEXT,

            kind TEXT NOT NULL DEFAULT 'broadcast',

            sent_count INTEGER NOT NULL DEFAULT 0,

            failed_count INTEGER NOT NULL DEFAULT 0,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS banned_guilds (

            guild_id TEXT PRIMARY KEY,

            guild_name TEXT,

            reason TEXT,

            banned_at DATETIME DEFAULT CURRENT_TIMESTAMP

        );

    `);

    /*
    =========================
        BOAS-VINDAS
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS welcome_settings (

            guild_id TEXT PRIMARY KEY,

            enabled INTEGER NOT NULL DEFAULT 0,

            channel_id TEXT,

            background_url TEXT,

            title_text TEXT,

            subtitle_text TEXT,

            message_content TEXT,

            accent_color TEXT DEFAULT '#5865F2'

        );

    `);

    /*
    =========================
        AUTOMOD
    =========================
    */

    db.run(`

        CREATE TABLE IF NOT EXISTS automod_settings (

            guild_id TEXT PRIMARY KEY,

            enabled INTEGER NOT NULL DEFAULT 0,

            ignored_channels TEXT NOT NULL DEFAULT '',
            ignored_roles TEXT NOT NULL DEFAULT '',
            mute_duration_minutes INTEGER NOT NULL DEFAULT 10,

            spam_enabled INTEGER NOT NULL DEFAULT 1,
            spam_max_messages INTEGER NOT NULL DEFAULT 6,
            spam_interval_seconds INTEGER NOT NULL DEFAULT 6,
            spam_actions TEXT NOT NULL DEFAULT 'delete,notify,warn',

            emoji_enabled INTEGER NOT NULL DEFAULT 1,
            emoji_max_count INTEGER NOT NULL DEFAULT 10,
            emoji_actions TEXT NOT NULL DEFAULT 'delete,notify',

            swear_enabled INTEGER NOT NULL DEFAULT 1,
            swear_actions TEXT NOT NULL DEFAULT 'delete,notify,warn',
            swear_custom_words TEXT NOT NULL DEFAULT '',

            mention_enabled INTEGER NOT NULL DEFAULT 1,
            mention_max_count INTEGER NOT NULL DEFAULT 5,
            mention_actions TEXT NOT NULL DEFAULT 'delete,warn,mute',

            invite_enabled INTEGER NOT NULL DEFAULT 0,
            invite_actions TEXT NOT NULL DEFAULT 'delete,notify',

            raid_enabled INTEGER NOT NULL DEFAULT 0,
            raid_join_threshold INTEGER NOT NULL DEFAULT 10,
            raid_interval_seconds INTEGER NOT NULL DEFAULT 60,
            raid_action TEXT NOT NULL DEFAULT 'lockdown'

        );

    `);

    db.run(`

        CREATE TABLE IF NOT EXISTS automod_raid_locks (

            guild_id TEXT NOT NULL,

            channel_id TEXT NOT NULL,

            PRIMARY KEY (guild_id, channel_id)

        );

    `);

});

// Helpers

function run(sql, params = []) {

    return new Promise((resolve, reject) => {

        db.run(
            sql,
            params,
            function (err) {

                if (err)
                    reject(err);
                else
                    resolve(this);

            }
        );

    });

}

function get(sql, params = []) {

    return new Promise((resolve, reject) => {

        db.get(
            sql,
            params,
            (err, row) => {

                if (err)
                    reject(err);
                else
                    resolve(row);

            }
        );

    });

}

function all(sql, params = []) {

    return new Promise((resolve, reject) => {

        db.all(
            sql,
            params,
            (err, rows) => {

                if (err)
                    reject(err);
                else
                    resolve(rows);

            }
        );

    });

}

module.exports = {

    db,

    run,

    get,

    all

};