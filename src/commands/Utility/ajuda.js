const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

const ui = require("../../utils/ui");

/* EMOJIS (locais, sem depender do utils/emojis) */

// Ícone de cada categoria (casa pelo nome, ignorando o emoji do rótulo)
const CATEGORY_ICONS = {
    "Economia": "<:moneybag:1561484846159757513>",
    "Moderação": "<:escudo:1562187519150395393>",
    "Jogos": "<:ui_xbox:1560327208961318966>",
    "Tickets": "<:ticket:1562187545914380319>",
    "Sorteios": "<a:ui_celebrating:1560326769876140158>",
    "Utilidade": "<:ui_wrench:1560327206969024613>",
    "Configuração": "<:ui_settings:1560327092078645258>",
    "Inteligência Artificial": "<:ui_bot:1560326748313493546>",
    "Boas-vindas": "<:aceno:1562187509490778162>",
    "Cargos automáticos": "<:cargo:1562189000544882808>",
    "Servidor": "<:server:1561430145259016262>",
    "Geral": "<:ui_pin:1560327023531003965>",
    "Voz": "<:voz:1562187549932388383>"
};

const DEFAULT_ICON = "⭐";

// Ícones fixos usados nos campos/textos
const ICON = {
    help: "<:ajuda:1562529221333618809>",
    world: "<:ui_world:1560327204565422101>",
    info: "<:info:1561478835877453945>",
    config: "<:config:1562187516625555496>",
    star: "<:ui_sparks:1560327106788065320>",
    log: "<:logs:1562187526272192622>",
    clock: "<:clock:1561426917717053530>",
    lock: "<:lock:1561418439879565404>"
};

const RAW_EMOJI = /^<(a?):(\w+):(\d+)>$/;

/** "<:nome:id>" -> { id, name, animated } (formato do select menu). Unicode passa direto. */
function toComponentEmoji(icon) {

    const match = RAW_EMOJI.exec(icon);

    return match
        ? { id: match[3], name: match[2], animated: match[1] === "a" }
        : icon;

}

const stripEmoji = label => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
const iconFor = label => CATEGORY_ICONS[stripEmoji(label)] ?? DEFAULT_ICON;

/* AGRUPAMENTO */

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

/* EMBEDS */

function overviewEmbed(interaction, groups, total) {

    const lines = [...groups.entries()].map(([label, list]) =>
        `${iconFor(label)} **${stripEmoji(label)}** — ${list.length} comando${list.length > 1 ? "s" : ""}`
    );

    return ui.titled(
        ui.COLORS.brand,
        "help",
        "Central de ajuda da Nina",
        `${ui.mood("oi")} Oi! Escolha uma categoria no menu abaixo para ver os comandos.\n\n` +
        `${lines.join("\n")}\n\n` +
        `${ui.LINE}\n` +
        `${ICON.world} **${total}** comandos • use \`/ajuda comando:<nome>\` para detalhes`,
        interaction
    )
        .setTitle(`${ICON.help} Central de ajuda da Nina`)
        .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }));

}

function categoryEmbed(interaction, label, list) {

    const icon = iconFor(label);

    let text = list
        .map(c => `${icon} **/${c.data.name}**\n┗ ${c.data.description}`)
        .join("\n");

    if (text.length > 3900) text = `${text.slice(0, 3900)}…`;

    return ui.titled(ui.COLORS.brand, "help", stripEmoji(label), text, interaction)
        .setTitle(`${icon} ${stripEmoji(label)}`)
        .addFields({ name: "\u200b", value: `${ICON.info} \`/ajuda comando:<nome>\` mostra o uso completo.` });

}

/* USO DOS COMANDOS */

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

    const embed = ui.titled(ui.COLORS.brand, "help", `/${command.data.name}`, command.data.description || "Sem descrição.", interaction)
        .setTitle(`${iconFor(command.category ?? "")} /${command.data.name}`)
        .addFields(
            { name: `${ICON.config} Uso`, value: ui.clip(`\`\`\`${usages.map(u => u.usage).join("\n")}\`\`\``, 1024) },
            { name: `${ICON.star} Categoria`, value: command.category || "📌 Geral", inline: true }
        );

    if (hasSubs) {

        embed.addFields({
            name: `${ICON.log} Subcomandos (${usages.length})`,
            value: ui.clip(usages.map(u => `**${u.path}**\n┗ ${u.description}`).join("\n"), 1024)
        });

    }

    if (command.cooldown) {

        embed.addFields({ name: `${ICON.clock} Cooldown`, value: `${command.cooldown}s`, inline: true });

    }

    const perms = permissionsOf(command);

    if (perms) {

        embed.addFields({ name: `${ICON.lock} Permissão`, value: perms, inline: true });

    }

    return embed;

}

/* COMANDO */

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
                        emoji: toComponentEmoji(ICON.help)
                    },
                    ...[...groups.entries()].slice(0, 24).map(([label, list]) => ({
                        label: stripEmoji(label).slice(0, 100),
                        value: label,
                        description: `${list.length} comando${list.length > 1 ? "s" : ""}`.slice(0, 100),
                        emoji: toComponentEmoji(iconFor(label))
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