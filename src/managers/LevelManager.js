const EconomyRepository = require("../database/repositories/EconomyRepository");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const GuildRepository = require("../database/repositories/GuildRepository");

// Cooldown de XP por usuário (evita spam de mensagens gerando XP)
const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;

const cooldowns = new Map();

/**
 * XP necessário para SAIR do `level` e ir para o `level + 1`.
 */
function xpNeededForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
}

/**
 * Calcula o nível a partir do XP total acumulado.
 */
function computeLevel(totalXp) {

    let level = 0;
    let remaining = totalXp;

    while (remaining >= xpNeededForLevel(level) && level < 500) {
        remaining -= xpNeededForLevel(level);
        level++;
    }

    return level;

}

class LevelManager {

    /**
     * Deve ser chamado em toda mensagem válida de um membro.
     * Aplica cooldown e, se o usuário subir de nível, cuida dos
     * cargos de recompensa e do aviso no canal.
     */
    static async handleMessage(message) {

        try {

            const enabled = await GuildRepository.isEconomyEnabled(message.guild.id);

            if (!enabled) return;

            const key = `${message.guild.id}:${message.author.id}`;
            const now = Date.now();
            const last = cooldowns.get(key) ?? 0;

            if (now - last < XP_COOLDOWN_MS) return;

            cooldowns.set(key, now);

            const amount = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;

            const user = await EconomyRepository.getUser(message.guild.id, message.author.id);
            const previousLevel = computeLevel(user.xp);

            await EconomyRepository.addXP(message.guild.id, message.author.id, amount);

            const newTotalXp = user.xp + amount;
            const newLevel = computeLevel(newTotalXp);

            if (newLevel > previousLevel) {
                await this.handleLevelUp(message, newLevel);
            }

        } catch (error) {

            console.error("[LevelManager] Erro ao processar XP:", error);

        }

    }

    static async handleLevelUp(message, newLevel) {

        await EconomyRepository.setLevel(message.guild.id, message.author.id, newLevel);

        const settings = await GuildRepository.getSettings(message.guild.id);

        if (settings.levelup_enabled) {

            await message.channel.send({
                content: `🎉 ${message.author} subiu para o nível **${newLevel}**!`
            }).catch(() => null);

        }

        const levelRoles = await AutoroleRepository.listLevelRoles(message.guild.id);
        const eligible = levelRoles.filter(entry => entry.level <= newLevel);

        if (!eligible.length) return;

        const member = message.member;

        for (const entry of eligible) {

            if (member.roles.cache.has(entry.role_id)) continue;

            const role = message.guild.roles.cache.get(entry.role_id);

            if (!role) continue;

            await member.roles.add(role).catch(() => null);

        }

    }

    static computeLevel(totalXp) {
        return computeLevel(totalXp);
    }

    static xpNeededForLevel(level) {
        return xpNeededForLevel(level);
    }

    /**
     * XP total necessário (acumulado) para alcançar um nível.
     */
    static totalXpForLevel(targetLevel) {

        let total = 0;

        for (let level = 0; level < targetLevel; level++) {
            total += xpNeededForLevel(level);
        }

        return total;

    }

}

module.exports = LevelManager;
