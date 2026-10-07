const {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const channelHandler = require("./channelHandler");
const EmbedButtons = require("./EmbedButtons");
const EmbedUtils = require("./EmbedUtils");

/*
=========================
    HELPERS
=========================
*/

function input({ id, label, style = TextInputStyle.Short, value, max, placeholder, required = false }) {

    const field = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(required);

    if (max) field.setMaxLength(max);

    if (placeholder) field.setPlaceholder(placeholder);

    // O Discord rejeita value maior que o maxLength do campo.
    if (value) field.setValue(String(value).slice(0, max || 4000));

    return new ActionRowBuilder().addComponents(field);

}

function modal(id, title, rows) {

    return new ModalBuilder()
        .setCustomId(id)
        .setTitle(title)
        .addComponents(...rows);

}

function warn(interaction, content) {

    return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral
    });

}

module.exports = {

    async execute(interaction) {

        if (!interaction.isButton())
            return;

        // Este handler também é o "fallback" de botões: só mexe nos seus.
        if (!interaction.customId.startsWith("embed_"))
            return;

        if (!await EmbedUtils.ensureManager(interaction))
            return;

        const id = interaction.customId;

        /*
        Cancelar e IA não dependem de haver uma embed na mensagem.
        */

        if (id === "embed_cancel") {

            channelHandler.clearChannel(interaction);

            return interaction.update({
                content: "❌ Editor fechado.",
                embeds: [],
                components: []
            });

        }

        if (id === "embed_ai") {

            return interaction.showModal(
                modal("embed_ai_modal", "Criar Embed com IA", [
                    input({
                        id: "prompt",
                        label: "Descreva a embed",
                        style: TextInputStyle.Paragraph,
                        placeholder: "Ex: Crie uma embed azul anunciando uma manutenção do servidor.",
                        max: 2000,
                        required: true
                    })
                ])
            );

        }

        const current = interaction.message.embeds[0];

        if (!current) {

            return warn(
                interaction,
                "❌ Não achei a embed neste painel. Use `/embed` para abrir um novo editor."
            );

        }

        const data = EmbedUtils.fromEmbed(current);

        /*
        =========================
            EDITAR
        =========================
        */

        if (id === "embed_edit") {

            return interaction.showModal(
                modal("embed_edit_modal", "Editar Embed", [
                    input({
                        id: "title",
                        label: "Título",
                        value: data.title,
                        max: EmbedUtils.LIMITS.title
                    }),
                    input({
                        id: "description",
                        label: "Descrição",
                        style: TextInputStyle.Paragraph,
                        value: data.description,
                        // O campo de texto do Discord aceita no máximo 4000
                        max: 4000
                    }),
                    input({
                        id: "color",
                        label: "Cor (#5865F2)",
                        value: data.color,
                        max: 7
                    })
                ])
            );

        }

        /*
        =========================
            IMAGENS
        =========================
        */

        if (id === "embed_images") {

            return interaction.showModal(
                modal("embed_images_modal", "Imagens da Embed", [
                    input({
                        id: "thumbnail",
                        label: "Thumbnail (URL)",
                        value: data.thumbnail,
                        max: 1000
                    }),
                    input({
                        id: "image",
                        label: "Imagem (URL)",
                        value: data.image,
                        max: 1000
                    })
                ])
            );

        }

        /*
        =========================
            AUTOR
        =========================
        */

        if (id === "embed_author") {

            return interaction.showModal(
                modal("embed_author_modal", "Autor da Embed", [
                    input({
                        id: "author_name",
                        label: "Nome",
                        value: data.author.name,
                        max: EmbedUtils.LIMITS.author
                    }),
                    input({
                        id: "author_icon",
                        label: "Ícone (URL)",
                        value: data.author.iconURL,
                        max: 1000
                    }),
                    input({
                        id: "author_url",
                        label: "Link (opcional)",
                        value: data.author.url,
                        max: 1000
                    })
                ])
            );

        }

        /*
        =========================
            RODAPÉ
        =========================
        */

        if (id === "embed_footer") {

            return interaction.showModal(
                modal("embed_footer_modal", "Rodapé da Embed", [
                    input({
                        id: "footer_text",
                        label: "Texto",
                        value: data.footer.text,
                        max: EmbedUtils.LIMITS.footer
                    }),
                    input({
                        id: "footer_icon",
                        label: "Ícone (URL)",
                        value: data.footer.iconURL,
                        max: 1000
                    })
                ])
            );

        }

        /*
        =========================
            FIELDS (adicionar / remover)
        =========================
        */

        if (id === "embed_fields") {

            return interaction.showModal(
                modal("embed_fields_modal", `Fields (${data.fields.length}/${EmbedUtils.LIMITS.fields})`, [
                    input({
                        id: "field_name",
                        label: "Nome do novo field",
                        max: EmbedUtils.LIMITS.fieldName
                    }),
                    input({
                        id: "field_value",
                        label: "Valor do novo field",
                        style: TextInputStyle.Paragraph,
                        max: EmbedUtils.LIMITS.fieldValue
                    }),
                    input({
                        id: "field_inline",
                        label: "Inline? (sim/não)",
                        max: 5
                    }),
                    input({
                        id: "field_remove",
                        label: "OU remover: nº do field ou \"todos\"",
                        placeholder: data.fields.length
                            ? `Deixe vazio para adicionar. Existem ${data.fields.length} field(s).`
                            : "Ainda não há fields.",
                        max: 10
                    })
                ])
            );

        }

        /*
        =========================
            TIMESTAMP
        =========================
        */

        if (id === "embed_timestamp") {

            const embed = EmbedBuilder.from(current);

            embed.setTimestamp(embed.data.timestamp ? null : new Date());

            return interaction.update({
                embeds: [embed],
                components: EmbedButtons.build()
            });

        }

        /*
        =========================
            CANAL
        =========================
        */

        if (id === "embed_channel") {

            const menu = new ChannelSelectMenuBuilder()
                .setCustomId("embed_channel_select")
                .setPlaceholder("Escolha um canal")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                );

            return interaction.update({
                embeds: interaction.message.embeds,
                components: [
                    ...EmbedButtons.build(),
                    new ActionRowBuilder().addComponents(menu)
                ]
            });

        }

        /*
        =========================
            ENVIAR
        =========================
        */

        if (id === "embed_send") {

            const channelId = channelHandler.getChannel(interaction);

            if (!channelId) {
                return warn(interaction, "❌ Escolha um canal primeiro (botão **Canal**).");
            }

            if (!EmbedUtils.hasContent(data)) {
                return warn(interaction, "❌ A embed está vazia. Edite-a antes de enviar.");
            }

            const channel =
                interaction.guild.channels.cache.get(channelId) ??
                await interaction.guild.channels.fetch(channelId).catch(() => null);

            if (!channel || !channel.isTextBased()) {
                return warn(interaction, "❌ Canal não encontrado. Escolha o canal de novo.");
            }

            // Quem usa o editor precisa poder escrever lá, e a Nina também.
            const needed = [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ];

            const memberCan =
                channel.permissionsFor(interaction.member)?.has(needed);

            if (!memberCan) {
                return warn(interaction, `❌ Você não tem permissão para enviar embeds em ${channel}.`);
            }

            const botCan =
                channel.permissionsFor(interaction.guild.members.me)?.has(needed);

            if (!botCan) {
                return warn(
                    interaction,
                    `❌ Eu preciso de **Ver canal**, **Enviar mensagens** e **Inserir links** em ${channel}.`
                );
            }

            const toSend = EmbedBuilder.from(current);

            // Timestamp ligado = hora do envio, não da última edição.
            if (toSend.data.timestamp) toSend.setTimestamp();

            try {

                await channel.send({
                    embeds: [toSend],
                    allowedMentions: { parse: [] }
                });

            } catch (error) {

                console.error("❌ [Embed] Falha ao enviar:", error);

                return warn(interaction, `❌ Não consegui enviar a embed: \`${error.message}\``);

            }

            channelHandler.clearChannel(interaction);

            return interaction.update({
                content: `✅ Embed enviada em ${channel}!`,
                embeds: [],
                components: []
            });

        }

    }

};
