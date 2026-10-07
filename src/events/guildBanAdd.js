const { Events } = require("discord.js");
const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const AntiNukeManager = require("../managers/AntiNukeManager");

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        const executor = await fetchExecutor(ban.guild, require("discord.js").AuditLogEvent.MemberBanAdd, ban.user.id);

        await AntiNukeManager.record({
            guild: ban.guild,
            type: "member_ban",
            executor,
            target: ban.user
        }).catch(() => {});

        await LogManager.send({
            type: LogTypes.BAN,
            guild: ban.guild,
            target: ban.user,
            executor,
            reason: "Ban registrado pelo Discord."
        });
    }
};
