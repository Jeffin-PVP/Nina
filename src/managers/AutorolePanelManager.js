const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");

const ui = require("../utils/ui");

class AutorolePanelManager {

    static build(roles, { title, description, source } = {}) {
        if (!roles.length) throw new Error("Nenhum cargo de self-role está configurado.");
        if (roles.length > 25) throw new Error("O painel de self-role aceita no máximo 25 cargos.");
        if (title && title.length > 256) throw new Error("O título do painel aceita até 256 caracteres.");
        if (description && description.length > 2000) throw new Error("A descrição do painel aceita até 2000 caracteres.");

        const embed = ui.panel({
            color: ui.COLORS.brand,
            emoji: "role",
            title: title || "Escolha seus cargos",
            description: `${description || "Clique em um botão para adicionar ou remover o cargo correspondente."}\n\n${ui.LINE}\n${ui.bullets(roles.map(role => `<@&${role.role_id}>`))}`,
            source
        });
        const components = [];

        for (let index = 0; index < roles.length; index += 5) {
            const row = new ActionRowBuilder();
            for (const role of roles.slice(index, index + 5)) {
                const button = new ButtonBuilder()
                    .setCustomId(`selfrole_${role.role_id}`)
                    .setLabel(role.label)
                    .setStyle(ButtonStyle.Secondary);
                if (role.emoji) button.setEmoji(role.emoji);
                row.addComponents(button);
            }
            components.push(row);
        }

        return { embeds: [embed], components };
    }

    static async send(channel, roles, options = {}) {
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
            throw new Error("Escolha um canal de texto ou anúncios que não seja uma thread.");
        }
        return channel.send(this.build(roles, options));
    }

}

module.exports = AutorolePanelManager;
