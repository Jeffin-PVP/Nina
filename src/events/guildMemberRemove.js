const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");

module.exports = {

    name: Events.GuildMemberRemove,

    async execute(member) {

        const roles = member.roles?.cache
            ? member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.name)
            : [];

        await LogManager.send({
            type: LogTypes.MEMBER_LEAVE,
            guild: member.guild,
            target: member,
            extra: {
                joinedTimestamp: member.joinedTimestamp ?? null,
                roles
            }
        });

    }

};
