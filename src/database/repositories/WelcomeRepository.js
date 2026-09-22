const database = require("../database");

const PADRAO = {
    enabled: 0,
    channel_id: null,
    background_url: null,
    title_text: "Bem-vindo(a), {usuario}! 👋",
    subtitle_text: "Você é o membro #{membros} de {servidor}",
    message_content: "🎉 Chegou gente nova! Dá as boas-vindas pra {menção}",
    accent_color: "#5865F2"
};

class WelcomeRepository {

    static async get(guildId) {

        const row = await database.get(

            `
            SELECT *
            FROM welcome_settings
            WHERE guild_id = ?
            `,

            [guildId]

        );

        if (!row) return { guild_id: guildId, ...PADRAO };

        return {
            ...PADRAO,
            ...row,
            title_text: row.title_text || PADRAO.title_text,
            subtitle_text: row.subtitle_text || PADRAO.subtitle_text,
            message_content: row.message_content ?? PADRAO.message_content,
            accent_color: row.accent_color || PADRAO.accent_color
        };

    }

    // Atualiza só os campos passados, criando a linha se ela ainda não existir
    static async update(guildId, campos) {

        const atual = await WelcomeRepository.get(guildId);
        const novo = { ...atual, ...campos };

        await database.run(

            `
            INSERT INTO welcome_settings (
                guild_id, enabled, channel_id, background_url,
                title_text, subtitle_text, message_content, accent_color
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                enabled = VALUES(enabled),
                channel_id = VALUES(channel_id),
                background_url = VALUES(background_url),
                title_text = VALUES(title_text),
                subtitle_text = VALUES(subtitle_text),
                message_content = VALUES(message_content),
                accent_color = VALUES(accent_color)
            `,

            [
                guildId,
                novo.enabled ? 1 : 0,
                novo.channel_id,
                novo.background_url,
                novo.title_text,
                novo.subtitle_text,
                novo.message_content,
                novo.accent_color
            ]

        );

        return WelcomeRepository.get(guildId);

    }

}

module.exports = WelcomeRepository;
