const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const database = fs.readFileSync(path.join(root, "src/database/database.js"), "utf8");
const guildRepo = fs.readFileSync(path.join(root, "src/database/repositories/GuildRepository.js"), "utf8");
const logManager = fs.readFileSync(path.join(root, "src/managers/LogManager.js"), "utf8");
const configPanel = fs.readFileSync(path.join(root, "src/managers/ConfigPanelManager.js"), "utf8");
const configHandler = fs.readFileSync(path.join(root, "src/interactions/config/panelHandler.js"), "utf8");
const panelRoutes = fs.readFileSync(path.join(root, "src/api/panelRoutes.js"), "utf8");

assert.match(database, /stats_logs_enabled INTEGER NOT NULL DEFAULT 0/);
assert.match(database, /ALTER TABLE guild_settings ADD COLUMN stats_logs_enabled/);
assert.match(guildRepo, /isStatsLogsEnabled/);
assert.match(guildRepo, /setStatsLogsEnabled/);
assert.match(logManager, /ServerStatsManager\.isStatsChannel/);
assert.match(logManager, /GuildRepository\.isStatsLogsEnabled/);
assert.match(configPanel, /config_logs:stats/);
assert.match(configHandler, /id === "config_logs:stats"/);
assert.match(panelRoutes, /logs\/stats/);

console.log("statsLogs.test.js: OK");
