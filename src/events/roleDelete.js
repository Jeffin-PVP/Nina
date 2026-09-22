const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");

module.exports = {

    name: Events.GuildRoleDelete,

    async execute(role) {

        const executor = await fetchExecutor(
            role.guild,
            AuditLogEvent.RoleDelete
        );

        await LogManager.send({
            type: LogTypes.ROLE_DELETE,
            guild: role.guild,
            executor,
            extra: { role }
        });

    }

};
