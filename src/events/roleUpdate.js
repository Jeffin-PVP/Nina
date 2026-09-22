const { Events, AuditLogEvent, PermissionsBitField } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const fetchExecutor = require("../utils/fetchExecutor");
const actionSuppression = require("../utils/actionSuppression");

module.exports = {

    name: Events.GuildRoleUpdate,

    async execute(oldRole, newRole) {

        // Reservado para ferramentas de cargo que venham a logar manualmente
        if (actionSuppression.isSuppressed(`role:${newRole.id}`)) return;

        const changes = [];

        if (oldRole.name !== newRole.name) {
            changes.push(`Nome: \`${oldRole.name}\` → \`${newRole.name}\``);
        }

        if (oldRole.hexColor !== newRole.hexColor) {
            changes.push(`Cor: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
        }

        if (!oldRole.permissions.equals(newRole.permissions)) {

            const added = new PermissionsBitField(newRole.permissions)
                .remove(oldRole.permissions)
                .toArray();

            const removed = new PermissionsBitField(oldRole.permissions)
                .remove(newRole.permissions)
                .toArray();

            if (added.length) changes.push(`➕ Permissões: ${added.join(", ")}`);
            if (removed.length) changes.push(`➖ Permissões: ${removed.join(", ")}`);

        }

        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`Exibido separadamente: \`${oldRole.hoist}\` → \`${newRole.hoist}\``);
        }

        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(`Mencionável: \`${oldRole.mentionable}\` → \`${newRole.mentionable}\``);
        }

        if (!changes.length) return; // mudança irrelevante (ex: posição), ignora

        const executor = await fetchExecutor(
            newRole.guild,
            AuditLogEvent.RoleUpdate,
            newRole.id
        );

        await LogManager.send({
            type: LogTypes.ROLE_UPDATE,
            guild: newRole.guild,
            executor,
            extra: { role: newRole, changes }
        });

    }

};
