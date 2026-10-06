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
const IMPORT_MAX_BYTES = 256 * 1024;

function sessionId(guildId, userId) {
    return `${guildId || "dm"}:${userId}`;
}

function cleanupExpiredSessions() {
    const now = Date.now();

    for (const [id, session] of sessions) {
        if (now > session.expiresAt) {
            sessions.delete(id);
        }
    }
}

const cleanupTimer = setInterval(
    cleanupExpiredSessions,
    5 * 60 * 1000
);

cleanupTimer.unref?.();

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

function create(id) {
    const data = defaultData();

    sessions.set(id, {
        data,
        expiresAt: Date.now() + SESSION_TIME
    });

    return data;
}

function get(id) {
    const session = sessions.get(id);

    if (!session) {
        return null;
    }

    if (Date.now() > session.expiresAt) {
        sessions.delete(id);
        return null;
    }

    session.expiresAt = Date.now() + SESSION_TIME;

    return session.data;
}

function set(id, data) {
    const normalized = normalize(data);

    sessions.set(id, {
        data: normalized,
        expiresAt: Date.now() + SESSION_TIME
    });

    return normalized;
}

function remove(id) {
    sessions.delete(id);
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

async function importFromAttachment(interaction, id) {
    if (
        !interaction.channel ||
        typeof interaction.channel.awaitMessages !== "function"
    ) {
        await interaction.reply({
            content: "❌ Não consigo receber o arquivo neste canal.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.reply({
        content:
            "📥 **Importar container**\n" +
            "Envie agora o arquivo `container.json` como uma mensagem neste canal. " +
            "O arquivo será lido apenas para esta sessão e não será salvo no servidor.\n\n" +
            "⏱️ Você tem **2 minutos**.",
        flags: MessageFlags.Ephemeral
    });

    try {
        const collected =
            await interaction.channel.awaitMessages({
                time: 120000,
                max: 1,
                errors: ["time"],
                filter: message => {
                    if (
                        message.author.id !==
                        interaction.user.id
                    ) {
                        return false;
                    }

                    return [...message.attachments.values()]
                        .some(attachment => {
                            const name =
                                String(
                                    attachment.name || ""
                                ).toLowerCase();

                            return (
                                name.endsWith(".json") &&
                                attachment.size <=
                                    IMPORT_MAX_BYTES
                            );
                        });
                }
            });

        const uploadedMessage =
            collected.first();

        const attachment =
            [...uploadedMessage.attachments.values()]
                .find(item => {
                    const name =
                        String(
                            item.name || ""
                        ).toLowerCase();

                    return (
                        name.endsWith(".json") &&
                        item.size <=
                            IMPORT_MAX_BYTES
                    );
                });

        if (!attachment) {
            throw new Error(
                "O arquivo precisa ser um `.json` com até 256 KB."
            );
        }

        const response =
            await fetch(attachment.url);

        if (!response.ok) {
            throw new Error(
                `Não consegui baixar o arquivo (HTTP ${response.status}).`
            );
        }

        const contentLength =
            Number(
                response.headers.get(
                    "content-length"
                ) || 0
            );

        if (
            contentLength >
            IMPORT_MAX_BYTES
        ) {
            throw new Error(
                "O arquivo excede o limite de 256 KB."
            );
        }

        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        if (
            buffer.length >
            IMPORT_MAX_BYTES
        ) {
            throw new Error(
                "O arquivo excede o limite de 256 KB."
            );
        }

        const imported =
            JSON.parse(
                buffer.toString("utf8")
            );

        if (
            !imported ||
            typeof imported !== "object" ||
            Array.isArray(imported)
        ) {
            throw new Error(
                "O JSON precisa conter um objeto de container."
            );
        }

        const next =
            set(
                id,
                imported
            );

        await interaction.message.edit(
            message(next)
        );

        await interaction.editReply({
            content:
                "✅ **Container importado!**\n" +
                "O arquivo foi lido com sucesso e não foi salvo no armazenamento da Nina."
        });

    } catch (error) {
        if (
            error?.code ===
            "CollectorError"
        ) {
            await interaction.editReply({
                content:
                    "⏱️ Tempo esgotado. Clique em **📥 Importar** novamente quando estiver pronto."
            });

            return;
        }

        await interaction.editReply({
            content:
                `❌ Não consegui importar o container.\n\`${error.message}\``
        });
    }
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

    const id =
        sessionId(
            interaction.guildId,
            interaction.user.id
        );

    const data =
        get(id);

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

        set(id, next);

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

        set(id, next);

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

        set(id, next);

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
        await importFromAttachment(
            interaction,
            id
        );

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

            let parsedUrl;

            try {
                parsedUrl = new URL(url);
            } catch {
                throw new Error(
                    "URL de webhook inválida."
                );
            }

            if (
                parsedUrl.protocol !== "https:" ||
                !(
                    parsedUrl.hostname ===
                        "discord.com" ||
                    parsedUrl.hostname ===
                        "discordapp.com"
                ) ||
                !parsedUrl.pathname.startsWith(
                    "/api/webhooks/"
                )
            ) {
                throw new Error(
                    "Informe uma URL de webhook oficial do Discord."
                );
            }

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

        remove(id);

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
    sessionId,
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