const GlobalBanRepository = require("../database/repositories/GlobalBanRepository");

class GlobalBanManager {

    static bannedUsers = new Set();
    static loaded = false;
    static loadingPromise = null;

    static isValidUserId(userId) {
        return /^\d{17,20}$/.test(String(userId || "").trim());
    }

    static async ensureLoaded() {

        if (this.loaded) return;

        if (!this.loadingPromise) {

            this.loadingPromise = GlobalBanRepository.list()
                .then(rows => {

                    this.bannedUsers.clear();

                    for (const row of rows) {
                        this.bannedUsers.add(String(row.user_id));
                    }

                    this.loaded = true;
                    console.log(`🚫 Banimentos globais carregados: ${this.bannedUsers.size}`);

                })
                .catch(error => {

                    this.loadingPromise = null;
                    throw error;

                });

        }

        return this.loadingPromise;

    }

    static async start() {
        await this.ensureLoaded();
    }

    static async isBanned(userId) {

        await this.ensureLoaded();

        return this.bannedUsers.has(String(userId));

    }

    static async ban(userId, { userTag = null, reason = null, bannedBy = null } = {}) {

        const id = String(userId || "").trim();

        if (!this.isValidUserId(id)) {
            throw new Error("ID de usuário do Discord inválido.");
        }

        if (bannedBy && String(bannedBy) === id) {
            throw new Error("Você não pode usar a própria conta como autor do banimento.");
        }

        await this.ensureLoaded();
        await GlobalBanRepository.ban(id, userTag, reason, bannedBy);

        this.bannedUsers.add(id);

    }

    static async unban(userId) {

        const id = String(userId || "").trim();

        if (!this.isValidUserId(id)) {
            throw new Error("ID de usuário do Discord inválido.");
        }

        await this.ensureLoaded();
        await GlobalBanRepository.unban(id);

        this.bannedUsers.delete(id);

    }

    static async list() {
        return GlobalBanRepository.list();
    }

}

module.exports = GlobalBanManager;
