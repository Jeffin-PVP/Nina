const database = require("../database/database");
const ModerationRepository = require("../database/repositories/ModerationRepository");

class TemporaryBanManager {
    constructor() {
        this.client = null;
        this.timers = new Map();
    }

    start(client) {
        this.client = client;
        this.restore();
    }

    async restore() {
        if (!this.client) return;

        const expirations = await ModerationRepository.getExpiredTemporaryBans(Date.now());
        for (const ban of expirations) {
            this._expireBan(ban.guild_id, ban.user_id, ban.reason, true);
        }

        const list = await database.all(
            `SELECT * FROM temporary_bans WHERE expires_at > ? ORDER BY expires_at ASC`,
            [Date.now()]
        );

        for (const ban of list) {
            const delay = Math.max(1, Number(ban.expires_at) - Date.now());
            this.schedule(ban.guild_id, ban.user_id, ban.reason, delay);
        }
    }

    schedule(guildId, userId, reason, delayMs) {
        const key = `${guildId}:${userId}`;
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        const timeout = setTimeout(() => {
            this._expireBan(guildId, userId, reason);
        }, delayMs);

        timeout.unref?.();
        this.timers.set(key, timeout);
    }

    async _expireBan(guildId, userId, reason, silent = false) {
        const guild = this.client?.guilds?.cache?.get(guildId);
        if (!guild) {
            await ModerationRepository.removeTemporaryBan({ guildId, userId });
            return;
        }

        try {
            const banData = await guild.bans.fetch(userId).catch(() => null);
            if (!banData) {
                await ModerationRepository.removeTemporaryBan({ guildId, userId });
                return;
            }

            await guild.members.unban(userId, reason || "Banimento temporário expirado.");
            await ModerationRepository.removeTemporaryBan({ guildId, userId });
            if (!silent) {
                console.log(`⏳ Banimento temporário expirou: ${guildId}/${userId}`);
            }
        } catch (error) {
            console.error(`[TemporaryBanManager] falha ao expirar banimento ${guildId}/${userId}:`, error);
            await ModerationRepository.removeTemporaryBan({ guildId, userId });
        }
    }
}

module.exports = new TemporaryBanManager();
