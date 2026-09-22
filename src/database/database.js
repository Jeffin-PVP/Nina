const mysql = require("mysql2/promise");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL não foi configurada no .env.");
}

let parsedUrl;
try {
    parsedUrl = new URL(databaseUrl);
} catch (error) {
    throw new Error("DATABASE_URL inválida. Use a URL MySQL fornecida pela InjectCloud.");
}

const pool = mysql.createPool({
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 3306),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: "utf8mb4"
});

let initialized = false;
let initializationPromise = null;

async function run(sql, params = []) {
    await ensureInitialized();

    const [result] = await pool.execute(sql, params);

    // Mantemos lastID/changes como aliases para os repositórios antigos da Nina.
    return {
        ...result,
        insertId: result.insertId,
        lastID: result.insertId,
        affectedRows: result.affectedRows,
        changes: result.affectedRows
    };
}

async function get(sql, params = []) {
    await ensureInitialized();

    const [rows] = await pool.execute(sql, params);
    return rows[0];
}

async function all(sql, params = []) {
    await ensureInitialized();

    const [rows] = await pool.execute(sql, params);
    return rows;
}

async function testConnection() {
    const connection = await pool.getConnection();

    try {
        await connection.ping();
        console.log("🗄️ MySQL da InjectCloud conectado");
    } finally {
        connection.release();
    }
}

async function initializeDatabase() {
    if (initialized) return;

    await testConnection();

    const statements = [
        `CREATE TABLE IF NOT EXISTS economy_users (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            wallet BIGINT NOT NULL DEFAULT 0,
            bank BIGINT NOT NULL DEFAULT 0,
            xp BIGINT NOT NULL DEFAULT 0,
            level INT NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            daily_at BIGINT NULL,
            work_at BIGINT NULL,
            PRIMARY KEY (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS economy_transactions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            amount BIGINT NOT NULL,
            type VARCHAR(50) NOT NULL,
            description TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_economy_transactions_user (guild_id, user_id),
            INDEX idx_economy_transactions_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS warnings (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            moderator_id VARCHAR(32) NOT NULL,
            reason TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_warnings_user (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS inventories (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id VARCHAR(32) NOT NULL,
            guild_id VARCHAR(32) NOT NULL,
            item_id VARCHAR(100) NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            UNIQUE KEY uq_inventory_item (user_id, guild_id, item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS cooldowns (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id VARCHAR(32) NOT NULL,
            guild_id VARCHAR(32) NOT NULL,
            command VARCHAR(100) NOT NULL,
            expires_at BIGINT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_cooldown (user_id, guild_id, command)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id VARCHAR(32) NOT NULL,
            log_channel VARCHAR(32) NULL,
            economy_enabled TINYINT(1) NOT NULL DEFAULT 1,
            moderation_enabled TINYINT(1) NOT NULL DEFAULT 1,
            prefix VARCHAR(20) NOT NULL DEFAULT '!',
            log_disabled_categories TEXT NULL,
            levelup_enabled TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id VARCHAR(32) NOT NULL,
            parent_channel_id VARCHAR(32) NULL,
            support_role_id VARCHAR(32) NULL,
            panel_channel_id VARCHAR(32) NULL,
            next_number INT NOT NULL DEFAULT 1,
            enabled TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS tickets (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            number INT NOT NULL,
            thread_id VARCHAR(32) NOT NULL,
            parent_channel_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            claimed_by VARCHAR(32) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME NULL,
            closed_by VARCHAR(32) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_ticket_thread (thread_id),
            INDEX idx_tickets_guild_status (guild_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS autorole_join (
            guild_id VARCHAR(32) NOT NULL,
            role_ids TEXT NULL,
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS autorole_selfroles (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            label VARCHAR(255) NOT NULL,
            emoji VARCHAR(255) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_autorole_selfrole (guild_id, role_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS autorole_levels (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            level INT NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_autorole_level (guild_id, level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS giveaways (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            channel_id VARCHAR(32) NOT NULL,
            message_id VARCHAR(32) NULL,
            host_id VARCHAR(32) NOT NULL,
            prize TEXT NOT NULL,
            winners_count INT NOT NULL DEFAULT 1,
            required_role_id VARCHAR(32) NULL,
            ends_at BIGINT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'running',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_giveaways_running (guild_id, status, ends_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS giveaway_entries (
            giveaway_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (giveaway_id, user_id),
            CONSTRAINT fk_giveaway_entries_giveaway
                FOREIGN KEY (giveaway_id) REFERENCES giveaways(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS giveaway_multipliers (
            guild_id VARCHAR(32) NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            multiplier INT NOT NULL DEFAULT 2,
            PRIMARY KEY (guild_id, role_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS bot_presence (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            type VARCHAR(30) NOT NULL DEFAULT 'WATCHING',
            text VARCHAR(255) NOT NULL,
            position INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS bot_settings (
            \`key\` VARCHAR(255) NOT NULL,
            value TEXT NULL,
            PRIMARY KEY (\`key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS bot_stats_history (
            date VARCHAR(20) NOT NULL,
            servers INT NOT NULL,
            members INT NOT NULL,
            PRIMARY KEY (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS broadcasts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NULL,
            description TEXT NOT NULL,
            color VARCHAR(20) NULL,
            kind VARCHAR(50) NOT NULL DEFAULT 'broadcast',
            sent_count INT NOT NULL DEFAULT 0,
            failed_count INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS banned_guilds (
            guild_id VARCHAR(32) NOT NULL,
            guild_name VARCHAR(255) NULL,
            reason TEXT NULL,
            banned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS welcome_settings (
            guild_id VARCHAR(32) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            channel_id VARCHAR(32) NULL,
            background_url TEXT NULL,
            title_text VARCHAR(255) NULL,
            subtitle_text VARCHAR(255) NULL,
            message_content TEXT NULL,
            accent_color VARCHAR(20) NOT NULL DEFAULT '#5865F2',
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS automod_settings (
            guild_id VARCHAR(32) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            ignored_channels TEXT NOT NULL,
            ignored_roles TEXT NOT NULL,
            mute_duration_minutes INT NOT NULL DEFAULT 10,
            spam_enabled TINYINT(1) NOT NULL DEFAULT 1,
            spam_max_messages INT NOT NULL DEFAULT 6,
            spam_interval_seconds INT NOT NULL DEFAULT 6,
            spam_actions VARCHAR(255) NOT NULL DEFAULT 'delete,notify,warn',
            emoji_enabled TINYINT(1) NOT NULL DEFAULT 1,
            emoji_max_count INT NOT NULL DEFAULT 10,
            emoji_actions VARCHAR(255) NOT NULL DEFAULT 'delete,notify',
            swear_enabled TINYINT(1) NOT NULL DEFAULT 1,
            swear_actions VARCHAR(255) NOT NULL DEFAULT 'delete,notify,warn',
            swear_custom_words TEXT NOT NULL,
            mention_enabled TINYINT(1) NOT NULL DEFAULT 1,
            mention_max_count INT NOT NULL DEFAULT 5,
            mention_actions VARCHAR(255) NOT NULL DEFAULT 'delete,warn,mute',
            invite_enabled TINYINT(1) NOT NULL DEFAULT 0,
            invite_actions VARCHAR(255) NOT NULL DEFAULT 'delete,notify',
            raid_enabled TINYINT(1) NOT NULL DEFAULT 0,
            raid_join_threshold INT NOT NULL DEFAULT 10,
            raid_interval_seconds INT NOT NULL DEFAULT 60,
            raid_action VARCHAR(50) NOT NULL DEFAULT 'lockdown',
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS automod_raid_locks (
            guild_id VARCHAR(32) NOT NULL,
            channel_id VARCHAR(32) NOT NULL,
            PRIMARY KEY (guild_id, channel_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const statement of statements) {
            await connection.query(statement);
        }

        await connection.commit();
        initialized = true;
        console.log("✔ Estrutura MySQL da Nina verificada/criada");
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function ensureInitialized() {
    if (initialized) return;

    if (!initializationPromise) {
        initializationPromise = initializeDatabase()
            .catch(error => {
                initializationPromise = null;
                throw error;
            });
    }

    await initializationPromise;
}

module.exports = {
    pool,
    db: pool,
    run,
    get,
    all,
    testConnection,
    initializeDatabase
};
