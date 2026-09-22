/**
 * Busca no audit log o membro responsável por uma ação recente.
 * Usado nos eventos nativos do Discord (canal/cargo/etc), que não
 * informam quem fez a ação diretamente.
 *
 * @param {import("discord.js").Guild} guild
 * @param {import("discord.js").AuditLogEvent} auditType
 * @param {string} [targetId] ID do alvo esperado, para casar a entrada certa.
 * @returns {Promise<import("discord.js").User|null>}
 */
async function fetchExecutor(guild, auditType, targetId = null) {

    try {

        if (!guild.members.me.permissions.has("ViewAuditLog")) {
            return null;
        }

        const logs = await guild.fetchAuditLogs({
            type: auditType,
            limit: 5
        });

        const entry = targetId
            ? logs.entries.find(entry => entry.target?.id === targetId)
            : logs.entries.first();

        if (!entry) {
            return null;
        }

        // Evita pegar uma entrada muito antiga (> 10s) e atribuir errado
        if (Date.now() - entry.createdTimestamp > 10_000) {
            return null;
        }

        return entry.executor;

    } catch {

        return null;

    }

}

module.exports = fetchExecutor;
