/**
 * Verificações comuns antes de uma ação de moderação executada pela IA.
 * A IA não deve permitir que um moderador aja sobre alguém que ele não
 * poderia moderar diretamente no Discord.
 */
function canModerateMember({ executor, target, botMember, permission }) {
    if (!executor || !target || !botMember) {
        return { ok: false, reason: "Contexto de moderação incompleto." };
    }

    if (executor.id === target.id) {
        return { ok: false, reason: "Ação contra si mesmo não permitida." };
    }

    if (target.id === botMember.id) {
        return { ok: false, reason: "Ação contra a própria Nina não permitida." };
    }

    if (target.user?.bot && target.id !== botMember.id) {
        // Não bloqueamos automaticamente ações contra bots; a hierarquia abaixo
        // continua sendo aplicada.
    }

    if (executor.id === executor.guild?.ownerId) {
        // Dono pode moderar membros abaixo dele, mas ainda respeitamos a
        // hierarquia do cargo alvo quando aplicável.
    } else if (executor.roles?.highest && target.roles?.highest) {
        if (target.roles.highest.comparePositionTo(executor.roles.highest) >= 0) {
            return {
                ok: false,
                reason: "O alvo possui cargo igual ou superior ao cargo mais alto do moderador."
            };
        }
    }

    if (permission && !executor.permissions.has(permission)) {
        return {
            ok: false,
            reason: "O moderador não possui a permissão necessária."
        };
    }

    if (botMember.roles?.highest && target.roles?.highest) {
        if (target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
            return {
                ok: false,
                reason: "A Nina não possui hierarquia suficiente para agir sobre esse membro."
            };
        }
    }

    return { ok: true };
}

module.exports = {
    canModerateMember
};
