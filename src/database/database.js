const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// O banco fica FORA de src/ para sobreviver à organização interna do código.
// Estrutura: <raiz da Nina>/data/nina.db
const dataDir = path.resolve(__dirname, "../../data");
const databasePath = path.join(dataDir, "nina.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(databasePath);

// SQLite otimizado para um bot com várias leituras/escritas pequenas.
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -4096;
    PRAGMA wal_autocheckpoint = 1000;
    PRAGMA journal_size_limit = 4194304;
`);

// Reaproveita statements já compilados (evita recompilar o SQL a cada consulta).
// Limite pequeno para não crescer sem controle com SQL dinâmico.
const STATEMENT_CACHE_MAX = 150;
const statementCache = new Map();

function prepare(sql) {
    let statement = statementCache.get(sql);
    if (statement) return statement;

    statement = db.prepare(sql);
    if (statementCache.size >= STATEMENT_CACHE_MAX) {
        statementCache.delete(statementCache.keys().next().value);
    }
    statementCache.set(sql, statement);
    return statement;
}

let initialized = false;
let initializationPromise = null;

const statements = [
    `CREATE TABLE IF NOT EXISTS economy_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        wallet INTEGER NOT NULL DEFAULT 0,
        bank INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        daily_at INTEGER NULL,
        work_at INTEGER NULL,
        PRIMARY KEY (guild_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS economy_global_users (
        user_id TEXT PRIMARY KEY,
        wallet INTEGER NOT NULL DEFAULT 0 CHECK (wallet >= 0),
        bank INTEGER NOT NULL DEFAULT 0 CHECK (bank >= 0),
        daily_at INTEGER NULL,
        work_at INTEGER NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS economy_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS inventories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        UNIQUE (user_id, guild_id, item_id)
    )`,

    `CREATE TABLE IF NOT EXISTS cooldowns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        command TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE (user_id, guild_id, command)
    )`,

    `CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT NOT NULL,
        log_channel TEXT NULL,
        economy_enabled INTEGER NOT NULL DEFAULT 1,
        moderation_enabled INTEGER NOT NULL DEFAULT 1,
        prefix TEXT NOT NULL DEFAULT '!',
        log_disabled_categories TEXT NULL,
        stats_logs_enabled INTEGER NOT NULL DEFAULT 0,
        levelup_enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS ticket_config (
        guild_id TEXT NOT NULL,
        parent_channel_id TEXT NULL,
        support_role_id TEXT NULL,
        panel_channel_id TEXT NULL,
        next_number INTEGER NOT NULL DEFAULT 1,
        enabled INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        thread_id TEXT NOT NULL,
        parent_channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        claimed_by TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TEXT NULL,
        closed_by TEXT NULL,
        UNIQUE (thread_id)
    )`,

    `CREATE TABLE IF NOT EXISTS autorole_join (
        guild_id TEXT NOT NULL,
        role_ids TEXT NULL,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS autorole_selfroles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        label TEXT NOT NULL,
        emoji TEXT NULL,
        UNIQUE (guild_id, role_id)
    )`,

    `CREATE TABLE IF NOT EXISTS autorole_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        emoji_key TEXT NOT NULL,
        UNIQUE (guild_id, message_id, emoji_key)
    )`,

    `CREATE TABLE IF NOT EXISTS lockdown_settings (
        guild_id TEXT NOT NULL PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 0,
        channel_ids TEXT NOT NULL DEFAULT '[]',
        category_ids TEXT NOT NULL DEFAULT '[]',
        allowed_role_ids TEXT NOT NULL DEFAULT '[]',
        denied_role_ids TEXT NOT NULL DEFAULT '[]'
    )`,

    `CREATE TABLE IF NOT EXISTS lockdown_snapshots (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        overwrites_json TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
    )`,

    `CREATE TABLE IF NOT EXISTS autorole_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        UNIQUE (guild_id, level)
    )`,

    `CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NULL,
        host_id TEXT NOT NULL,
        prize TEXT NOT NULL,
        winners_count INTEGER NOT NULL DEFAULT 1,
        required_role_id TEXT NULL,
        ends_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (giveaway_id, user_id),
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS giveaway_multipliers (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        multiplier INTEGER NOT NULL DEFAULT 2,
        PRIMARY KEY (guild_id, role_id)
    )`,

    `CREATE TABLE IF NOT EXISTS bot_presence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'WATCHING',
        text TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT NOT NULL,
        value TEXT NULL,
        PRIMARY KEY (key)
    )`,

    `CREATE TABLE IF NOT EXISTS bot_stats_history (
        date TEXT NOT NULL,
        servers INTEGER NOT NULL,
        members INTEGER NOT NULL,
        PRIMARY KEY (date)
    )`,

    // Analytics por servidor: apenas agregados, sem armazenar conteúdo de mensagens.
    `CREATE TABLE IF NOT EXISTS analytics_daily (
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        joins INTEGER NOT NULL DEFAULT 0,
        leaves INTEGER NOT NULL DEFAULT 0,
        voice_seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, date)
    )`,

    `CREATE TABLE IF NOT EXISTS analytics_channel_daily (
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL DEFAULT '',
        messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, date, channel_id)
    )`,

    `CREATE TABLE IF NOT EXISTS analytics_user_daily (
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        voice_seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, date, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS analytics_voice_sessions (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS analytics_hourly (
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL,
        hour INTEGER NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, date, hour)
    )`,

    `CREATE TABLE IF NOT EXISTS analytics_voice_channel_daily (
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL DEFAULT '',
        voice_seconds INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, date, channel_id)
    )`,

    `CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NULL,
        description TEXT NOT NULL,
        color TEXT NULL,
        kind TEXT NOT NULL DEFAULT 'broadcast',
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS banned_guilds (
        guild_id TEXT NOT NULL,
        guild_name TEXT NULL,
        reason TEXT NULL,
        banned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS global_bans (
        user_id TEXT NOT NULL,
        user_tag TEXT NULL,
        reason TEXT NULL,
        banned_by TEXT NULL,
        banned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS welcome_settings (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        channel_id TEXT NULL,
        background_url TEXT NULL,
        title_text TEXT NULL,
        subtitle_text TEXT NULL,
        message_content TEXT NULL,
        accent_color TEXT NOT NULL DEFAULT '#5865F2',
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS automod_settings (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        ignored_channels TEXT NOT NULL,
        ignored_roles TEXT NOT NULL,
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
        swear_custom_words TEXT NOT NULL,
        mention_enabled INTEGER NOT NULL DEFAULT 1,
        mention_max_count INTEGER NOT NULL DEFAULT 5,
        mention_actions TEXT NOT NULL DEFAULT 'delete,warn,mute',
        invite_enabled INTEGER NOT NULL DEFAULT 0,
        invite_actions TEXT NOT NULL DEFAULT 'delete,notify',
        raid_enabled INTEGER NOT NULL DEFAULT 0,
        raid_join_threshold INTEGER NOT NULL DEFAULT 10,
        raid_interval_seconds INTEGER NOT NULL DEFAULT 60,
        raid_action TEXT NOT NULL DEFAULT 'lockdown',
        image_enabled INTEGER NOT NULL DEFAULT 0,
        image_action TEXT NOT NULL DEFAULT 'ignore',
        image_threshold REAL NOT NULL DEFAULT 0.850,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS server_stats (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        members_enabled INTEGER NOT NULL DEFAULT 1,
        bots_enabled INTEGER NOT NULL DEFAULT 1,
        online_enabled INTEGER NOT NULL DEFAULT 1,
        offline_enabled INTEGER NOT NULL DEFAULT 1,
        voice_enabled INTEGER NOT NULL DEFAULT 1,
        channels_enabled INTEGER NOT NULL DEFAULT 1,
        categories_enabled INTEGER NOT NULL DEFAULT 1,
        roles_enabled INTEGER NOT NULL DEFAULT 1,
        servers_enabled INTEGER NOT NULL DEFAULT 1,
        category_id TEXT NULL,
        channel_ids TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS temp_voice_settings (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        category_id TEXT NULL,
        trigger_channel_id TEXT NULL,
        panel_channel_id TEXT NULL,
        default_limit INTEGER NOT NULL DEFAULT 0,
        auto_lock INTEGER NOT NULL DEFAULT 0,
        name_template TEXT NOT NULL DEFAULT '🔊 {user}',
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS temp_voice_rooms (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (channel_id)
    )`,

    `CREATE TABLE IF NOT EXISTS temp_voice_bans (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (channel_id, user_id)
    )`,

    // Gravação de calls: aqui ficam SOMENTE configurações e metadados.
    // O áudio nunca é gravado em disco nem no banco da Nina (vai direto para a API de IA).
    `CREATE TABLE IF NOT EXISTS voice_recording_settings (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        allowed_role_ids TEXT NOT NULL DEFAULT '[]',
        allowed_channel_ids TEXT NOT NULL DEFAULT '[]',
        blocked_channel_ids TEXT NOT NULL DEFAULT '[]',
        max_minutes INTEGER NOT NULL DEFAULT 120,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS voice_recordings (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL DEFAULT '',
        started_by TEXT NOT NULL,
        started_by_name TEXT NOT NULL DEFAULT '',
        started_at INTEGER NOT NULL,
        ended_at INTEGER NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        remote_id TEXT NULL,
        status TEXT NOT NULL DEFAULT 'recording',
        transcript_status TEXT NOT NULL DEFAULT 'none',
        participants TEXT NOT NULL DEFAULT '[]'
    )`,

    // Texto da transcrição feita direto no Groq (sem API externa). Só texto: o áudio não é guardado.
    `CREATE TABLE IF NOT EXISTS voice_transcript_segments (
        recording_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start_ms INTEGER NOT NULL DEFAULT 0,
        end_ms INTEGER NOT NULL DEFAULT 0,
        text TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS antinuke_settings (
        guild_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        action TEXT NOT NULL DEFAULT 'ban',
        window_seconds INTEGER NOT NULL DEFAULT 10,
        channel_limit INTEGER NOT NULL DEFAULT 3,
        role_limit INTEGER NOT NULL DEFAULT 3,
        member_limit INTEGER NOT NULL DEFAULT 3,
        bot_limit INTEGER NOT NULL DEFAULT 1,
        webhook_limit INTEGER NOT NULL DEFAULT 3,
        PRIMARY KEY (guild_id)
    )`,

    `CREATE TABLE IF NOT EXISTS automod_raid_locks (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        prev_send TEXT NOT NULL DEFAULT 'neutral',
        PRIMARY KEY (guild_id, channel_id)
    )`,

    `CREATE TABLE IF NOT EXISTS security_settings (
        guild_id TEXT NOT NULL PRIMARY KEY,
        topic_enabled INTEGER NOT NULL DEFAULT 0,
        contextual_enabled INTEGER NOT NULL DEFAULT 0,
        topic_warn_enabled INTEGER NOT NULL DEFAULT 0,
        topic_timeout_enabled INTEGER NOT NULL DEFAULT 0,
        topic_timeout_minutes INTEGER NOT NULL DEFAULT 5,
        honeypot_enabled INTEGER NOT NULL DEFAULT 0,
        honeypot_channel_id TEXT NULL,
        honeypot_action TEXT NOT NULL DEFAULT 'ban',
        honeypot_message_id TEXT NULL,
        honeypot_notice_channel_id TEXT NULL,
        behavior_enabled INTEGER NOT NULL DEFAULT 0,
        alert_channel_id TEXT NULL,
        ignored_roles TEXT NOT NULL DEFAULT '[]'
    )`,

    `CREATE TABLE IF NOT EXISTS security_topic_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        keywords_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NULL,
        user_id TEXT NULL,
        event_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        details_json TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
];

const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions (guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_economy_transactions_created ON economy_transactions (created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings (guild_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets (guild_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_giveaways_running ON giveaways (guild_id, status, ends_at)`,
    `CREATE INDEX IF NOT EXISTS idx_global_bans_banned_at ON global_bans (banned_at)`,
    `CREATE INDEX IF NOT EXISTS idx_temp_voice_rooms_guild ON temp_voice_rooms (guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_temp_voice_bans_guild ON temp_voice_bans (guild_id)`,
    `CREATE INDEX IF NOT EXISTS idx_voice_recordings_guild ON voice_recordings (guild_id, started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_voice_transcript_segments_recording ON voice_transcript_segments (recording_id, start_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_security_topic_rules_guild_channel ON security_topic_rules (guild_id, channel_id, enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_guild_created ON security_events (guild_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily (guild_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_channel_date ON analytics_channel_daily (guild_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics_user_daily (guild_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_voice_started ON analytics_voice_sessions (started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_hourly_date ON analytics_hourly (guild_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_analytics_voicech_date ON analytics_voice_channel_daily (guild_id, date)`
];

function migrateGuildSettingsSchema() {
    const columns = new Set(db.prepare("PRAGMA table_info(guild_settings)").all().map(row => row.name));
    if (!columns.has("stats_logs_enabled")) {
        db.exec("ALTER TABLE guild_settings ADD COLUMN stats_logs_enabled INTEGER NOT NULL DEFAULT 0");
    }
}

function migrateAutomodRaidLocksSchema() {
    const columns = new Set(db.prepare("PRAGMA table_info(automod_raid_locks)").all().map(row => row.name));
    if (!columns.has("prev_send")) {
        db.exec("ALTER TABLE automod_raid_locks ADD COLUMN prev_send TEXT NOT NULL DEFAULT 'neutral'");
    }
}

function migrateSecuritySchema() {
    const columns = new Set(db.prepare("PRAGMA table_info(security_settings)").all().map(row => row.name));
    const migrations = [
        ["topic_warn_enabled", "INTEGER NOT NULL DEFAULT 0"],
        ["topic_timeout_enabled", "INTEGER NOT NULL DEFAULT 0"],
        ["topic_timeout_minutes", "INTEGER NOT NULL DEFAULT 5"],
        ["honeypot_action", "TEXT NOT NULL DEFAULT 'ban'"],
        ["honeypot_message_id", "TEXT NULL"],
        ["honeypot_notice_channel_id", "TEXT NULL"]
    ];
    const hadHoneypotAction = columns.has("honeypot_action");
    for (const [name, definition] of migrations) {
        if (columns.size && !columns.has(name)) db.exec(`ALTER TABLE security_settings ADD COLUMN ${name} ${definition}`);
    }
    // Servidores que já usavam o canal-isca (apenas alertas) continuam só registrando
    // até o administrador escolher a ação e publicar o aviso: nada de ban sem aviso prévio.
    if (columns.size && !hadHoneypotAction) {
        db.exec("UPDATE security_settings SET honeypot_action = 'log' WHERE honeypot_enabled = 1");
    }
}

function migrateTicketSchema() {
    const columns = new Set(db.prepare("PRAGMA table_info(ticket_config)").all().map(row => row.name));
    const migrations = [
        ["mode", "TEXT NOT NULL DEFAULT 'thread'"],
        ["category_id", "TEXT NULL"]
    ];
    for (const [name, definition] of migrations) {
        if (!columns.has(name)) db.exec(`ALTER TABLE ticket_config ADD COLUMN ${name} ${definition}`);
    }
}

function migrateTempVoiceSchema() {
    const columns = new Set(db.prepare("PRAGMA table_info(temp_voice_settings)").all().map(row => row.name));
    const migrations = [
        ["admin_manage", "INTEGER NOT NULL DEFAULT 1"],
        ["manager_role_id", "TEXT NULL"],
        ["owner_rename", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_lock", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_limit", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_kick", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_ban", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_transfer", "INTEGER NOT NULL DEFAULT 1"],
        ["owner_delete", "INTEGER NOT NULL DEFAULT 1"]
    ];
    for (const [name, definition] of migrations) {
        if (!columns.has(name)) db.exec(`ALTER TABLE temp_voice_settings ADD COLUMN ${name} ${definition}`);
    }
}

function migrateGlobalEconomy() {
    // Executa uma única vez: preserva os saldos antigos somando os saldos por servidor.
    const marker = db.prepare("SELECT value FROM bot_settings WHERE key = ?").get("economy_global_migration_v1");
    if (marker) return;

    db.exec(`
        INSERT INTO economy_global_users (user_id, wallet, bank, daily_at, work_at)
        SELECT user_id,
               SUM(wallet),
               SUM(bank),
               MAX(daily_at),
               MAX(work_at)
        FROM economy_users
        GROUP BY user_id
        ON CONFLICT(user_id) DO UPDATE SET
            wallet = economy_global_users.wallet + excluded.wallet,
            bank = economy_global_users.bank + excluded.bank,
            daily_at = CASE WHEN economy_global_users.daily_at IS NULL THEN excluded.daily_at WHEN excluded.daily_at IS NULL THEN economy_global_users.daily_at ELSE MAX(economy_global_users.daily_at, excluded.daily_at) END,
            work_at = CASE WHEN economy_global_users.work_at IS NULL THEN excluded.work_at WHEN excluded.work_at IS NULL THEN economy_global_users.work_at ELSE MAX(economy_global_users.work_at, excluded.work_at) END
    `);
    db.prepare("INSERT INTO bot_settings (key, value) VALUES (?, ?)").run("economy_global_migration_v1", new Date().toISOString());
}

function initializeDatabase() {
    if (initialized) return;

    db.exec("BEGIN");
    try {
        for (const statement of statements) db.exec(statement);
        migrateGlobalEconomy();
        // A economia usa um único saldo global: incorpora saldos bancários antigos à carteira.
        db.exec("UPDATE economy_global_users SET wallet = wallet + bank, bank = 0 WHERE bank <> 0");
        for (const statement of indexes) db.exec(statement);
        migrateGuildSettingsSchema();
        migrateTempVoiceSchema();
        migrateTicketSchema();
        migrateAutomodRaidLocksSchema();
        migrateSecuritySchema();
        db.exec("COMMIT");
        initialized = true;
        console.log(`🗄️ SQLite conectado: ${databasePath}`);
        console.log("✔ Estrutura SQLite da Nina verificada/criada");
    } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
    }
}

function ensureInitialized() {
    if (initialized) return;
    if (!initializationPromise) {
        initializationPromise = Promise.resolve().then(() => initializeDatabase())
            .catch(error => {
                initializationPromise = null;
                throw error;
            });
    }
    return initializationPromise;
}

async function run(sql, params = []) {
    await ensureInitialized();
    const statement = prepare(sql);
    const result = statement.run(...params);
    return {
        ...result,
        insertId: Number(result.lastInsertRowid),
        lastID: Number(result.lastInsertRowid),
        affectedRows: Number(result.changes),
        changes: Number(result.changes)
    };
}

async function get(sql, params = []) {
    await ensureInitialized();
    return prepare(sql).get(...params) || undefined;
}

async function all(sql, params = []) {
    await ensureInitialized();
    return prepare(sql).all(...params);
}

async function testConnection() {
    await ensureInitialized();
    const row = db.prepare("SELECT 1 AS ok").get();
    if (!row?.ok) throw new Error("SQLite não respondeu ao teste de conexão.");
    return true;
}

function close() {
    if (!db) return;
    try { db.close(); } catch {}
}

// Registrar um listener de SIGINT/SIGTERM remove o comportamento padrão de
// encerrar o processo; por isso, depois de fechar o banco, saímos explicitamente.
function shutdown() {
    close();
    process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

module.exports = {
    db,
    database: db,
    databasePath,
    run,
    get,
    all,
    testConnection,
    initializeDatabase,
    close
};
