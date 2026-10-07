const AIManager = require("../../ai/AIManager");

const { MessageFlags } = require("discord.js");

const EmbedButtons = require("./EmbedButtons");
const EmbedPreview = require("./EmbedPreview");
const EmbedUtils = require("./EmbedUtils");

const EDIT_MODALS = new Set([
    "embed_edit_modal",
    "embed_images_modal",
    "embed_author_modal",
    "embed_footer_modal",
    "embed_fields_modal"
]);

function warn(interaction, content) {

    return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
    });

}

/** Lê um campo de texto (vazio se o campo não existir). */
function field(interaction, id) {

    try {
        return interaction.fields.getTextInputValue(id).trim();
    } catch {
        return "";
    }

}

/** Valida uma URL opcional. Devolve { ok, value }. */
function optionalUrl(value) {

    if (!value) return { ok: true, value: "" };

    const parsed = EmbedUtils.parseUrl(value);

    return parsed
        ? { ok: true, value: parsed }
        : { ok: false, value: "" };

}

/*
=========================
    IA
=========================
*/

async function handleAI(interaction) {

    const prompt = field(interaction, "prompt");

    // Veio do botão 🤖 do painel (edita o painel) ou do /embedia (cria um painel novo)?
    const fromPanel = interaction.isFromMessage();

    if (fromPanel) {
        await interaction.deferUpdate();
    } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {

        const generated = await AIManager.generateEmbed(prompt);

        const data = EmbedUtils.sanitize(generated);

        if (!EmbedUtils.hasContent(data)) {
            throw new Error("A IA devolveu uma embed vazia.");
        }

        return interaction.editReply({
            content: "🤖 Embed gerada pela IA. Ajuste o que quiser, escolha um canal e envie.",
            embeds: [EmbedPreview.build(data)],
            components: EmbedButtons.build()
        });

    } catch (error) {

        console.error("❌ [Embed] Falha na IA:", error);

        const content = "❌ Não consegui gerar essa embed. Tente descrever de outro jeito.";

        // No painel, editReply sobrescreveria o editor: avisa em mensagem separada.
        if (fromPanel) {

            return interaction.followUp({
                content,
                flags: MessageFlags.Ephemeral
            });

        }

        return interaction.editReply({ content });

    }

}

/*
=========================
    EDIÇÃO
=========================
*/

async function handleEdit(interaction) {

    const current = interaction.message?.embeds?.[0];

    if (!current) {

        return warn(
            interaction,
            "❌ Esse painel expirou. Use `/embed` para abrir um novo editor."
        );

    }

    const data = EmbedUtils.fromEmbed(current);

    const id = interaction.customId;

    /*
    EDITAR
    */

    if (id === "embed_edit_modal") {

        const colorInput = field(interaction, "color");

        const color = colorInput
            ? EmbedUtils.parseColor(colorInput)
            : EmbedUtils.DEFAULT_COLOR;

        if (!color) {
            return warn(interaction, "❌ Cor inválida. Use o formato `#RRGGBB`, por exemplo `#5865F2`.");
        }

        data.title = field(interaction, "title");
        data.description = field(interaction, "description");
        data.color = color;

    }

    /*
    IMAGENS
    */

    if (id === "embed_images_modal") {

        const thumbnail = optionalUrl(field(interaction, "thumbnail"));
        const image = optionalUrl(field(interaction, "image"));

        if (!thumbnail.ok || !image.ok) {

            return warn(
                interaction,
                `❌ ${!thumbnail.ok ? "Thumbnail" : "Imagem"} inválida. Use um link completo começando com \`https://\`.`
            );

        }

        data.thumbnail = thumbnail.value;
        data.image = image.value;

    }

    /*
    AUTOR
    */

    if (id === "embed_author_modal") {

        const name = field(interaction, "author_name");
        const icon = optionalUrl(field(interaction, "author_icon"));
        const url = optionalUrl(field(interaction, "author_url"));

        if (!icon.ok || !url.ok) {

            return warn(
                interaction,
                `❌ ${!icon.ok ? "O ícone" : "O link"} do autor é inválido. Use \`https://...\`.`
            );

        }

        data.author = name
            ? { name, iconURL: icon.value, url: url.value }
            : { name: "", iconURL: "", url: "" };

    }

    /*
    RODAPÉ
    */

    if (id === "embed_footer_modal") {

        const text = field(interaction, "footer_text");
        const icon = optionalUrl(field(interaction, "footer_icon"));

        if (!icon.ok) {
            return warn(interaction, "❌ O ícone do rodapé é inválido. Use `https://...`.");
        }

        data.footer = text
            ? { text, iconURL: icon.value }
            : { text: "", iconURL: "" };

    }

    /*
    FIELDS
    */

    if (id === "embed_fields_modal") {

        const remove = field(interaction, "field_remove").toLowerCase();

        if (remove) {

            if (["todos", "todas", "all"].includes(remove)) {

                data.fields = [];

            } else {

                const index = Number.parseInt(remove, 10);

                if (!Number.isInteger(index) || index < 1 || index > data.fields.length) {

                    return warn(
                        interaction,
                        data.fields.length
                            ? `❌ Informe um número de 1 a ${data.fields.length}, ou \`todos\`.`
                            : "❌ Não há fields para remover."
                    );

                }

                data.fields.splice(index - 1, 1);

            }

        } else {

            const name = field(interaction, "field_name");
            const value = field(interaction, "field_value");

            if (!name || !value) {

                return warn(
                    interaction,
                    "❌ Para adicionar um field, preencha **Nome** e **Valor**."
                );

            }

            if (data.fields.length >= EmbedUtils.LIMITS.fields) {

                return warn(
                    interaction,
                    `❌ Uma embed aceita no máximo ${EmbedUtils.LIMITS.fields} fields. Remova algum antes.`
                );

            }

            data.fields.push({
                name,
                value,
                inline: EmbedUtils.parseBool(field(interaction, "field_inline"))
            });

        }

    }

    // Uma embed sem nenhum conteúdo é rejeitada pelo Discord ao editar a mensagem.
    if (!EmbedUtils.hasContent(data)) {

        return warn(
            interaction,
            "❌ A embed ficaria vazia. Mantenha pelo menos um conteúdo (título, descrição, imagem, field...)."
        );

    }

    // Limite global de 6000 caracteres da embed
    if (EmbedUtils.totalLength(data) > EmbedUtils.LIMITS.total) {

        return warn(
            interaction,
            `❌ A embed passaria do limite de ${EmbedUtils.LIMITS.total} caracteres do Discord. Encurte algum texto.`
        );

    }

    return interaction.update({
        embeds: [EmbedPreview.build(data)],
        components: EmbedButtons.build()
    });

}

module.exports = {

    async execute(interaction) {

        if (!interaction.isModalSubmit()) return;

        const id = interaction.customId;

        if (id !== "embed_ai_modal" && !EDIT_MODALS.has(id)) return;

        if (!await EmbedUtils.ensureManager(interaction)) return;

        if (id === "embed_ai_modal") {
            return handleAI(interaction);
        }

        return handleEdit(interaction);

    }

};
