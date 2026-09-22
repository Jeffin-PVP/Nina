const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    AttachmentBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

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

                return interaction.reply({
                    content: `⚠️ Preciso de permissão pra ver, enviar mensagens e anexar arquivos em ${canal}.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            await WelcomeRepository.update(guild.id, { enabled: true, channel_id: canal.id });

            return interaction.reply({
                content: `✅ Boas-vindas ativadas em ${canal}! Use \`/boasvindas testar\` pra ver uma prévia.`,
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            DESATIVAR
        =========================
        */

        if (sub === "desativar") {

            await WelcomeRepository.update(guild.id, { enabled: false });

            return interaction.reply({
                content: "✅ Boas-vindas desativadas.",
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.reply({
                    content: "✅ Fundo removido — o cartão volta a usar o gradiente padrão.",
                    flags: MessageFlags.Ephemeral
                });

            }

            if (!TIPOS_IMAGEM_ACEITOS.includes(anexo.contentType)) {

                return interaction.reply({
                    content: "⚠️ Envie uma imagem válida (PNG, JPEG, WEBP ou GIF).",
                    flags: MessageFlags.Ephemeral
                });

            }

            if (anexo.size > 8 * 1024 * 1024) {

                return interaction.reply({
                    content: "⚠️ A imagem precisa ter até 8MB.",
                    flags: MessageFlags.Ephemeral
                });

            }

            await WelcomeRepository.update(guild.id, { background_url: anexo.url });

            return interaction.reply({
                content: "✅ Fundo atualizado! Use `/boasvindas testar` pra ver como ficou.",
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.reply({
                    content: "⚠️ Informe pelo menos o título ou o subtítulo.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const campos = {};

            if (titulo) campos.title_text = titulo;
            if (subtitulo) campos.subtitle_text = subtitulo;

            await WelcomeRepository.update(guild.id, campos);

            return interaction.reply({
                content: "✅ Texto do cartão atualizado! Use `/boasvindas testar` pra conferir.",
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            MENSAGEM
        =========================
        */

        if (sub === "mensagem") {

            const conteudo = interaction.options.getString("conteudo");

            await WelcomeRepository.update(guild.id, { message_content: conteudo });

            return interaction.reply({
                content: "✅ Mensagem de texto atualizada.",
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            COR
        =========================
        */

        if (sub === "cor") {

            const hex = interaction.options.getString("hex");

            if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) {

                return interaction.reply({
                    content: "⚠️ Cor inválida. Use um hexadecimal, ex: `#5865F2`.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const corFormatada = hex.startsWith("#") ? hex : `#${hex}`;

            await WelcomeRepository.update(guild.id, { accent_color: corFormatada });

            return interaction.reply({
                content: `✅ Cor de destaque atualizada para \`${corFormatada}\`.`,
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.editReply({
                    content: `**Prévia** (isso é só um teste, ninguém mais vê):\n${conteudo}`,
                    files: [anexo]
                });

            } catch (error) {

                console.error("[Boas-vindas] Erro ao gerar prévia:", error);

                return interaction.editReply({
                    content: `❌ Não consegui gerar a imagem: ${error.message}`
                });

            }

        }

        /*
        =========================
            STATUS
        =========================
        */

        if (sub === "status") {

            const config = await WelcomeRepository.get(guild.id);

            const embed = new EmbedBuilder()
                .setColor(config.accent_color)
                .setTitle("👋 Configuração de boas-vindas")
                .addFields(
                    { name: "Status", value: config.enabled ? "🟢 Ativado" : "🔴 Desativado", inline: true },
                    { name: "Canal", value: config.channel_id ? `<#${config.channel_id}>` : "—", inline: true },
                    { name: "Cor", value: config.accent_color, inline: true },
                    { name: "Fundo", value: config.background_url ? `[Ver imagem](${config.background_url})` : "Padrão (gradiente)" },
                    { name: "Título", value: config.title_text },
                    { name: "Subtítulo", value: config.subtitle_text },
                    { name: "Mensagem", value: config.message_content }
                );

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

    }

};
