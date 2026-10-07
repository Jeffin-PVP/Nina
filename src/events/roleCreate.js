const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const AntiNukeManager = require("../managers/AntiNukeManager");

const ServerStatsManager = require("../managers/ServerStatsManager");

module.exports = {

    name: Events.GuildRoleCreate,

    async execute(role) {

        const executor = await fetchExecutor(
            role.guild,
            AuditLogEvent.RoleCreate,
            role.id
        );

        await AntiNukeManager.detectRole(role.guild, "role_create", role.id, executor).catch(() => {});

        await LogManager.send({
            type: LogTypes.ROLE_CREATE,
            guild: role.guild,
            executor,
            extra: { role }
        });

        await ServerStatsManager.updateGuild(role.guild).catch(() => {});

    }

};
