const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

const ui = require("../../utils/ui");

const WelcomeRepository = require("../../database/repositories/WelcomeRepository");
const WelcomeCardManager = require("../../managers/WelcomeCardManager");

const TIPOS_IMAGEM_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];

module.exports = {

    data: new SlashCommandBuilder()

        .setName("boasvindas")

        .setDescription("Configura o sistema de boas-vindas com imagem personalizada.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>

            sub
                .setName("ativar")
                .setDescription("Ativa as boas-vindas neste servidor.")
                .addChannelOption(o => o.setName("canal").setDescription("Canal onde a imagem de boas-vindas será enviada.").addChannelTypes(ChannelType.GuildText).setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("desativar")
                .setDescription("Desativa as boas-vindas neste servidor.")

        )

        .addSubcommand(sub =>

            sub
                .setName("fundo")
                .setDescription("Define a imagem de fundo do cartão de boas-vindas.")
                .addAttachmentOption(o => o.setName("imagem").setDescription("Imagem de fundo (deixe vazio pra voltar ao padrão).").setRequired(false))

        )

        .addSubcommand(sub =>

            sub
                .setName("texto")
                .setDescription("Personaliza o texto do cartão. Use {usuario}, {servidor} e {membros}.")
                .addStringOption(o => o.setName("titulo").setDescription("Texto principal do cartão.").setRequired(false))
                .addStringOption(o => o.setName("subtitulo").setDescription("Texto menor, abaixo do título.").setRequired(false))

        )

        .addSubcommand(sub =>

            sub
                .setName("mensagem")
                .setDescription("Personaliza a mensagem de texto enviada junto com a imagem. Use {menção}.")
                .addStringOption(o => o.setName("conteudo").setDescription("Ex: 🎉 Chegou gente nova, {menção}!").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("cor")
                .setDescription("Cor de destaque do cartão (borda, contorno do avatar).")
                .addStringOption(o => o.setName("hex").setDescription("Cor em hexadecimal, ex: #5865F2").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("testar")
                .setDescription("Manda uma prévia do cartão de boas-vindas pra você.")

        )

        .addSubcommand(sub =>

            sub
                .setName("status")
                .setDescription("Mostra a configuração atual das boas-vindas.")

        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        /*
        =========================
            ATIVAR
        =========================
        */

        if (sub === "ativar") {

            const canal = interaction.options.getChannel("canal");

            const botMember = await guild.members.fetchMe();
            const permissoes = canal.permissionsFor(botMember);

            if (!permissoes || !permissoes.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles])) {

                return ui.caution(
                    interaction,
                    `Em ${canal} eu preciso de:\n${ui.bullets(["Ver o canal", "Enviar mensagens", "Anexar arquivos"])}`,
                    "Faltam permissões"
                );

            }

            await WelcomeRepository.update(guild.id, { enabled: true, channel_id: canal.id });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "heart",
                title: "Boas-vindas ativadas!",
                description: `Novos membros serão recebidos em ${canal}.\nUse \`/boasvindas testar\` para ver uma prévia.`,
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            DESATIVAR
        =========================
        */

        if (sub === "desativar") {

            await WelcomeRepository.update(guild.id, { enabled: false });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "heart",
                title: "Boas-vindas desativadas",
                description: "Ninguém será recebido até você ativar de novo com `/boasvindas ativar`.",
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            FUNDO
        =========================
        */

        if (sub === "fundo") {

            const anexo = interaction.options.getAttachment("imagem");

            if (!anexo) {

                await WelcomeRepository.update(guild.id, { background_url: null });

                return ui.ok(interaction, "O cartão volta a usar o gradiente padrão.", "Fundo removido");

            }

            if (!TIPOS_IMAGEM_ACEITOS.includes(anexo.contentType)) {

                return ui.caution(interaction, "Envie uma imagem válida (PNG, JPEG, WEBP ou GIF).", "Imagem inválida");

            }

            if (anexo.size > 8 * 1024 * 1024) {

                return ui.caution(interaction, "A imagem precisa ter até **8 MB**.", "Imagem muito grande");

            }

            await WelcomeRepository.update(guild.id, { background_url: anexo.url });

            return ui.ok(interaction, "Use `/boasvindas testar` para ver como ficou.", "Fundo atualizado");

        }

        /*
        =========================
            TEXTO
        =========================
        */

        if (sub === "texto") {

            const titulo = interaction.options.getString("titulo");
            const subtitulo = interaction.options.getString("subtitulo");

            if (!titulo && !subtitulo) {

                return ui.caution(interaction, "Informe pelo menos o título ou o subtítulo.", "Nada para alterar");

            }

            const campos = {};

            if (titulo) campos.title_text = titulo;
            if (subtitulo) campos.subtitle_text = subtitulo;

            await WelcomeRepository.update(guild.id, campos);

            return ui.ok(interaction, "Use `/boasvindas testar` para conferir.", "Texto do cartão atualizado");

        }

        /*
        =========================
            MENSAGEM
        =========================
        */

        if (sub === "mensagem") {

            const conteudo = interaction.options.getString("conteudo");

            await WelcomeRepository.update(guild.id, { message_content: conteudo });

            return ui.ok(interaction, "A mensagem enviada junto com o cartão foi atualizada.", "Mensagem atualizada");

        }

        /*
        =========================
            COR
        =========================
        */

        if (sub === "cor") {

            const hex = interaction.options.getString("hex");

            if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) {

                return ui.caution(interaction, "Use um hexadecimal, por exemplo `#5865F2`.", "Cor inválida");

            }

            const corFormatada = hex.startsWith("#") ? hex : `#${hex}`;

            await WelcomeRepository.update(guild.id, { accent_color: corFormatada });

            return ui.respond(interaction, ui.panel({
                color: parseInt(corFormatada.slice(1), 16),
                emoji: "sparkle",
                title: "Cor de destaque atualizada",
                description: `Nova cor: ${ui.code(corFormatada)} (a lateral deste aviso mostra como fica).`,
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            TESTAR
        =========================
        */

        if (sub === "testar") {

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const config = await WelcomeRepository.get(guild.id);

            try {

                const buffer = await WelcomeCardManager.gerarCartao(interaction.member, config);
                const anexo = new AttachmentBuilder(buffer, { name: "boas-vindas.png" });

                const conteudo = WelcomeCardManager.aplicarVariaveis(config.message_content, { member: interaction.member });

                return ui.respond(interaction, ui.panel({
                    color: config.accent_color,
                    emoji: "image",
                    title: "Prévia das boas-vindas",
                    description: `${conteudo}`,
                    image: "attachment://boas-vindas.png",
                    footer: "Isto é só um teste: ninguém mais vê",
                    source: interaction
                }), { files: [anexo] });

            } catch (error) {

                console.error("[Boas-vindas] Erro ao gerar prévia:", error);

                return ui.respond(interaction, ui.error(`Não consegui gerar a imagem: ${error.message}`, "Falha na prévia", interaction));

            }

        }

        /*
        =========================
            STATUS
        =========================
        */

        if (sub === "status") {

            const config = await WelcomeRepository.get(guild.id);

            const embed = ui.panel({
                color: config.accent_color,
                emoji: "heart",
                title: "Configuração de boas-vindas",
                fields: [
                    ui.field("config", "Status", ui.toggle(config.enabled)),
                    ui.field("channel", "Canal", config.channel_id ? `<#${config.channel_id}>` : "—"),
                    ui.field("sparkle", "Cor", ui.code(config.accent_color)),
                    ui.field("image", "Fundo", config.background_url ? `[Ver imagem](${config.background_url})` : "Padrão (gradiente)", false),
                    ui.field("star", "Título", config.title_text, false),
                    ui.field("star", "Subtítulo", config.subtitle_text, false),
                    ui.field("mail", "Mensagem", config.message_content, false)
                ],
                footer: "Use /boasvindas testar para ver uma prévia",
                source: interaction
            });

            return ui.respond(interaction, embed, { ephemeral: true });

        }

    }

};
