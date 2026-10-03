const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const GiveawayRepository = require("../../database/repositories/GiveawayRepository");
const GiveawayManager = require("../../managers/GiveawayManager");
const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("sorteio")

        .setDescription("Sistema de sorteios do servidor.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>

            sub
                .setName("criar")
                .setDescription("Cria um novo sorteio.")
                .addStringOption(o => o.setName("premio").setDescription("O que vai ser sorteado.").setRequired(true))
                .addStringOption(o => o.setName("duracao").setDescription("Duração (ex: 10m, 2h, 1d, 1d12h).").setRequired(true))
                .addIntegerOption(o => o.setName("vencedores").setDescription("Quantidade de vencedores (padrão: 1).").setMinValue(1).setMaxValue(20).setRequired(false))
                .addChannelOption(o => o.setName("canal").setDescription("Canal onde o sorteio será postado (padrão: canal atual).").addChannelTypes(ChannelType.GuildText).setRequired(false))
                .addRoleOption(o => o.setName("cargo").setDescription("Cargo necessário para participar (opcional).").setRequired(false))

        )

        .addSubcommand(sub =>

            sub
                .setName("editar")
                .setDescription("Edita um sorteio em andamento (só os campos informados são alterados).")
                .addIntegerOption(o => o.setName("id").setDescription("ID do sorteio (veja em /sorteio listar).").setRequired(true))
                .addStringOption(o => o.setName("premio").setDescription("Novo prêmio.").setRequired(false))
                .addStringOption(o => o.setName("duracao").setDescription("Nova duração a partir de AGORA (ex: 1h, 2d).").setRequired(false))
                .addIntegerOption(o => o.setName("vencedores").setDescription("Nova quantidade de vencedores.").setMinValue(1).setMaxValue(20).setRequired(false))

        )

        .addSubcommand(sub =>

            sub
                .setName("cancelar")
                .setDescription("Cancela um sorteio em andamento.")
                .addIntegerOption(o => o.setName("id").setDescription("ID do sorteio (veja em /sorteio listar).").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("reroll")
                .setDescription("Sorteia novo(s) vencedor(es) de um sorteio já encerrado.")
                .addIntegerOption(o => o.setName("id").setDescription("ID do sorteio (veja em /sorteio listar).").setRequired(true))
                .addIntegerOption(o => o.setName("vencedores").setDescription("Quantidade de novos vencedores (padrão: o mesmo do sorteio).").setMinValue(1).setMaxValue(20).setRequired(false))

        )

        .addSubcommand(sub =>

            sub
                .setName("listar")
                .setDescription("Lista os sorteios em andamento neste servidor.")

        )

        .addSubcommandGroup(group =>

            group
                .setName("multiplicador")
                .setDescription("Cargos que valem entradas extras nos sorteios (ex: booster vale 2x).")

                .addSubcommand(sub =>
                    sub
                        .setName("adicionar")
                        .setDescription("Define quantas entradas um cargo vale.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo que vai valer entradas extras.").setRequired(true))
                        .addIntegerOption(o => o.setName("valor").setDescription("Quantas entradas esse cargo vale (ex: 2).").setMinValue(2).setMaxValue(10).setRequired(true))
                )

                .addSubcommand(sub =>
                    sub
                        .setName("remover")
                        .setDescription("Remove o multiplicador de um cargo.")
                        .addRoleOption(o => o.setName("cargo").setDescription("Cargo a remover.").setRequired(true))
                )

                .addSubcommand(sub =>
                    sub
                        .setName("listar")
                        .setDescription("Lista os multiplicadores configurados neste servidor.")
                )

        ),

    async execute(interaction) {

        const grupo = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        const { guild } = interaction;

        /*
        =========================
            MULTIPLICADOR
        =========================
        */

        if (grupo === "multiplicador") {

            if (sub === "adicionar") {

                const cargo = interaction.options.getRole("cargo");
                const valor = interaction.options.getInteger("valor");

                await GiveawayRepository.addMultiplier(guild.id, cargo.id, valor);

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.success,
                    emoji: "gift",
                    title: "Multiplicador adicionado",
                    description: `Quem tiver o cargo ${cargo} agora vale **${valor}x** entradas nos sorteios.`,
                    source: interaction
                }), { ephemeral: true });

            }

            if (sub === "remover") {

                const cargo = interaction.options.getRole("cargo");

                await GiveawayRepository.removeMultiplier(guild.id, cargo.id);

                return ui.ok(interaction, `O multiplicador do cargo ${cargo} foi removido.`, "Multiplicador removido");

            }

            if (sub === "listar") {

                const lista = await GiveawayRepository.listMultipliers(guild.id);

                if (!lista.length) {

                    return ui.nothing(interaction, "Nenhum cargo com multiplicador configurado neste servidor.\nUse `/sorteio multiplicador adicionar` para criar um.", "Sem multiplicadores");

                }

                const descricao = lista.map(m => `<@&${m.role_id}> — **${m.multiplier}x** entradas`).join("\n");

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.info,
                    emoji: "gift",
                    title: `Multiplicadores de entrada (${lista.length})`,
                    description: ui.clip(descricao, 4000),
                    source: interaction
                }), { ephemeral: true });

            }

        }

        /*
        =========================
            CRIAR
        =========================
        */

        if (sub === "criar") {

            const premio = interaction.options.getString("premio");
            const duracaoTexto = interaction.options.getString("duracao");
            const vencedores = interaction.options.getInteger("vencedores") || 1;
            const canal = interaction.options.getChannel("canal") || interaction.channel;
            const cargo = interaction.options.getRole("cargo");

            const duracaoMs = GiveawayManager.parseDuracao(duracaoTexto);

            if (!duracaoMs || duracaoMs < 10 * 1000) {

                return ui.caution(interaction, "Use algo como `10m`, `2h`, `1d` ou `1d12h` (mínimo de 10 segundos).", "Duração inválida");

            }

            const botMember = await guild.members.fetchMe();
            const permissoesCanal = canal.permissionsFor(botMember);

            if (!permissoesCanal || !permissoesCanal.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {

                return ui.caution(interaction, `Preciso de **Ver canal**, **Enviar mensagens** e **Inserir links** em ${canal}.`, "Sem permissão no canal");

            }

            const endsAt = Date.now() + duracaoMs;

            const giveawayId = await GiveawayRepository.create({
                guildId: guild.id,
                channelId: canal.id,
                hostId: interaction.user.id,
                prize: premio,
                winnersCount: vencedores,
                requiredRoleId: cargo?.id || null,
                endsAt
            });

            const giveaway = await GiveawayRepository.get(giveawayId);

            const embed = GiveawayManager.buildEmbedAtivo(giveaway, 0);
            const row = GiveawayManager.buildBotaoParticipar(giveawayId);

            const mensagem = await canal.send({
                content: "🎉 **SORTEIO** 🎉",
                embeds: [embed],
                components: [row]
            });

            await GiveawayRepository.setMessageId(giveawayId, mensagem.id);

            await LogManager.send({
                type: LogTypes.GIVEAWAY_CREATE,
                guild,
                executor: interaction.user,
                extra: { prize: premio, winners: vencedores, channelId: canal.id }
            }).catch(() => {});

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "gift",
                title: "Sorteio criado!",
                description: `O sorteio já está no ar em ${canal}.`,
                fields: [
                    ui.field("gift", "Prêmio", premio),
                    ui.field("trophy", "Vencedores", ui.num(vencedores)),
                    ui.field("clock", "Termina", ui.ts(endsAt)),
                    ui.field("id", "ID", ui.code(giveawayId))
                ],
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            EDITAR
        =========================
        */

        if (sub === "editar") {

            const id = interaction.options.getInteger("id");
            const novoPremio = interaction.options.getString("premio");
            const novaDuracaoTexto = interaction.options.getString("duracao");
            const novosVencedores = interaction.options.getInteger("vencedores");

            const giveaway = await GiveawayRepository.get(id);

            if (!giveaway || giveaway.guild_id !== guild.id) {

                return ui.caution(interaction, "Não encontrei esse sorteio neste servidor. Veja os IDs com `/sorteio listar`.", "Sorteio não encontrado");

            }

            if (giveaway.status !== "running") {

                return ui.caution(interaction, "Só é possível editar um sorteio que ainda está em andamento.", "Sorteio encerrado");

            }

            if (!novoPremio && !novaDuracaoTexto && !novosVencedores) {

                return ui.caution(interaction, "Informe pelo menos um campo para alterar: prêmio, duração ou vencedores.", "Nada para editar");

            }

            const mudancas = [];
            const camposAtualizados = {};

            if (novoPremio) {
                camposAtualizados.prize = novoPremio;
                mudancas.push(`Prêmio: **${giveaway.prize}** → **${novoPremio}**`);
            }

            if (novosVencedores) {
                camposAtualizados.winnersCount = novosVencedores;
                mudancas.push(`Vencedores: **${giveaway.winners_count}** → **${novosVencedores}**`);
            }

            if (novaDuracaoTexto) {

                const duracaoMs = GiveawayManager.parseDuracao(novaDuracaoTexto);

                if (!duracaoMs || duracaoMs < 10 * 1000) {

                    return ui.caution(interaction, "Use algo como `10m`, `2h`, `1d` ou `1d12h`.", "Duração inválida");

                }

                camposAtualizados.endsAt = Date.now() + duracaoMs;
                mudancas.push(`Termina agora em: **${GiveawayManager.formatarDuracao(duracaoMs)}**`);

            }

            await GiveawayRepository.update(id, camposAtualizados);

            const giveawayAtualizado = await GiveawayRepository.get(id);

            try {

                const canal = await guild.channels.fetch(giveawayAtualizado.channel_id);

                if (giveawayAtualizado.message_id) {

                    const mensagem = await canal.messages.fetch(giveawayAtualizado.message_id);
                    const totalParticipantes = await GiveawayRepository.countEntries(id);

                    await mensagem.edit({
                        embeds: [GiveawayManager.buildEmbedAtivo(giveawayAtualizado, totalParticipantes)]
                    });

                }

            } catch {
                // canal/mensagem pode não existir mais, tudo bem
            }

            await LogManager.send({
                type: LogTypes.GIVEAWAY_EDIT,
                guild,
                executor: interaction.user,
                extra: { prize: giveawayAtualizado.prize, mudancas: mudancas.join("\n") }
            }).catch(() => {});

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "gift",
                title: `Sorteio ${id} atualizado`,
                description: ui.bullets(mudancas),
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            CANCELAR
        =========================
        */

        if (sub === "cancelar") {

            const id = interaction.options.getInteger("id");
            const giveaway = await GiveawayRepository.get(id);

            if (!giveaway || giveaway.guild_id !== guild.id) {

                return ui.caution(interaction, "Não encontrei esse sorteio neste servidor. Veja os IDs com `/sorteio listar`.", "Sorteio não encontrado");

            }

            if (giveaway.status !== "running") {

                return ui.caution(interaction, "Esse sorteio já não está mais em andamento.", "Sorteio encerrado");

            }

            await GiveawayRepository.setStatus(id, "cancelled");

            try {

                const canal = await guild.channels.fetch(giveaway.channel_id);

                if (giveaway.message_id) {

                    const mensagem = await canal.messages.fetch(giveaway.message_id);

                    const embedCancelado = ui.panel({
                        color: ui.COLORS.error,
                        emoji: "gift",
                        title: "Sorteio cancelado",
                        description: `${e("gift")} **Prêmio:** ${giveaway.prize}\n\nEste sorteio foi cancelado por um administrador.`,
                        footer: `ID do sorteio: ${giveaway.id}`,
                        source: interaction
                    });

                    await mensagem.edit({
                        embeds: [embedCancelado],
                        components: [GiveawayManager.buildBotaoParticipar(giveaway.id, true)]
                    });

                }

            } catch {
                // canal/mensagem pode não existir mais, tudo bem
            }

            await LogManager.send({
                type: LogTypes.GIVEAWAY_CANCEL,
                guild,
                executor: interaction.user,
                extra: { prize: giveaway.prize }
            }).catch(() => {});

            return ui.ok(interaction, `O sorteio ${ui.code(id)} (**${giveaway.prize}**) foi cancelado.`, "Sorteio cancelado");

        }

        /*
        =========================
            REROLL
        =========================
        */

        if (sub === "reroll") {

            const id = interaction.options.getInteger("id");
            const vencedores = interaction.options.getInteger("vencedores");

            const giveaway = await GiveawayRepository.get(id);

            if (!giveaway || giveaway.guild_id !== guild.id) {

                return ui.caution(interaction, "Não encontrei esse sorteio neste servidor. Veja os IDs com `/sorteio listar`.", "Sorteio não encontrado");

            }

            const resultado = await GiveawayManager.rerollSorteio(interaction.client, id, vencedores, interaction.user);

            if (!resultado.sucesso) {

                return ui.caution(interaction, resultado.motivo, "Não foi possível sortear");

            }

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "trophy",
                title: "Novo sorteio realizado",
                description: `${e("trophy")} ${resultado.vencedores.map(uid => `<@${uid}>`).join(", ")}`,
                source: interaction
            }), { ephemeral: true });

        }

        /*
        =========================
            LISTAR
        =========================
        */

        if (sub === "listar") {

            const sorteios = await GiveawayRepository.listRunningByGuild(guild.id);

            if (!sorteios.length) {

                return ui.nothing(interaction, "Nenhum sorteio em andamento neste servidor.\nCrie um com `/sorteio criar`.", "Sem sorteios");

            }

            const descricao = sorteios.map(g => {

                const fimSegundos = Math.floor(g.ends_at / 1000);

                return `${e("gift")} **${g.prize}**\n┗ ID ${ui.code(g.id)} • <#${g.channel_id}> • termina <t:${fimSegundos}:R>`;

            }).join("\n");

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.info,
                emoji: "gift",
                title: `Sorteios em andamento (${sorteios.length})`,
                description: ui.clip(descricao, 4000),
                source: interaction
            }), { ephemeral: true });

        }

    }

};
