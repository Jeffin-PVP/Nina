const { Events, AuditLogEvent } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");

module.exports = {

    name: Events.GuildRoleCreate,

    async execute(role) {

        const executor = await fetchExecutor(
            role.guild,
            AuditLogEvent.RoleCreate,
            role.id
        );

        await LogManager.send({
            type: LogTypes.ROLE_CREATE,
            guild: role.guild,
            executor,
            extra: { role }
        });

    }

};
