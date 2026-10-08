const { PermissionFlagsBits } = require("discord.js");

const AutoroleRepository = require("../../database/repositories/AutoroleRepository");
const { normalizeReactionEmoji } = require("../../utils/reactionEmoji");

async function execute(reaction, user, adding) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;
    const guild = message.guild;
    if (!guild) return;

    const key = reaction.emoji.id
        ? `custom:${reaction.emoji.id}`
        : normalizeReactionEmoji(reaction.emoji.name);
    const entry = await AutoroleRepository.getReactionRole(guild.id, message.id, key);
    if (!entry) return;

    const role = guild.roles.cache.get(entry.role_id);
    const member = await guild.members.fetch(user.id);
    if (!role) {
        throw new Error(`Cargo da reação ${entry.role_id} não existe mais no servidor ${guild.id}.`);
    }

    if (adding) {
        const botMember = guild.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.position >= botMember.roles.highest.position) {
            throw new Error(`A Nina não consegue atribuir o cargo ${role.id} devido às permissões ou hierarquia.`);
        }
        if (!member.roles.cache.has(role.id)) await member.roles.add(role, "Cargo por reação");
    } else if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "Reação de cargo removida");
    }
}

module.exports = {
    add: (reaction, user) => execute(reaction, user, true),
    remove: (reaction, user) => execute(reaction, user, false)
};
