const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    ModalBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    WebhookClient,
    MessageFlags
} = require("discord.js");

/*
=========================
    /container — Components V2
=========================
Limites do Discord para mensagens Components V2:
 - 4000 caracteres de texto somando TODOS os TextDisplay da mensagem;
 - 40 componentes no total (contando os aninhados: container, textos,
   separadores, linhas de botões e os próprios botões).
O editor (com botões) é a versão mais "pesada", então é ela que
validamos: se cabe no editor, cabe na versão final enviada.
*/

const SESSION_TIME = 30 * 60 * 1000;

const IMPORT_MAX_BYTES = 256 * 1024;
const IMPORT_WAIT_MS = 2 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 8000;

const MAX_TEXT_CHARS = 4000;
const MAX_COMPONENTS = 40;

// Editor com 2 linhas de 5 botões ocupa 19 componentes + 2 por bloco.
const EDITOR_BASE_COMPONENTS = 19;
const MAX_BLOCKS = Math.floor((MAX_COMPONENTS - EDITOR_BASE_COMPONENTS) / 2);

const EXPORT_SCHEMA = "nina-container";
const EXPORT_VERSION = 1;

const DEFAULT_COLOR = "#7C3AED";

const DISCORD_CDN_HOSTS = new Set([
    "cdn.discordapp.com",
    "media.discordapp.net"
]);

const WEBHOOK_HOSTS = new Set([
    "discord.com",
    "ptb.discord.com",
    "canary.discord.com",
    "discordapp.com"
]);

/*
=========================
    SESSÕES
=========================
Chave = ID da mensagem do editor. Assim, abrir dois /container ao mesmo
tempo não faz um editor apagar a sessão do outro.
*/

const sessions = new Map();

function cleanupExpiredSessions() {

    const now = Date.now();

    for (const [id, session] of sessions) {
        if (now > session.expiresAt) sessions.delete(id);
    }

}

const cleanupTimer = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

cleanupTimer.unref?.();

function startSession(messageId, ownerId, data) {

    sessions.set(messageId, {
        ownerId,
        data,
        expiresAt: Date.now() + SESSION_TIME
    });

}

function getSession(messageId) {

    const session = sessions.get(messageId);

    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        sessions.delete(messageId);
        return null;
    }

    session.expiresAt = Date.now() + SESSION_TIME;

    return session;

}

function removeSession(messageId) {
    sessions.delete(messageId);
}

/*
=========================
    DADOS
=========================
*/

function defaultData() {

    return {
        title: "Novo Container",
        description: "Clique em **📝 Editar** para começar.",
        footer: "Nina • Container",
        color: DEFAULT_COLOR,
        blocks: []
    };

}

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

function parseColor(value) {

    let raw = String(value ?? "").trim().replace(/^#/, "");

    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        raw = raw.split("").map(c => c + c).join("");
    }

    return /^[0-9a-fA-F]{6}$/.test(raw)
        ? `#${raw.toUpperCase()}`
        : null;

}

function asText(value) {
    return typeof value === "string" ? value : "";
}

/**
 * Aceita qualquer objeto (import, edição...) e devolve um container válido.
 * Blocos podem ser strings ou objetos { text } / { content }.
 */
function normalize(input) {

    const base = defaultData();

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return base;
    }

    const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];

    const blocks = rawBlocks
        .map(block =>
            typeof block === "string"
                ? block
                : asText(block?.text) || asText(block?.content)
        )
        .map(text => text.trim())
        .filter(Boolean)
        .map(text => text.slice(0, MAX_TEXT_CHARS));

    return {
        title: asText(input.title).trim().slice(0, 256) || base.title,
        description: asText(input.description).trim().slice(0, MAX_TEXT_CHARS),
        footer: asText(input.footer).trim().slice(0, 2048),
        color: parseColor(input.color) || base.color,
        blocks
    };

}

/*
=========================
    LAYOUT + LIMITES
=========================
O layout é a única fonte da verdade: build() desenha a partir dele e
fits() mede a partir dele, então os dois nunca ficam fora de sincronia.
*/

function layout(data, controls) {

    const items = [];

    items.push({ type: "text", content: `## ${data.title || "Sem título"}` });
    items.push({ type: "separator" });
    items.push({ type: "text", content: data.description || "*Sem descrição.*" });

    data.blocks.forEach((block, index) => {

        items.push({ type: "separator" });

        // O número do bloco só aparece no editor (serve para remover).
        items.push({
            type: "text",
            content: controls ? `-# Bloco ${index + 1}\n${block}` : block
        });

    });

    if (data.footer) {
        items.push({ type: "separator" });
        items.push({ type: "text", content: `-# ${data.footer}` });
    }

    return items;

}

/** Retorna uma string com o problema, ou null se o container cabe no Discord. */
function fits(data) {

    if (data.blocks.length > MAX_BLOCKS) {
        return `Limite de ${MAX_BLOCKS} blocos excedido (o Discord permite no máximo ${MAX_COMPONENTS} componentes por mensagem).`;
    }

    const chars = layout(data, true)
        .filter(item => item.type === "text")
        .reduce((sum, item) => sum + item.content.length, 0);

    if (chars > MAX_TEXT_CHARS) {
        return `O texto total passa do limite do Discord (${chars}/${MAX_TEXT_CHARS} caracteres somando título, descrição, blocos e rodapé).`;
    }

    return null;

}

/*
=========================
    COMPONENTS V2
=========================
*/

function button(id, label, style = ButtonStyle.Secondary) {

    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style);

}

function build(data, controls = true) {

    const container = new ContainerBuilder()
        .setAccentColor(parseInt(data.color.slice(1), 16));

    for (const item of layout(data, controls)) {

        if (item.type === "separator") {
            container.addSeparatorComponents(new SeparatorBuilder());
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(item.content)
            );
        }

    }

    if (controls) {

        container.addSeparatorComponents(new SeparatorBuilder());

        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                button("container:edit", "📝 Editar"),
                button("container:add", "➕ Bloco"),
                button("container:color", "🎨 Cor"),
                button("container:preview", "👁️ Prévia"),
                button("container:cancel", "❌ Cancelar", ButtonStyle.Danger)
            )
        );

        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                button("container:send", "📤 Enviar", ButtonStyle.Success),
                button("container:export", "📋 Exportar"),
                button("container:import", "📥 Importar"),
                button("container:webhook", "🔗 Webhook"),
                button("container:remove", "🗑️ Bloco")
            )
        );

    }

    return container;

}

function message(data, controls = true) {

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [build(data, controls)],
        // O texto é digitado por usuários: nunca marca @everyone/cargos.
        allowedMentions: { parse: [] }
    };

}

/*
=========================
    MODAIS
=========================
*/

function row(id, label, { style = TextInputStyle.Short, value, max, placeholder, required = false } = {}) {

    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required);

    if (max) input.setMaxLength(max);

    if (placeholder) input.setPlaceholder(placeholder);

    // setValue maior que o maxLength faz o Discord recusar o modal.
    if (value) input.setValue(String(value).slice(0, max || 4000));

    return new ActionRowBuilder().addComponents(input);

}

function modal(action, title, rows) {

    return new ModalBuilder()
        .setCustomId(`container_modal:${action}`)
        .setTitle(title)
        .addComponents(...rows);

}

function editModal(data) {

    return modal("edit", "Editar container", [
        row("title", "Título", { value: data.title, max: 256 }),
        row("description", "Descrição", {
            style: TextInputStyle.Paragraph,
            value: data.description,
            max: 4000
        }),
        row("footer", "Rodapé", { value: data.footer, max: 2048 })
    ]);

}

function blockModal() {

    return modal("add", "Adicionar bloco", [
        row("content", "Conteúdo do bloco", {
            style: TextInputStyle.Paragraph,
            placeholder: "Digite o conteúdo...",
            max: 4000,
            required: true
        })
    ]);

}

function removeModal(data) {

    return modal("remove", "Remover bloco", [
        row("index", "Número do bloco (ou \"todos\")", {
            placeholder: data.blocks.length
                ? `1 a ${data.blocks.length}`
                : "Não há blocos ainda.",
            max: 10,
            required: true
        })
    ]);

}

function colorModal(data) {

    return modal("color", "Alterar cor", [
        row("color", "Cor hexadecimal", {
            placeholder: DEFAULT_COLOR,
            value: data.color,
            max: 7,
            required: true
        })
    ]);

}

function webhookModal() {

    return modal("webhook", "Enviar por webhook", [
        row("url", "URL do webhook", {
            style: TextInputStyle.Paragraph,
            placeholder: "https://discord.com/api/webhooks/...",
            max: 1000,
            required: true
        })
    ]);

}

/*
=========================
    IMPORTAR / EXPORTAR JSON
=========================
*/

function exportJson(data) {

    return JSON.stringify(
        {
            schema: EXPORT_SCHEMA,
            version: EXPORT_VERSION,
            ...normalize(data)
        },
        null,
        2
    );

}

/** Converte o texto de um .json em container validado. Lança Error com mensagem amigável. */
function parseImport(text) {

    let parsed;

    try {
        // Remove o BOM que alguns editores do Windows colocam no início.
        parsed = JSON.parse(String(text).replace(/^\uFEFF/, ""));
    } catch (error) {
        throw new Error(`JSON inválido (${error.message}).`);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("O JSON precisa conter um objeto de container.");
    }

    if (parsed.schema !== undefined && parsed.schema !== EXPORT_SCHEMA) {
        throw new Error("Esse JSON não foi exportado pelo /container da Nina.");
    }

    if (Number(parsed.version) > EXPORT_VERSION) {
        throw new Error("Esse arquivo é de uma versão mais nova do /container.");
    }

    const hasContent =
        parsed.title !== undefined ||
        parsed.description !== undefined ||
        Array.isArray(parsed.blocks);

    if (!hasContent) {
        throw new Error("O JSON não tem título, descrição nem blocos.");
    }

    const data = normalize(parsed);

    const problem = fits(data);

    if (problem) throw new Error(problem);

    return data;

}

function isJsonAttachment(attachment) {

    return (
        String(attachment?.name || "").toLowerCase().endsWith(".json") &&
        attachment.size <= IMPORT_MAX_BYTES
    );

}

/** Baixa um anexo .json do CDN do Discord (host fixo, timeout e limite de tamanho). */
async function downloadAttachment(attachment) {

    if (!String(attachment?.name || "").toLowerCase().endsWith(".json")) {
        throw new Error("O arquivo precisa ter a extensão `.json`.");
    }

    if (attachment.size > IMPORT_MAX_BYTES) {
        throw new Error("O arquivo excede o limite de 256 KB.");
    }

    let url;

    try {
        url = new URL(attachment.url);
    } catch {
        throw new Error("Link do anexo inválido.");
    }

    if (url.protocol !== "https:" || !DISCORD_CDN_HOSTS.has(url.hostname)) {
        throw new Error("O anexo precisa estar hospedado no Discord.");
    }

    const response = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    });

    if (!response.ok) {
        throw new Error(`Não consegui baixar o arquivo (HTTP ${response.status}).`);
    }

    // Não confia só no tamanho informado: conta os bytes enquanto lê.
    const chunks = [];
    let total = 0;

    for await (const chunk of response.body) {

        total += chunk.length;

        if (total > IMPORT_MAX_BYTES) {
            throw new Error("O arquivo excede o limite de 256 KB.");
        }

        chunks.push(chunk);

    }

    return Buffer.concat(chunks).toString("utf8");

}

/** Anexo .json -> container validado. */
async function importAttachment(attachment) {
    return parseImport(await downloadAttachment(attachment));
}

/*
=========================
    HELPERS DE RESPOSTA
=========================
*/

function warn(interaction, content) {

    return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
    });

}

/** Atualiza a mensagem do editor mesmo quando a interação atual já foi usada. */
async function refreshEditor(interaction, data) {

    const payload = message(data);

    try {
        await interaction.message.edit(payload);
    } catch {
        // A Nina pode não enxergar o canal: o token da interação ainda edita a mensagem.
        await interaction.webhook.editMessage(interaction.message.id, payload);
    }

}

function parseWebhookUrl(raw) {

    let url;

    try {
        url = new URL(raw);
    } catch {
        throw new Error("URL de webhook inválida.");
    }

    const validPath = /^\/api(\/v\d+)?\/webhooks\/\d+\/[\w-]+\/?$/.test(url.pathname);

    if (url.protocol !== "https:" || !WEBHOOK_HOSTS.has(url.hostname) || !validPath) {
        throw new Error("Informe uma URL de webhook oficial do Discord.");
    }

    // Descarta query string (thread_id etc.) para não enviar para onde não foi pedido.
    return `${url.origin}${url.pathname}`;

}

/*
=========================
    BOTÕES
=========================
*/

async function handleButton(interaction) {

    if (!interaction.isButton()) return false;

    if (!interaction.customId.startsWith("container:")) return false;

    const session = getSession(interaction.message.id);

    if (!session) {

        await warn(
            interaction,
            "❌ Essa sessão do `/container` expirou. Execute o comando novamente."
        );

        return true;

    }

    if (session.ownerId !== interaction.user.id) {

        await warn(
            interaction,
            "❌ Só quem abriu este editor pode usá-lo. Use `/container` para criar o seu."
        );

        return true;

    }

    const data = session.data;

    switch (interaction.customId) {

        case "container:edit":
            await interaction.showModal(editModal(data));
            return true;

        case "container:add":

            if (data.blocks.length >= MAX_BLOCKS) {
                await warn(interaction, `❌ Limite de **${MAX_BLOCKS} blocos** atingido. Remova algum antes.`);
                return true;
            }

            await interaction.showModal(blockModal());
            return true;

        case "container:remove":

            if (!data.blocks.length) {
                await warn(interaction, "❌ Não há blocos para remover.");
                return true;
            }

            await interaction.showModal(removeModal(data));
            return true;

        case "container:color":
            await interaction.showModal(colorModal(data));
            return true;

        case "container:webhook":
            await interaction.showModal(webhookModal());
            return true;

        case "container:preview":

            await interaction.reply({
                ...message(data, false),
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });

            return true;

        case "container:export":

            await interaction.reply({
                content:
                    "📋 Aqui está o JSON do seu container. " +
                    "Use **📥 Importar** (ou `/container arquivo:`) para carregá-lo de novo.",
                files: [{
                    attachment: Buffer.from(exportJson(data), "utf8"),
                    name: "container.json"
                }],
                flags: MessageFlags.Ephemeral
            });

            return true;

        case "container:import":
            await importFromChannel(interaction, session);
            return true;

        case "container:send":
            await sendToChannel(interaction, data);
            return true;

        case "container:cancel":

            removeSession(interaction.message.id);

            await interaction.update({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    new TextDisplayBuilder().setContent(
                        "## ❌ Editor encerrado\nSua sessão do `/container` foi encerrada."
                    )
                ]
            });

            return true;

        default:
            return false;

    }

}

async function sendToChannel(interaction, data) {

    if (!interaction.channel) {
        await warn(interaction, "❌ Não encontrei este canal.");
        return;
    }

    try {

        await interaction.channel.send(message(data, false));

    } catch (error) {

        console.error("❌ [Container] Falha ao enviar no canal:", error);

        await warn(
            interaction,
            `❌ Não consegui enviar neste canal. Verifique se tenho permissão para ver e escrever aqui.\n\`${error.message}\``
        );

        return;

    }

    await warn(interaction, "✅ Container enviado!");

}

/**
 * Botão 📥 Importar: o usuário posta o .json no canal e a Nina lê o anexo.
 */
async function importFromChannel(interaction, session) {

    if (
        !interaction.channel ||
        typeof interaction.channel.awaitMessages !== "function"
    ) {

        await warn(
            interaction,
            "❌ Não consigo receber o arquivo neste canal. Use `/container arquivo:` e anexe o `.json`."
        );

        return;

    }

    await interaction.reply({
        content:
            "📥 **Importar container**\n" +
            "Envie agora o arquivo `.json` (até 256 KB) como uma mensagem **neste canal**. " +
            "Ele é lido só para esta sessão e não é salvo no servidor.\n\n" +
            "💡 Se eu não enxergar este canal, use `/container arquivo:` e anexe o JSON no comando.\n\n" +
            "⏱️ Você tem **2 minutos**.",
        flags: MessageFlags.Ephemeral
    });

    try {

        // Sem `errors`: ao esgotar o tempo devolve uma coleção vazia
        // (com `errors: ["time"]` a promise rejeita com uma Collection, não com um Error).
        const collected = await interaction.channel.awaitMessages({
            time: IMPORT_WAIT_MS,
            max: 1,
            filter: msg =>
                msg.author.id === interaction.user.id &&
                [...msg.attachments.values()].some(isJsonAttachment)
        });

        const uploaded = collected.first();

        if (!uploaded) {

            await interaction.editReply({
                content: "⏱️ Tempo esgotado. Clique em **📥 Importar** novamente quando estiver pronto."
            });

            return;

        }

        const attachment = [...uploaded.attachments.values()].find(isJsonAttachment);

        const imported = await importAttachment(attachment);

        // A sessão pode ter expirado enquanto esperávamos o arquivo.
        if (!getSession(interaction.message.id)) {
            throw new Error("A sessão do editor expirou. Abra o /container de novo.");
        }

        session.data = imported;

        await refreshEditor(interaction, imported);

        await interaction.editReply({
            content: "✅ **Container importado!** O arquivo foi lido e não foi salvo no armazenamento da Nina."
        });

    } catch (error) {

        await interaction.editReply({
            content: `❌ Não consegui importar o container.\n\`${error.message}\``
        });

    }

}

/*
=========================
    MODAIS (submit)
=========================
*/

async function handleModal(interaction) {

    if (!interaction.isModalSubmit()) return false;

    if (!interaction.customId.startsWith("container_modal:")) return false;

    const action = interaction.customId.slice("container_modal:".length);

    const messageId = interaction.message?.id;

    const session = messageId ? getSession(messageId) : null;

    if (!session) {

        await warn(
            interaction,
            "❌ Essa sessão do `/container` expirou. Execute o comando novamente."
        );

        return true;

    }

    if (session.ownerId !== interaction.user.id) {

        await warn(interaction, "❌ Só quem abriu este editor pode usá-lo.");

        return true;

    }

    const value = id => interaction.fields.getTextInputValue(id).trim();

    // Webhook não altera o container: tratado à parte.
    if (action === "webhook") {
        await sendByWebhook(interaction, session.data, value("url"));
        return true;
    }

    const next = clone(session.data);

    if (action === "edit") {

        next.title = value("title") || defaultData().title;
        next.description = value("description");
        next.footer = value("footer");

    } else if (action === "add") {

        const content = value("content");

        if (!content) {
            await warn(interaction, "❌ O bloco não pode ficar vazio.");
            return true;
        }

        next.blocks.push(content);

    } else if (action === "remove") {

        const raw = value("index").toLowerCase();

        if (["todos", "todas", "all"].includes(raw)) {

            next.blocks = [];

        } else {

            const index = Number.parseInt(raw, 10);

            if (!Number.isInteger(index) || index < 1 || index > next.blocks.length) {

                await warn(
                    interaction,
                    next.blocks.length
                        ? `❌ Informe um número de 1 a ${next.blocks.length}, ou \`todos\`.`
                        : "❌ Não há blocos para remover."
                );

                return true;

            }

            next.blocks.splice(index - 1, 1);

        }

    } else if (action === "color") {

        const color = parseColor(value("color"));

        if (!color) {
            await warn(interaction, "❌ Cor inválida. Use `#RRGGBB`, por exemplo `#7C3AED`.");
            return true;
        }

        next.color = color;

    } else {

        return false;

    }

    // Remover bloco ou trocar a cor nunca aumenta o texto: só validamos o que pode crescer.
    if (action === "edit" || action === "add") {

        const problem = fits(next);

        if (problem) {
            await warn(interaction, `❌ ${problem}`);
            return true;
        }

    }

    session.data = next;

    await interaction.update(message(next));

    return true;

}

async function sendByWebhook(interaction, data, rawUrl) {

    // O envio pode demorar mais que os 3s da interação.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let webhook;

    try {

        webhook = new WebhookClient({ url: parseWebhookUrl(rawUrl) });

        await webhook.send({
            ...message(data, false),
            // Webhooks só aceitam componentes quando este parâmetro é enviado.
            withComponents: true
        });

        await interaction.editReply({ content: "✅ Container enviado pelo webhook." });

    } catch (error) {

        await interaction.editReply({
            content: `❌ Não consegui enviar pelo webhook.\n\`${error.message}\``
        });

    } finally {

        webhook?.destroy();

    }

}

module.exports = {
    // sessões
    startSession,
    getSession,
    removeSession,
    // dados
    defaultData,
    normalize,
    clone,
    fits,
    // render
    build,
    message,
    // import / export
    exportJson,
    parseImport,
    importAttachment,
    parseWebhookUrl,
    // interações
    handleButton,
    handleModal,
    // constantes úteis
    MAX_BLOCKS,
    MAX_TEXT_CHARS
};
