const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

const ui = require("../../utils/ui");
const { e, component } = require("../../utils/emojis");

// Ícone de cada categoria (casa pelo nome, ignorando o emoji do rótulo)
const CATEGORY_ICONS = {
    "Economia": "coin",
    "Moderação": "shield",
    "Jogos": "dice",
    "Tickets": "ticket",
    "Sorteios": "gift",
    "Utilidade": "sparkle",
    "Configuração": "config",
    "Inteligência Artificial": "ai",
    "Boas-vindas": "heart",
    "Cargos automáticos": "role",
    "Servidor": "server"
};

const stripEmoji = label => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
const iconFor = label => CATEGORY_ICONS[stripEmoji(label)] ?? "star";

function groupByCategory(commands) {

    const groups = new Map();

    for (const command of commands.values()) {

        const label = command.category || "📌 Geral";

        if (!groups.has(label)) groups.set(label, []);

        groups.get(label).push(command);

    }

    return new Map(
        [...groups.entries()]
            .sort(([a], [b]) => stripEmoji(a).localeCompare(stripEmoji(b)))
            .map(([label, list]) => [label, list.sort((a, b) => a.data.name.localeCompare(b.data.name))])
    );

}

function overviewEmbed(interaction, groups, total) {

    const lines = [...groups.entries()].map(([label, list]) =>
        `${e(iconFor(label))} **${stripEmoji(label)}** — ${list.length} comando${list.length > 1 ? "s" : ""}`
    );

    return ui.titled(
        ui.COLORS.brand,
        "help",
        "Central de ajuda da Nina",
        `${ui.mood("oi")} Oi! Escolha uma categoria no menu abaixo para ver os comandos.\n\n` +
        `${lines.join("\n")}\n\n` +
        `${ui.LINE}\n` +
        `${e("sparkle")} **${total}** comandos • use \`/ajuda comando:<nome>\` para detalhes`,
        interaction
    ).setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }));

}

function categoryEmbed(interaction, label, list) {

    let text = list
        .map(c => `${e(iconFor(label))} **/${c.data.name}**\n┗ ${c.data.description}`)
        .join("\n");

    if (text.length > 3900) text = `${text.slice(0, 3900)}…`;

    return ui.titled(ui.COLORS.brand, iconFor(label), stripEmoji(label), text, interaction)
        .addFields({ name: "\u200b", value: `${e("info")} \`/ajuda comando:<nome>\` mostra o uso completo.` });

}

const argsOf = options => (options ?? [])
    .filter(o => o.type !== 1 && o.type !== 2)
    .map(o => o.required ? `<${o.name}>` : `[${o.name}]`)
    .join(" ");

/** Todas as formas de usar o comando: um item por subcomando (inclusive dentro de grupos). */
function usagesOf(command) {

    const json = command.data.toJSON();
    const options = json.options ?? [];

    const subs = options.filter(o => o.type === 1 || o.type === 2);

    if (!subs.length) {

        const args = argsOf(options);

        return [{ path: `/${json.name}`, usage: `/${json.name}${args ? ` ${args}` : ""}`, description: null }];

    }

    const list = [];

    for (const sub of subs) {

        if (sub.type === 2) {

            for (const inner of sub.options ?? []) {

                const args = argsOf(inner.options);

                list.push({
                    path: `/${json.name} ${sub.name} ${inner.name}`,
                    usage: `/${json.name} ${sub.name} ${inner.name}${args ? ` ${args}` : ""}`,
                    description: inner.description
                });

            }

            continue;

        }

        const args = argsOf(sub.options);

        list.push({
            path: `/${json.name} ${sub.name}`,
            usage: `/${json.name} ${sub.name}${args ? ` ${args}` : ""}`,
            description: sub.description
        });

    }

    return list;

}

const usageOf = command => usagesOf(command).map(u => u.usage).join("\n");

function permissionsOf(command) {

    const raw = command.data.default_member_permissions;

    if (!raw) return null;

    try {

        return new PermissionsBitField(BigInt(raw)).toArray().join(", ");

    } catch {

        return null;

    }

}

function detailEmbed(interaction, command) {

    const usages = usagesOf(command);
    const hasSubs = usages.some(u => u.description);

    const embed = ui.titled(ui.COLORS.brand, iconFor(command.category ?? ""), `/${command.data.name}`, command.data.description || "Sem descrição.", interaction)
        .addFields(
            { name: `${e("config")} Uso`, value: ui.clip(`\`\`\`${usages.map(u => u.usage).join("\n")}\`\`\``, 1024) },
            { name: `${e("star")} Categoria`, value: command.category || "📌 Geral", inline: true }
        );

    if (hasSubs) {

        embed.addFields({
            name: `${e("log")} Subcomandos (${usages.length})`,
            value: ui.clip(usages.map(u => `**${u.path}**\n┗ ${u.description}`).join("\n"), 1024)
        });

    }

    if (command.cooldown) {

        embed.addFields({ name: `${e("clock")} Cooldown`, value: `${command.cooldown}s`, inline: true });

    }

    const perms = permissionsOf(command);

    if (perms) {

        embed.addFields({ name: `${e("lock")} Permissão`, value: perms, inline: true });

    }

    return embed;

}

module.exports = {

    data: new SlashCommandBuilder()
        .setName("ajuda")
        .setDescription("Mostra todos os comandos da Nina, organizados por categoria.")
        .addStringOption(o =>
            o.setName("comando")
                .setDescription("Nome de um comando específico para ver detalhes.")
                .setRequired(false)
        ),

    async execute(interaction) {

        const commands = interaction.client.commands;
        const name = interaction.options.getString("comando")?.replace(/^\//, "").trim().toLowerCase();

        /* DETALHE DE UM COMANDO */

        if (name) {

            const command = commands.get(name);

            if (!command) {

                return interaction.reply({
                    embeds: [ui.error(`Não encontrei nenhum comando chamado \`${name}\`.\nUse \`/ajuda\` para ver a lista completa.`, "Comando não encontrado", interaction)],
                    flags: MessageFlags.Ephemeral
                });

            }

            return interaction.reply({
                embeds: [detailEmbed(interaction, command)],
                flags: MessageFlags.Ephemeral
            });

        }

        /* LISTA COM MENU DE CATEGORIAS */

        const groups = groupByCategory(commands);

        const menu = disabled => new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`ajuda_menu_${interaction.id}`)
                .setPlaceholder("Escolha uma categoria...")
                .setDisabled(disabled)
                .addOptions([
                    {
                        label: "Visão geral",
                        value: "__home",
                        description: "Voltar para o início",
                        emoji: component("help")
                    },
                    ...[...groups.entries()].slice(0, 24).map(([label, list]) => ({
                        label: stripEmoji(label).slice(0, 100),
                        value: label,
                        description: `${list.length} comando${list.length > 1 ? "s" : ""}`.slice(0, 100),
                        emoji: component(iconFor(label))
                    }))
                ])
        );

        const message = await interaction.reply({
            embeds: [overviewEmbed(interaction, groups, commands.size)],
            components: [menu(false)],
            flags: MessageFlags.Ephemeral,
            fetchReply: true
        });

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === interaction.user.id,
            time: 120_000
        });

        collector.on("collect", async i => {

            const value = i.values[0];

            const embed = value === "__home"
                ? overviewEmbed(interaction, groups, commands.size)
                : categoryEmbed(interaction, value, groups.get(value) ?? []);

            await i.update({ embeds: [embed], components: [menu(false)] }).catch(() => null);

        });

        collector.on("end", () => {

            interaction.editReply({ components: [menu(true)] }).catch(() => null);

        });

    }

};
