const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const AntiNukeManager = require("../managers/AntiNukeManager");

const ServerStatsManager = require("../managers/ServerStatsManager");

module.exports = {

    name: Events.GuildRoleDelete,

    async execute(role) {

        const executor = await fetchExecutor(
            role.guild,
            AuditLogEvent.RoleDelete
        );

        await AntiNukeManager.detectRole(role.guild, "role_delete", role.id, executor).catch(() => {});

        await LogManager.send({
            type: LogTypes.ROLE_DELETE,
            guild: role.guild,
            executor,
            extra: { role }
        });

        await ServerStatsManager.updateGuild(role.guild).catch(() => {});

    }

};
