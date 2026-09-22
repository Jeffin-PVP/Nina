const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");

module.exports = {

    name: Events.GuildMemberUpdate,

    async execute(oldMember, newMember) {

        // Apelido alterado

        if (oldMember.nickname !== newMember.nickname) {

            await LogManager.send({
                type: LogTypes.MEMBER_NICKNAME,
                guild: newMember.guild,
                target: newMember,
                extra: {
                    before: oldMember.nickname,
                    after: newMember.nickname
                }
            });

        }

        // Começou a impulsionar o servidor

        if (!oldMember.premiumSince && newMember.premiumSince) {

            await LogManager.send({
                type: LogTypes.MEMBER_BOOST,
                guild: newMember.guild,
                target: newMember
            });

        }

        // Parou de impulsionar o servidor

        if (oldMember.premiumSince && !newMember.premiumSince) {

            await LogManager.send({
                type: LogTypes.MEMBER_UNBOOST,
                guild: newMember.guild,
                target: newMember
            });

        }

        // Cargos adicionados/removidos

        const addedRoles = newMember.roles.cache
            .filter(role => !oldMember.roles.cache.has(role.id));

        const removedRoles = oldMember.roles.cache
            .filter(role => !newMember.roles.cache.has(role.id));

        for (const role of addedRoles.values()) {

            await LogManager.send({
                type: LogTypes.ROLE_ADD,
                guild: newMember.guild,
                target: newMember,
                extra: { role }
            });

        }

        for (const role of removedRoles.values()) {

            await LogManager.send({
                type: LogTypes.ROLE_REMOVE,
                guild: newMember.guild,
                target: newMember,
                extra: { role }
            });

        }

    }

};
