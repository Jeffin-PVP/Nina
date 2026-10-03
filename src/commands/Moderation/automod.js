const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require("discord.js");

const ui = require("../../utils/ui");

const AutomodRepository = require("../../database/repositories/AutomodRepository");
const AutomodManager = require("../../managers/AutomodManager");

const NOMES_REGRA = { spam: "Spam de mensagens", emoji: "Spam de emojis", palavrao: "Palavrão", mencao: "Spam de menções", convite: "Links de convite" };
const NOMES_RAID = { lockdown: "Lockdown", kick_new: "Expulsar recém-chegados", ban_new: "Banir recém-chegados" };

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

        .addSubcommand(sub =>
            sub
                .setName("imagem")
                .setDescription("Configura a detecção de possíveis golpes em imagens.")
                .addBooleanOption(o => o.setName("ativado").setDescription("Ativar a proteção visual Anti-Scam?").setRequired(false))
                .addStringOption(o => o.setName("acao").setDescription("Ação para uma imagem suspeita.").setRequired(false).addChoices(
                    { name: "Ignorar", value: "ignore" },
                    { name: "Apagar imagem", value: "delete" },
                    { name: "Advertir + apagar", value: "warn" },
                    { name: "Expulsar + apagar", value: "kick" },
                    { name: "Banir + apagar", value: "ban" }
                ))
                .addIntegerOption(o => o.setName("sensibilidade").setDescription("Confiança mínima da IA em porcentagem (50-99).").setMinValue(50).setMaxValue(99).setRequired(false))
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

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "shield",
                title: "AutoMod ativado",
                description: "A moderação automática já está de olho no servidor.\nUse `/automod status` para ver o que está configurado.",
                source: interaction
            }), { ephemeral: true });

        }

        if (!grupo && sub === "desativar") {

            await AutomodRepository.update(guild.id, { enabled: false });

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "shield",
                title: "AutoMod desativado",
                description: "Nenhuma regra automática será aplicada até você reativar com `/automod ativar`.",
                source: interaction
            }), { ephemeral: true });

        }

        if (!grupo && sub === "imagem") {

            const ativado = interaction.options.getBoolean("ativado");
            const acao = interaction.options.getString("acao");
            const sensibilidade = interaction.options.getInteger("sensibilidade");
            const campos = {};

            if (ativado !== null) campos.image_enabled = ativado ? 1 : 0;
            if (acao !== null) campos.image_action = acao;
            if (sensibilidade !== null) campos.image_threshold = sensibilidade / 100;

            const nomesAcao = { ignore: "Ignorar", delete: "Apagar imagem", warn: "Advertir + apagar", kick: "Expulsar + apagar", ban: "Banir + apagar" };

            const painelImagem = (c, atualizado) => ui.panel({
                color: atualizado ? ui.COLORS.success : ui.COLORS.info,
                emoji: "image",
                title: atualizado ? "Anti-Scam visual atualizado" : "Anti-Scam visual",
                fields: [
                    ui.field("config", "Status", ui.toggle(c.image_enabled)),
                    ui.field("shield", "Ação", nomesAcao[c.image_action] || c.image_action),
                    ui.field("sparkle", "Sensibilidade", `${(Number(c.image_threshold || 0.85) * 100).toFixed(0)}%`)
                ],
                source: interaction
            });

            if (!Object.keys(campos).length) {
                const c = await AutomodRepository.get(guild.id);
                return ui.respond(interaction, painelImagem(c, false), { ephemeral: true });
            }

            const c = await AutomodRepository.update(guild.id, campos);
            return ui.respond(interaction, painelImagem(c, true), { ephemeral: true });
        }

        if (!grupo && sub === "mute-duracao") {

            const minutos = interaction.options.getInteger("minutos");

            await AutomodRepository.update(guild.id, { mute_duration_minutes: minutos });

            return ui.ok(interaction, `A ação "mutar" agora aplica timeout de **${minutos} minuto(s)**.`, "Duração do mute atualizada");

        }

        if (!grupo && sub === "status") {

            const c = await AutomodRepository.get(guild.id);

            const regra = (emoji, nome, ativo, detalhe) =>
                ui.field(emoji, nome, ativo ? `🟢 ${detalhe}` : "🔴 Desativado", false);

            const embed = ui.panel({
                color: c.enabled ? ui.COLORS.success : ui.COLORS.neutral,
                emoji: "shield",
                title: "Configuração do AutoMod",
                description: `${ui.toggle(c.enabled, "**Ativado**", "**Desativado**")}\n${ui.LINE}`,
                fields: [
                    regra("mail", NOMES_REGRA.spam, c.spam_enabled,
                        `máx. ${c.spam_max_messages} msgs / ${c.spam_interval_seconds}s\nAções: ${acoesParaTexto(c.spam_actions)}`),
                    regra("sparkle", NOMES_REGRA.emoji, c.emoji_enabled,
                        `máx. ${c.emoji_max_count} por mensagem\nAções: ${acoesParaTexto(c.emoji_actions)}`),
                    regra("warn", NOMES_REGRA.palavrao, c.swear_enabled,
                        `${AutomodRepository.parseLista(c.swear_custom_words).length} palavra(s) customizada(s)\nAções: ${acoesParaTexto(c.swear_actions)}`),
                    regra("user", NOMES_REGRA.mencao, c.mention_enabled,
                        `máx. ${c.mention_max_count} por mensagem\nAções: ${acoesParaTexto(c.mention_actions)}`),
                    regra("channel", NOMES_REGRA.convite, c.invite_enabled,
                        `Ações: ${acoesParaTexto(c.invite_actions)}`),
                    regra("ban", "Anti-raid", c.raid_enabled,
                        `${c.raid_join_threshold} entradas / ${c.raid_interval_seconds}s → ${NOMES_RAID[c.raid_action] || c.raid_action}`),
                    regra("image", "Anti-Scam visual", c.image_enabled,
                        `${(Number(c.image_threshold || 0.85) * 100).toFixed(0)}% → ${c.image_action}`),
                    ui.field("timeout", "Duração do mute", `${c.mute_duration_minutes} minuto(s)`),
                    ui.field("channel", "Canais ignorados", String(AutomodRepository.parseLista(c.ignored_channels).length)),
                    ui.field("role", "Cargos ignorados", String(AutomodRepository.parseLista(c.ignored_roles).length))
                ],
                source: interaction
            });

            return ui.respond(interaction, embed, { ephemeral: true });

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

                return ui.caution(interaction, "Informe pelo menos uma opção para alterar.", "Nada para alterar");

            }

            const atualizado = await AutomodRepository.update(guild.id, campos);

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "shield",
                title: `Regra atualizada: ${NOMES_REGRA[sub] || sub}`,
                fields: [
                    ui.field("config", "Status", ui.toggle(atualizado[enabledField], "Ativada", "Desativada")),
                    ui.field("shield", "Ações", acoesParaTexto(atualizado[actionsField]))
                ],
                source: interaction
            }), { ephemeral: true });

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

                return ui.ok(interaction, "A palavra foi adicionada à lista de bloqueio.", "Palavra bloqueada");

            }

            if (sub === "remover") {

                const palavra = interaction.options.getString("palavra").toLowerCase().trim();

                await AutomodRepository.removerDaLista(guild.id, "swear_custom_words", palavra);

                return ui.ok(interaction, "A palavra foi removida da lista de bloqueio.", "Palavra liberada");

            }

            if (sub === "listar") {

                const config = await AutomodRepository.get(guild.id);
                const lista = AutomodRepository.parseLista(config.swear_custom_words);

                if (!lista.length) {

                    return ui.nothing(interaction, "Nenhuma palavra customizada adicionada ainda.\nO filtro básico embutido continua ativo.", "Lista vazia");

                }

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.info,
                    emoji: "warn",
                    title: `Palavras bloqueadas (${lista.length})`,
                    description: ui.clip(`||${lista.join(", ")}||`, 4000),
                    footer: "A lista fica escondida: clique para revelar",
                    source: interaction
                }), { ephemeral: true });

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

                    return ui.caution(interaction, "Informe pelo menos uma opção para alterar.", "Nada para alterar");

                }

                const atualizado = await AutomodRepository.update(guild.id, campos);

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.success,
                    emoji: "ban",
                    title: "Anti-raid atualizado",
                    fields: [
                        ui.field("config", "Status", ui.toggle(atualizado.raid_enabled)),
                        ui.field("clock", "Gatilho", `${atualizado.raid_join_threshold} entradas em ${atualizado.raid_interval_seconds}s`),
                        ui.field("shield", "Ação", NOMES_RAID[atualizado.raid_action] || atualizado.raid_action)
                    ],
                    source: interaction
                }), { ephemeral: true });

            }

            if (sub === "desativar-lockdown") {

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const destravados = await AutomodManager.encerrarModoRaid(guild);

                return ui.respond(interaction, ui.success(`${destravados} canal(is) destravado(s).`, "Modo raid encerrado", interaction));

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
                    return ui.ok(interaction, `${canal} saiu das exceções: o AutoMod volta a agir nele.`, "Exceção removida");

                }

                await AutomodRepository.adicionarNaLista(guild.id, "ignored_channels", canal.id);

                return ui.ok(interaction, `${canal} entrou nas exceções: o AutoMod nunca vai mexer lá.`, "Canal ignorado");

            }

            if (sub === "cargo") {

                const cargo = interaction.options.getRole("cargo");
                const config = await AutomodRepository.get(guild.id);
                const jaIgnorado = AutomodRepository.parseLista(config.ignored_roles).includes(cargo.id);

                if (jaIgnorado) {

                    await AutomodRepository.removerDaLista(guild.id, "ignored_roles", cargo.id);
                    return ui.ok(interaction, `${cargo} saiu das exceções.`, "Exceção removida");

                }

                await AutomodRepository.adicionarNaLista(guild.id, "ignored_roles", cargo.id);

                return ui.ok(interaction, `Quem tem o cargo ${cargo} agora é ignorado pelo AutoMod.`, "Cargo ignorado");

            }

        }

    }

};
