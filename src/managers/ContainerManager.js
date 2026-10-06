const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    ModalBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    WebhookClient,
    MessageFlags
} = require("discord.js");

const sessions = new Map();

const SESSION_TIME = 30 * 60 * 1000;

function defaultData() {
    return {
        title: "Novo Container",
        description: "Clique em **📝 Editar** para começar.",
        footer: "Nina • Container",
        color: "#7C3AED",
        blocks: []
    };
}

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

function normalize(data) {
    const base = defaultData();

    if (!data || typeof data !== "object") {
        return base;
    }

    return {
        title: String(data.title || base.title).slice(0, 256),

        description:
            String(data.description || "").slice(0, 4000),

        footer:
            String(data.footer || "").slice(0, 2048),

        color:
            /^#[0-9A-Fa-f]{6}$/.test(String(data.color || ""))
                ? String(data.color)
                : base.color,

        blocks:
            Array.isArray(data.blocks)
                ? data.blocks
                    .map(String)
                    .map(text => text.trim())
                    .filter(Boolean)
                    .slice(0, 20)
                    .map(text => text.slice(0, 4000))
                : []
    };
}

/* =========================
   SESSÕES
========================= */

function create(userId) {
    const data = defaultData();

    sessions.set(userId, {
        data,
        expiresAt: Date.now() + SESSION_TIME
    });

    return data;
}

function get(userId) {
    const session = sessions.get(userId);

    if (!session) {
        return null;
    }

    if (Date.now() > session.expiresAt) {
        sessions.delete(userId);
        return null;
    }

    session.expiresAt = Date.now() + SESSION_TIME;

    return session.data;
}

function set(userId, data) {
    const normalized = normalize(data);

    sessions.set(userId, {
        data: normalized,
        expiresAt: Date.now() + SESSION_TIME
    });

    return normalized;
}

function remove(userId) {
    sessions.delete(userId);
}

/* =========================
   COMPONENTS V2
========================= */

function text(content) {
    return new TextDisplayBuilder()
        .setContent(content);
}

function button(
    id,
    label,
    style = ButtonStyle.Secondary
) {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style);
}

function build(data, controls = true) {

    const container =
        new ContainerBuilder()
            .setAccentColor(data.color);

    /*
    TÍTULO
    */

    container.addTextDisplayComponents(
        text(`## ${data.title || "Sem título"}`)
    );

    /*
    DESCRIÇÃO
    */

    container.addSeparatorComponents(
        new SeparatorBuilder()
    );

    container.addTextDisplayComponents(
        text(
            data.description ||
            "*Sem descrição.*"
        )
    );

    /*
    BLOCOS
    */

    for (let i = 0; i < data.blocks.length; i++) {

        container.addSeparatorComponents(
            new SeparatorBuilder()
        );

        container.addTextDisplayComponents(
            text(
                `**Bloco ${i + 1}**\n${data.blocks[i]}`
            )
        );
    }

    /*
    RODAPÉ
    */

    if (data.footer) {

        container.addSeparatorComponents(
            new SeparatorBuilder()
        );

        container.addTextDisplayComponents(
            text(`-# ${data.footer}`)
        );
    }

    /*
    BOTÕES
    */

    if (controls) {

        container.addSeparatorComponents(
            new SeparatorBuilder()
        );

        container.addActionRowComponents(

            new ActionRowBuilder()
                .addComponents(

                    button(
                        "container:edit",
                        "📝 Editar"
                    ),

                    button(
                        "container:add",
                        "➕ Bloco"
                    ),

                    button(
                        "container:color",
                        "🎨 Cor"
                    ),

                    button(
                        "container:preview",
                        "👁️ Prévia"
                    ),

                    button(
                        "container:cancel",
                        "❌ Cancelar",
                        ButtonStyle.Danger
                    )
                )
        );

        container.addActionRowComponents(

            new ActionRowBuilder()
                .addComponents(

                    button(
                        "container:send",
                        "📤 Enviar",
                        ButtonStyle.Success
                    ),

                    button(
                        "container:export",
                        "📋 Exportar"
                    ),

                    button(
                        "container:import",
                        "📥 Importar"
                    ),

                    button(
                        "container:webhook",
                        "🔗 Webhook"
                    )
                )
        );
    }

    return container;
}

function message(data, controls = true) {

    return {
        flags: MessageFlags.IsComponentsV2,

        components: [
            build(data, controls)
        ]
    };
}

/* =========================
   MODAIS
========================= */

function editModal(data) {

    return new ModalBuilder()
        .setCustomId("container_modal:edit")
        .setTitle("Editar container")

        .addComponents(

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("title")
                        .setLabel("Título")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(256)
                        .setValue(
                            data.title.slice(0, 256)
                        )
                ),

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("description")
                        .setLabel("Descrição")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setMaxLength(4000)
                        .setValue(
                            data.description.slice(0, 4000)
                        )
                ),

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("footer")
                        .setLabel("Rodapé")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(2048)
                        .setValue(
                            data.footer.slice(0, 2048)
                        )
                )
        );
}

function blockModal() {

    return new ModalBuilder()
        .setCustomId("container_modal:add")
        .setTitle("Adicionar bloco")

        .addComponents(

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("content")
                        .setLabel("Conteúdo do bloco")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(
                            "Digite o conteúdo..."
                        )
                        .setRequired(true)
                        .setMaxLength(4000)
                )
        );
}

function colorModal(data) {

    return new ModalBuilder()
        .setCustomId("container_modal:color")
        .setTitle("Alterar cor")

        .addComponents(

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("color")
                        .setLabel("Cor hexadecimal")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("#7C3AED")
                        .setRequired(true)
                        .setMaxLength(7)
                        .setValue(data.color)
                )
        );
}

function importModal() {

    return new ModalBuilder()
        .setCustomId("container_modal:import")
        .setTitle("Importar container")

        .addComponents(

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("json")
                        .setLabel("JSON")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(
                            '{"title":"Meu container","description":"..."}'
                        )
                        .setRequired(true)
                        .setMaxLength(4000)
                )
        );
}

function webhookModal() {

    return new ModalBuilder()
        .setCustomId("container_modal:webhook")
        .setTitle("Webhook")

        .addComponents(

            new ActionRowBuilder()
                .addComponents(

                    new TextInputBuilder()
                        .setCustomId("url")
                        .setLabel("URL do webhook")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(
                            "https://discord.com/api/webhooks/..."
                        )
                        .setRequired(true)
                        .setMaxLength(1000)
                )
        );
}

/* =========================
   MODAL HELPER
========================= */

async function showAndWait(
    interaction,
    modal
) {

    await interaction.showModal(modal);

    return interaction.awaitModalSubmit({

        time: 120000,

        filter: submitted =>
            submitted.user.id ===
            interaction.user.id
    });
}

/* =========================
   BOTÕES
========================= */

async function handleButton(interaction) {

    if (!interaction.isButton()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            "container:"
        )
    ) {
        return false;
    }

    const data =
        get(interaction.user.id);

    if (!data) {

        await interaction.reply({

            content:
                "❌ Sua sessão do `/container` expirou. Execute o comando novamente.",

            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    /*
    EDITAR
    */

    if (
        interaction.customId ===
        "container:edit"
    ) {

        const modal =
            await showAndWait(
                interaction,
                editModal(data)
            );

        const next =
            clone(data);

        next.title =
            modal.fields
                .getTextInputValue("title")
                .trim() ||
            "Novo Container";

        next.description =
            modal.fields
                .getTextInputValue("description")
                .trim();

        next.footer =
            modal.fields
                .getTextInputValue("footer")
                .trim();

        set(
            interaction.user.id,
            next
        );

        await modal.update(
            message(next)
        );

        return true;
    }

    /*
    ADICIONAR BLOCO
    */

    if (
        interaction.customId ===
        "container:add"
    ) {

        const modal =
            await showAndWait(
                interaction,
                blockModal()
            );

        const next =
            clone(data);

        next.blocks.push(

            modal.fields
                .getTextInputValue(
                    "content"
                )
                .trim()
        );

        set(
            interaction.user.id,
            next
        );

        await modal.update(
            message(next)
        );

        return true;
    }

    /*
    COR
    */

    if (
        interaction.customId ===
        "container:color"
    ) {

        const modal =
            await showAndWait(
                interaction,
                colorModal(data)
            );

        const color =
            modal.fields
                .getTextInputValue(
                    "color"
                )
                .trim();

        if (
            !/^#[0-9A-Fa-f]{6}$/.test(
                color
            )
        ) {

            await modal.reply({

                content:
                    "❌ Cor inválida. Use `#RRGGBB`.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const next =
            clone(data);

        next.color =
            color;

        set(
            interaction.user.id,
            next
        );

        await modal.update(
            message(next)
        );

        return true;
    }

    /*
    PRÉVIA
    */

    if (
        interaction.customId ===
        "container:preview"
    ) {

        await interaction.reply({

            flags:
                MessageFlags.IsComponentsV2 |
                MessageFlags.Ephemeral,

            components: [
                build(
                    data,
                    false
                )
            ]
        });

        return true;
    }

    /*
    EXPORTAR
    */

    if (
        interaction.customId ===
        "container:export"
    ) {

        const json =
            JSON.stringify(
                normalize(data),
                null,
                2
            );

        const buffer =
            Buffer.from(
                json,
                "utf8"
            );

        await interaction.reply({

            content:
                "📋 Aqui está o JSON do seu container.",

            files: [
                {
                    attachment: buffer,
                    name: "container.json"
                }
            ],

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    /*
    IMPORTAR
    */

    if (
        interaction.customId ===
        "container:import"
    ) {

        const modal =
            await showAndWait(
                interaction,
                importModal()
            );

        try {

            const json =
                modal.fields
                    .getTextInputValue(
                        "json"
                    );

            const imported =
                JSON.parse(json);

            const next =
                set(
                    interaction.user.id,
                    imported
                );

            await modal.update(
                message(next)
            );

        } catch (error) {

            await modal.reply({

                content:
                    `❌ JSON inválido: ${error.message}`,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    /*
    ENVIAR WEBHOOK
    */

    if (
        interaction.customId ===
        "container:webhook"
    ) {

        const modal =
            await showAndWait(
                interaction,
                webhookModal()
            );

        try {

            const url =
                modal.fields
                    .getTextInputValue(
                        "url"
                    )
                    .trim();

            const webhook =
                new WebhookClient({
                    url
                });

            await webhook.send(
                message(data, false)
            );

            webhook.destroy();

            await modal.reply({

                content:
                    "✅ Container enviado pelo webhook.",

                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {

            await modal.reply({

                content:
                    `❌ Não consegui enviar pelo webhook.\n\`${error.message}\``,

                flags:
                    MessageFlags.Ephemeral
            });
        }

        return true;
    }

    /*
    ENVIAR NO CANAL
    */

    if (
        interaction.customId ===
        "container:send"
    ) {

        if (
            !interaction.channel
        ) {

            await interaction.reply({

                content:
                    "❌ Não encontrei este canal.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        await interaction.channel.send(
            message(data, false)
        );

        await interaction.reply({

            content:
                "✅ Container enviado!",

            flags:
                MessageFlags.Ephemeral
        });

        return true;
    }

    /*
    CANCELAR
    */

    if (
        interaction.customId ===
        "container:cancel"
    ) {

        remove(
            interaction.user.id
        );

        await interaction.update({

            flags:
                MessageFlags.IsComponentsV2,

            components: [

                text(
                    "## ❌ Editor encerrado\nSua sessão do `/container` foi encerrada."
                )
            ]
        });

        return true;
    }

    return false;
}

module.exports = {
    create,
    get,
    set,
    remove,
    build,
    message,
    handleButton,
    normalize,
    clone
};