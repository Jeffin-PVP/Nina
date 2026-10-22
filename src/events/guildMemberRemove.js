const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const AntiNukeManager = require("../managers/AntiNukeManager");

const ServerStatsManager = require("../managers/ServerStatsManager");
const AnalyticsRepository = require("../database/repositories/AnalyticsRepository");

module.exports = {

    name: Events.GuildMemberRemove,

    async execute(member) {

        if (!member.user?.bot) {
            await AnalyticsRepository.recordMember(member.guild.id, "leaves").catch(error => {
                console.error("[Analytics] Falha ao registrar saída:", error);
            });
        }

        await AntiNukeManager.detectKick(member.guild, member.id, member).catch(() => {});

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

        await ServerStatsManager.updateGuild(member.guild).catch(() => {});

    }

};
