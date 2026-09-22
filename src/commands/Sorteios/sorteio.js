const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    MessageFlags
} = require("discord.js");

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

                return interaction.reply({
                    content: `✅ Quem tiver o cargo ${cargo} agora vale **${valor}x** entradas nos sorteios.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "remover") {

                const cargo = interaction.options.getRole("cargo");

                await GiveawayRepository.removeMultiplier(guild.id, cargo.id);

                return interaction.reply({
                    content: `✅ Multiplicador do cargo ${cargo} removido.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            if (sub === "listar") {

                const lista = await GiveawayRepository.listMultipliers(guild.id);

                if (!lista.length) {

                    return interaction.reply({
                        content: "📭 Nenhum cargo com multiplicador configurado neste servidor.",
                        flags: MessageFlags.Ephemeral
                    });

                }

                const descricao = lista.map(m => `<@&${m.role_id}> — **${m.multiplier}x** entradas`).join("\n");

                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("🔢 Multiplicadores de entrada").setDescription(descricao)],
                    flags: MessageFlags.Ephemeral
                });

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

                return interaction.reply({
                    content: "⚠️ Duração inválida. Use algo como `10m`, `2h`, `1d` ou `1d12h` (mínimo de 10 segundos).",
                    flags: MessageFlags.Ephemeral
                });

            }

            const botMember = await guild.members.fetchMe();
            const permissoesCanal = canal.permissionsFor(botMember);

            if (!permissoesCanal || !permissoesCanal.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {

                return interaction.reply({
                    content: `⚠️ Não tenho permissão para enviar mensagens/embeds em ${canal}.`,
                    flags: MessageFlags.Ephemeral
                });

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

            return interaction.reply({
                content: `✅ Sorteio de **${premio}** criado em ${canal}! Termina em **${GiveawayManager.formatarDuracao(duracaoMs)}**. (ID: \`${giveawayId}\`)`,
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.reply({
                    content: "⚠️ Sorteio não encontrado neste servidor.",
                    flags: MessageFlags.Ephemeral
                });

            }

            if (giveaway.status !== "running") {

                return interaction.reply({
                    content: "⚠️ Só é possível editar um sorteio que ainda está em andamento.",
                    flags: MessageFlags.Ephemeral
                });

            }

            if (!novoPremio && !novaDuracaoTexto && !novosVencedores) {

                return interaction.reply({
                    content: "⚠️ Informe pelo menos um campo pra alterar (prêmio, duração ou vencedores).",
                    flags: MessageFlags.Ephemeral
                });

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

                    return interaction.reply({
                        content: "⚠️ Duração inválida. Use algo como `10m`, `2h`, `1d` ou `1d12h`.",
                        flags: MessageFlags.Ephemeral
                    });

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

            return interaction.reply({
                content: `✅ Sorteio \`${id}\` atualizado:\n${mudancas.join("\n")}`,
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.reply({
                    content: "⚠️ Sorteio não encontrado neste servidor.",
                    flags: MessageFlags.Ephemeral
                });

            }

            if (giveaway.status !== "running") {

                return interaction.reply({
                    content: "⚠️ Esse sorteio já não está mais em andamento.",
                    flags: MessageFlags.Ephemeral
                });

            }

            await GiveawayRepository.setStatus(id, "cancelled");

            try {

                const canal = await guild.channels.fetch(giveaway.channel_id);

                if (giveaway.message_id) {

                    const mensagem = await canal.messages.fetch(giveaway.message_id);

                    const embedCancelado = new EmbedBuilder()
                        .setColor("#ED4245")
                        .setTitle("🎉 SORTEIO CANCELADO 🎉")
                        .setDescription(`🎁 **Prêmio:** ${giveaway.prize}\n\nEste sorteio foi cancelado por um administrador.`)
                        .setFooter({ text: `ID do sorteio: ${giveaway.id}` });

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

            return interaction.reply({
                content: `✅ Sorteio \`${id}\` cancelado.`,
                flags: MessageFlags.Ephemeral
            });

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

                return interaction.reply({
                    content: "⚠️ Sorteio não encontrado neste servidor.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const resultado = await GiveawayManager.rerollSorteio(interaction.client, id, vencedores, interaction.user);

            if (!resultado.sucesso) {

                return interaction.reply({
                    content: `⚠️ ${resultado.motivo}`,
                    flags: MessageFlags.Ephemeral
                });

            }

            return interaction.reply({
                content: `✅ Novo(s) vencedor(es) sorteado(s): ${resultado.vencedores.map(uid => `<@${uid}>`).join(", ")}`,
                flags: MessageFlags.Ephemeral
            });

        }

        /*
        =========================
            LISTAR
        =========================
        */

        if (sub === "listar") {

            const sorteios = await GiveawayRepository.listRunningByGuild(guild.id);

            if (!sorteios.length) {

                return interaction.reply({
                    content: "📭 Nenhum sorteio em andamento neste servidor.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const descricao = sorteios.map(g => {

                const fimSegundos = Math.floor(g.ends_at / 1000);

                return `**ID \`${g.id}\`** — ${g.prize} em <#${g.channel_id}> • termina <t:${fimSegundos}:R>`;

            }).join("\n");

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle("🎉 Sorteios em andamento")
                .setDescription(descricao);

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        }

    }

};
