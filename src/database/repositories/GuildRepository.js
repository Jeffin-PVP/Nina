const database = require("../database");

class GuildRepository {

    /*
    =========================
        OBTÉM CONFIGURAÇÕES
    =========================
    */

    static async getSettings(guildId) {

        let settings = await database.get(

            `
            SELECT *
            FROM guild_settings
            WHERE guild_id = ?
            `,

            [

                guildId

            ]

        );

        if (!settings) {

            await database.run(

                `
                INSERT INTO guild_settings (
                    guild_id
                )
                VALUES (?)
                `,

                [

                    guildId

                ]

            );

            settings = await database.get(

                `
                SELECT *
                FROM guild_settings
                WHERE guild_id = ?
                `,

                [

                    guildId

                ]

            );

        }

        return settings;

    }

    /*
    =========================
        EXISTE?
    =========================
    */

    static async exists(guildId) {

        const row = await database.get(

            `
            SELECT guild_id
            FROM guild_settings
            WHERE guild_id = ?
            `,

            [

                guildId

            ]

        );

        return !!row;

    }

    /*
    =========================
        UPDATE GENÉRICO
    =========================
    */

    static async update(guildId, values) {

        await this.getSettings(guildId);

        const keys = Object.keys(values);

        if (!keys.length)
            return;

        const fields =
            keys
                .map(key => `${key} = ?`)
                .join(", ");

        const params = [

            ...keys.map(key => values[key]),

            guildId

        ];

        await database.run(

            `
            UPDATE guild_settings
            SET ${fields}
            WHERE guild_id = ?
            `,

            params

        );

    }

    /*
    =========================
        CANAL DE LOGS
    =========================
    */

    static async getLogChannel(guildId) {

        const settings =
            await this.getSettings(guildId);

        return settings.log_channel;

    }

    static async setLogChannel({
        guildId,
        channelId
    }) {

        await this.update(guildId, {
            log_channel: channelId
        });

    }

    /*
    =========================
        PREFIXO
    =========================
    */

    static async getPrefix(guildId) {

        const settings =
            await this.getSettings(guildId);

        return settings.prefix;

    }

    static async setPrefix(
        guildId,
        prefix
    ) {

        await this.update(

            guildId,

            {

                prefix

            }

        );

    }

    /*
    =========================
        ECONOMIA
    =========================
    */

    static async isEconomyEnabled(guildId) {

        const settings =
            await this.getSettings(guildId);

        return Boolean(
            settings.economy_enabled
        );

    }

    static async setEconomyEnabled(
        guildId,
        enabled
    ) {

        await this.update(

            guildId,

            {

                economy_enabled: enabled ? 1 : 0

            }

        );

    }

    /*
    =========================
        MODERAÇÃO
    =========================
    */

    static async isModerationEnabled(
        guildId
    ) {

        const settings =
            await this.getSettings(guildId);

        return Boolean(
            settings.moderation_enabled
        );

    }

    static async setModerationEnabled(
        guildId,
        enabled
    ) {

        await this.update(

            guildId,

            {

                moderation_enabled: enabled ? 1 : 0

            }

        );

    }

    /*
    =========================
        CATEGORIAS DE LOG
    =========================
    */

    static async getDisabledCategories(guildId) {

        const settings =
            await this.getSettings(guildId);

        const raw = settings.log_disabled_categories;

        if (!raw)
            return [];

        return raw
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

    }

    static async isCategoryEnabled(guildId, category) {

        const disabled =
            await this.getDisabledCategories(guildId);

        return !disabled.includes(category);

    }

    static async setCategoryEnabled(guildId, category, enabled) {

        const disabled =
            await this.getDisabledCategories(guildId);

        const set = new Set(disabled);

        if (enabled) {
            set.delete(category);
        } else {
            set.add(category);
        }

        await this.update(guildId, {
            log_disabled_categories: Array.from(set).join(",")
        });

        return Array.from(set);

    }

    /*
    =========================
        RESETAR CONFIGURAÇÕES
    =========================
    */

    static async reset(guildId) {

        await database.run(

            `
            DELETE FROM guild_settings
            WHERE guild_id = ?
            `,

            [

                guildId

            ]

        );

    }

}

module.exports = GuildRepository;