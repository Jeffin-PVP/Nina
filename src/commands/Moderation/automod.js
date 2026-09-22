const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

const AutomodRepository = require("../../database/repositories/AutomodRepository");
const AutomodManager = require("../../managers/AutomodManager");

function acoesParaTexto(csv) {

    const mapa = { delete: "Apagar", notify: "Notificar", warn: "Advertir", mute: "Mutar" };

    const lista = AutomodRepository.parseLista(csv).map(a => mapa[a] || a);

    return lista.length ? lista.join(", ") : "Nenhuma";

}

// Monta a string de ações (csv) a partir dos 4 booleans opcionais, preservando
// o que já estava configurado quando um argumento não é informado.
function montarAcoes(atualCsv, { apagar, notificar, advertir, mutar }) {

    const atuais = new Set(AutomodRepository.parseLista(atualCsv));

    if (apagar !== undefined) atuais[apagar ? "add" : "delete"]("delete");
    if (notificar !== undefined) atuais[notificar ? "add" : "delete"]("notify");
    if (advertir !== undefined) atuais[advertir ? "add" : "delete"]("warn");
    if (mutar !== undefined) atuais[mutar ? "add" : "delete"]("mute");

    return Array.from(atuais).join(",");

}

function opcoesDeAcao(sub) {

    return sub
        .addBooleanOption(o => o.setName("apagar").setDescription("Apagar a mensagem?").setRequired(false))
        .addBooleanOption(o => o.setName("notificar").setDescription("Avisar o usuário no canal?").setRequired(false))
        .addBooleanOption(o => o.setName("advertir").setDescription("Contar como uma advertência (warn)?").setRequired(false))
        .addBooleanOption(o => o.setName("mutar").setDescription("Aplicar timeout no usuário?").setRequired(false));

}

module.exports = {

    data: new SlashCommandBuilder()

        .setName("automod")

        .setDescription("Configura o AutoMod: anti-spam, anti-emoji, filtro de palavrões, anti-raid e mais.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub => sub.setName("ativar").setDescription("Ativa o AutoMod neste servidor."))

        .addSubcommand(sub => sub.setName("desativar").setDescription("Desativa o AutoMod neste servidor."))

        .addSubcommand(sub => sub.setName("status").setDescription("Mostra a configuração atual do AutoMod."))

        .addSubcommand(sub =>
            sub
                .setName("mute-duracao")
                .setDescription("Define por quanto tempo o timeout dura quando a ação 'mutar' é acionada.")
                .addIntegerOption(o => o.setName("minutos").setDescription("Duração em minutos.").setMinValue(1).setMaxValue(10080).setRequired(true))
        )

        .addSubcommandGroup(group =>

            group
                .setName("regra")
                .setDescription("Configura uma regra específica do AutoMod.")

                .addSubcommand(sub =>
                    opcoesDeAcao(
                        sub
                            .setName("spam")
                            .setDescription("Anti-spam de mensagens (flood).")
                            .addBooleanOption(o => o.setName("ativado").setDescription("Ativar essa regra?").setRequired(false))
                            .addIntegerOption(o => o.setName("maximo").setDescription("Máximo de mensagens no intervalo.").setMinValue(2).setMaxValue(30).setRequired(false))
                            .addIntegerOption(o => o.setName("intervalo").setDescription("Intervalo em segundos.").setMinValue(2).setMaxValue(60).setRequired(false))
                    )
                )

                .addSubcommand(sub =>
                    opcoesDeAcao(
                        sub
                            .setName("emoji")
                            .setDescription("Anti-spam de emojis por mensagem.")
                            .addBooleanOption(o => o.setName("ativado").setDescription("Ativar essa regra?").setRequired(false))
                            .addIntegerOption(o => o.setName("maximo").setDescription("Máximo de emojis por mensagem.").setMinValue(3).setMaxValue(50).setRequired(false))
                    )
                )

                .addSubcommand(sub =>
                    opcoesDeAcao(
                        sub
                            .setName("palavrao")
                            .setDescription("Filtro de linguagem imprópria/xingamentos.")
                            .addBooleanOption(o => o.setName("ativado").setDescription("Ativar essa regra?").setRequired(false))
                    )
                )

                .addSubcommand(sub =>
                    opcoesDeAcao(
                        sub
                            .setName("mencao")
                            .setDescription("Anti-spam de menções (@usuário/@cargo) por mensagem.")
                            .addBooleanOption(o => o.setName("ativado").setDescription("Ativar essa regra?").setRequired(false))
                            .addIntegerOption(o => o.setName("maximo").setDescription("Máximo de menções por mensagem.").setMinValue(2).setMaxValue(30).setRequired(false))
                    )
                )

                .addSubcommand(sub =>
                    opcoesDeAcao(
                        sub
                            .setName("convite")
                            .setDescription("Bloqueia links de convite de outros servidores.")
                            .addBooleanOption(o => o.setName("ativado").setDescription("Ativar essa regra?").setRequired(false))
                    )
                )

        )

        .addSubcommandGroup(group =>

            group
                .setName("palavras")
                .setDescription("Gerencia a lista de palavras bloqueadas pelo filtro de palavrão.")

                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Adiciona uma palavra à lista de bloqueio.")
                        .addStringOption(o => o.setName("palavra").setDescription("Palavra a bloquear.").setRequired(true))
                )

                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove uma palavra da lista de bloqueio.")
                        .addStringOption(o => o.setName("palavra").setDescription("Palavra a remover.").setRequired(true))
                )

                .addSubcommand(sub =>
                    sub
                        .setName("listar")
                        .setDescription("Lista as palavras customizadas bloqueadas neste servidor.")
                )

        )

        .addSubcommandGroup(group =>

            group
                .setName("raid")
                .setDescription("Configura o anti-raid (entrada em massa de contas).")

                .addSubcommand(sub =>
                    sub
                        .setName("configurar")
                        .setDescription("Configura a detecção e a resposta ao anti-raid.")
                        .addBooleanOption(o => o.setName("ativado").setDescription("Ativar anti-raid?").setRequired(false))
                        .addIntegerOption(o => o.setName("entradas").setDescription("Quantas entradas no intervalo disparam o raid.").setMinValue(3).setMaxValue(100).setRequired(false))
                        .addIntegerOption(o => o.setName("intervalo").setDescription("Intervalo em segundos.").setMinValue(5).setMaxValue(600).setRequired(false))
                        .addStringOption(o =>
                            o.setName("acao")
                                .setDescription("O que fazer ao detectar um raid.")
                                .setRequired(false)
                                .addChoices(
                                    { name: "Lockdown (tranca todos os canais)", value: "lockdown" },
                                    { name: "Expulsar quem entrou na onda", value: "kick_new" },
                                    { name: "Banir quem entrou na onda", value: "ban_new" }
                                )
                        )
                )

                .addSubcommand(sub =>
                    sub
                        .setName("desativar-lockdown")
                        .setDescription("Destrava os canais travados pelo anti-raid e encerra o modo raid.")
                )

        )

        .addSubcommandGroup(group =>

            group
                .setName("ignorar")
                .setDescription("Canais/cargos que o AutoMod nunca deve mexer.")

                .addSubcommand(sub =>
                    sub
                        .setName("canal")
                        .setDescription("Adiciona ou remove um canal da lista de exceções.")
                        .addChannelOption(o => o.setName("canal").setDescription("Canal.").addChannelTypes(ChannelType.GuildText).setRequired(true))
                )

                .addSubcommand(sub =>
                    sub
                        .setName("cargo")
                        .setDescription("Adiciona ou remove um cargo da lista de exceções.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo.").setRequired(true))
                )

        ),

    async execute(interaction) {

        const grupo = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        /*
        =========================
            TOP-LEVEL
        =========================
        */

        if (!grupo && sub === "ativar") {

            await AutomodRepository.update(guild.id, { enabled: true });

            return interaction.reply({
                content: "✅ AutoMod **ativado**! Use `/automod status` pra ver o que está configurado.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (!grupo && sub === "desativar") {

            await AutomodRepository.update(guild.id, { enabled: false });

            return interaction.reply({ content: "✅ AutoMod **desativado**.", flags: MessageFlags.Ephemeral });

        }

        if (!grupo && sub === "mute-duracao") {

            const minutos = interaction.options.getInteger("minutos");

            await AutomodRepository.update(guild.id, { mute_duration_minutes: minutos });

            return interaction.reply({
                content: `✅ A ação "mutar" agora aplica timeout de **${minutos} minuto(s)**.`,
                flags: MessageFlags.Ephemeral
            });

        }

        if (!grupo && sub === "status") {

            const c = await AutomodRepository.get(guild.id);

            const embed = new EmbedBuilder()
                .setColor(c.enabled ? "#57F287" : "#99AAB5")
                .setTitle("🛡️ Configuração do AutoMod")
                .setDescription(c.enabled ? "🟢 **Ativado**" : "🔴 **Desativado**")
                .addFields(

                    {
                        name: "💬 Spam de mensagens",
                        value: c.spam_enabled
                            ? `Ativado — máx. ${c.spam_max_messages} msgs / ${c.spam_interval_seconds}s\nAções: ${acoesParaTexto(c.spam_actions)}`
                            : "Desativado"
                    },

                    {
                        name: "😃 Spam de emojis",
                        value: c.emoji_enabled
                            ? `Ativado — máx. ${c.emoji_max_count} por mensagem\nAções: ${acoesParaTexto(c.emoji_actions)}`
                            : "Desativado"
                    },

                    {
                        name: "🤬 Palavrão",
                        value: c.swear_enabled
                            ? `Ativado — ${AutomodRepository.parseLista(c.swear_custom_words).length} palavra(s) customizada(s)\nAções: ${acoesParaTexto(c.swear_actions)}`
                            : "Desativado"
                    },

                    {
                        name: "📣 Spam de menções",
                        value: c.mention_enabled
                            ? `Ativado — máx. ${c.mention_max_count} por mensagem\nAções: ${acoesParaTexto(c.mention_actions)}`
                            : "Desativado"
                    },

                    {
                        name: "🔗 Links de convite",
                        value: c.invite_enabled ? `Ativado\nAções: ${acoesParaTexto(c.invite_actions)}` : "Desativado"
                    },

                    {
                        name: "🚨 Anti-raid",
                        value: c.raid_enabled
                            ? `Ativado — ${c.raid_join_threshold} entradas / ${c.raid_interval_seconds}s → ${c.raid_action}`
                            : "Desativado"
                    },

                    {
                        name: "⏱️ Duração do mute",
                        value: `${c.mute_duration_minutes} minuto(s)`,
                        inline: true
                    },

                    {
                        name: "🙈 Canais ignorados",
                        value: String(AutomodRepository.parseLista(c.ignored_channels).length),
                        inline: true
                    },

                    {
                        name: "🙈 Cargos ignorados",
                        value: String(AutomodRepository.parseLista(c.ignored_roles).length),
                        inline: true
                    }

                );

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        /*
        =========================
            REGRA
        =========================
        */

        if (grupo === "regra") {

            const config = await AutomodRepository.get(guild.id);

            const ativado = interaction.options.getBoolean("ativado");
            const acoesBools = {
                apagar: interaction.options.getBoolean("apagar"),
                notificar: interaction.options.getBoolean("notificar"),
                advertir: interaction.options.getBoolean("advertir"),
                mutar: interaction.options.getBoolean("mutar")
            };

            const mapaRegra = {
                spam: { enabledField: "spam_enabled", actionsField: "spam_actions" },
                emoji: { enabledField: "emoji_enabled", actionsField: "emoji_actions" },
                palavrao: { enabledField: "swear_enabled", actionsField: "swear_actions" },
                mencao: { enabledField: "mention_enabled", actionsField: "mention_actions" },
                convite: { enabledField: "invite_enabled", actionsField: "invite_actions" }
            };

            const { enabledField, actionsField } = mapaRegra[sub];

            const campos = {};

            if (ativado !== null) campos[enabledField] = ativado ? 1 : 0;

            const algumaAcaoInformada = Object.values(acoesBools).some(v => v !== null);

            if (algumaAcaoInformada) {

                campos[actionsField] = montarAcoes(config[actionsField], {
                    apagar: acoesBools.apagar ?? undefined,
                    notificar: acoesBools.notificar ?? undefined,
                    advertir: acoesBools.advertir ?? undefined,
                    mutar: acoesBools.mutar ?? undefined
                });

            }

            if (sub === "spam") {

                const maximo = interaction.options.getInteger("maximo");
                const intervalo = interaction.options.getInteger("intervalo");

                if (maximo !== null) campos.spam_max_messages = maximo;
                if (intervalo !== null) campos.spam_interval_seconds = intervalo;

            }

            if (sub === "emoji") {

                const maximo = interaction.options.getInteger("maximo");

                if (maximo !== null) campos.emoji_max_count = maximo;

            }

            if (sub === "mencao") {

                const maximo = interaction.options.getInteger("maximo");

                if (maximo !== null) campos.mention_max_count = maximo;

            }

            if (!Object.keys(campos).length) {

                return interaction.reply({
                    content: "⚠️ Informe pelo menos uma opção pra alterar.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const atualizado = await AutomodRepository.update(guild.id, campos);

            return interaction.reply({
                content:
                    `✅ Regra **${sub}** atualizada.\n` +
                    `Status: ${atualizado[enabledField] ? "🟢 Ativada" : "🔴 Desativada"}\n` +
                    `Ações: ${acoesParaTexto(atualizado[actionsField])}`,
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            PALAVRAS
        =========================
        */

        if (grupo === "palavras") {

            if (sub === "adicionar") {

                const palavra = interaction.options.getString("palavra").toLowerCase().trim();

                await AutomodRepository.adicionarNaLista(guild.id, "swear_custom_words", palavra);

                return interaction.reply({ content: `✅ Palavra adicionada à lista de bloqueio.`, flags: MessageFlags.Ephemeral });

            }

            if (sub === "remover") {

                const palavra = interaction.options.getString("palavra").toLowerCase().trim();

                await AutomodRepository.removerDaLista(guild.id, "swear_custom_words", palavra);

                return interaction.reply({ content: `✅ Palavra removida da lista de bloqueio.`, flags: MessageFlags.Ephemeral });

            }

            if (sub === "listar") {

                const config = await AutomodRepository.get(guild.id);
                const lista = AutomodRepository.parseLista(config.swear_custom_words);

                return interaction.reply({
                    content: lista.length
                        ? `📋 Palavras customizadas (${lista.length}): ||${lista.join(", ")}||`
                        : "📭 Nenhuma palavra customizada adicionada ainda. O filtro básico embutido continua ativo.",
                    flags: MessageFlags.Ephemeral
                });

            }

        }

        /*
        =========================
            RAID
        =========================
        */

        if (grupo === "raid") {

            if (sub === "configurar") {

                const ativado = interaction.options.getBoolean("ativado");
                const entradas = interaction.options.getInteger("entradas");
                const intervalo = interaction.options.getInteger("intervalo");
                const acao = interaction.options.getString("acao");

                const campos = {};

                if (ativado !== null) campos.raid_enabled = ativado ? 1 : 0;
                if (entradas !== null) campos.raid_join_threshold = entradas;
                if (intervalo !== null) campos.raid_interval_seconds = intervalo;
                if (acao !== null) campos.raid_action = acao;

                if (!Object.keys(campos).length) {

                    return interaction.reply({ content: "⚠️ Informe pelo menos uma opção pra alterar.", flags: MessageFlags.Ephemeral });

                }

                const atualizado = await AutomodRepository.update(guild.id, campos);

                return interaction.reply({
                    content:
                        `✅ Anti-raid atualizado.\n` +
                        `Status: ${atualizado.raid_enabled ? "🟢 Ativado" : "🔴 Desativado"}\n` +
                        `Gatilho: ${atualizado.raid_join_threshold} entradas em ${atualizado.raid_interval_seconds}s\n` +
                        `Ação: ${atualizado.raid_action}`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "desativar-lockdown") {

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const destravados = await AutomodManager.encerrarModoRaid(guild);

                return interaction.editReply({
                    content: `✅ Modo raid encerrado. ${destravados} canal(is) destravado(s).`
                });

            }

        }

        /*
        =========================
            IGNORAR
        =========================
        */

        if (grupo === "ignorar") {

            if (sub === "canal") {

                const canal = interaction.options.getChannel("canal");
                const config = await AutomodRepository.get(guild.id);
                const jaIgnorado = AutomodRepository.parseLista(config.ignored_channels).includes(canal.id);

                if (jaIgnorado) {

                    await AutomodRepository.removerDaLista(guild.id, "ignored_channels", canal.id);
                    return interaction.reply({ content: `✅ ${canal} removido das exceções — o AutoMod volta a agir nele.`, flags: MessageFlags.Ephemeral });

                }

                await AutomodRepository.adicionarNaLista(guild.id, "ignored_channels", canal.id);

                return interaction.reply({ content: `✅ ${canal} adicionado às exceções — o AutoMod nunca vai mexer lá.`, flags: MessageFlags.Ephemeral });

            }

            if (sub === "cargo") {

                const cargo = interaction.options.getRole("cargo");
                const config = await AutomodRepository.get(guild.id);
                const jaIgnorado = AutomodRepository.parseLista(config.ignored_roles).includes(cargo.id);

                if (jaIgnorado) {

                    await AutomodRepository.removerDaLista(guild.id, "ignored_roles", cargo.id);
                    return interaction.reply({ content: `✅ ${cargo} removido das exceções.`, flags: MessageFlags.Ephemeral });

                }

                await AutomodRepository.adicionarNaLista(guild.id, "ignored_roles", cargo.id);

                return interaction.reply({ content: `✅ Quem tem o cargo ${cargo} agora é ignorado pelo AutoMod.`, flags: MessageFlags.Ephemeral });

            }

        }

    }

};
