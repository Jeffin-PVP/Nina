const {
    EmbedBuilder
} = require("discord.js");

const LogTypes = require("../LogTypes");
const LogColors = require("../LogColors");
const LogIcons = require("../LogIcons");

class LogBuilder {

    static create(data) {

        const targetTag =
            data.target?.user?.tag ??
            data.target?.tag ??
            data.target?.username ??
            "Desconhecido";

        const executorTag =
            data.executor?.user?.tag ??
            data.executor?.tag ??
            data.executor?.username ??
            "Desconhecido";


        const embed = new EmbedBuilder()
            .setTimestamp();

        switch (data.type) {

            // ==========================
            // BAN
            // ==========================

            case LogTypes.BAN:

                embed
                    .setColor(LogColors.BAN)
                    .setTitle(`${LogIcons.BAN} Membro Banido`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "🛡️ Moderador",
                            value: `${executorTag}`
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason || "Nenhum."
                        }
                    );

                break;

            // ==========================
            // DESBANIMENTO
            // ==========================

            case LogTypes.UNBAN_MEMBER:

                embed
                    .setColor(LogColors.UNBAN)
                    .setTitle(`${LogIcons.UNBAN} Membro Desbanido`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason || "Nenhum."
                        }
                    );

                break;

            // ==========================
            // KICK
            // ==========================

            case LogTypes.KICK:

                embed
                    .setColor(LogColors.KICK)
                    .setTitle(`${LogIcons.KICK} Membro Expulso`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason || "Nenhum."
                        }
                    );

                break;

            // ==========================
            // WARN
            // ==========================

            case LogTypes.WARN:

                embed
                    .setColor(LogColors.WARN)
                    .setTitle(`${LogIcons.WARN} Advertência`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // TIMEOUT
            // ==========================

            case LogTypes.TIMEOUT:

                embed
                    .setColor(LogColors.TIMEOUT)
                    .setTitle(`${LogIcons.TIMEOUT} Timeout`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}`
                        },
                        {
                            name: "⏳ Duração",
                            value: data.duration
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // REMOVER TIMEOUT
            // ==========================

            case LogTypes.REMOVE_TIMEOUT:

                embed
                    .setColor(LogColors.REMOVE_TIMEOUT)
                    .setTitle(`${LogIcons.REMOVE_TIMEOUT} Timeout Removido`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // LIMPEZA
            // ==========================

            case LogTypes.PURGE_MESSAGES:

                embed
                    .setColor(LogColors.PURGE)
                    .setTitle(`${LogIcons.PURGE} Limpeza de Mensagens`)
                    .addFields(
                        {
                            name: "📺 Canal",
                            value: `${data.channel.name}`
                        },
                        {
                            name: "🧹 Mensagens",
                            value: `${data.amount}`
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        }
                    );

                break;

            // ==========================
            // LOCK
            // ==========================

            case LogTypes.LOCK_CHANNEL:

                embed
                    .setColor(LogColors.LOCK)
                    .setTitle(`${LogIcons.LOCK} Canal Bloqueado`)
                    .addFields(
                        {
                            name: "📺 Canal",
                            value: `${data.channel.name}`
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // UNLOCK
            // ==========================

            case LogTypes.UNLOCK_CHANNEL:

                embed
                    .setColor(LogColors.UNLOCK)
                    .setTitle(`${LogIcons.UNLOCK} Canal Desbloqueado`)
                    .addFields(
                        {
                            name: "📺 Canal",
                            value: `${data.channel.name}`
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // SLOWMODE
            // ==========================

            case LogTypes.SLOWMODE_CHANNEL:

                embed
                    .setColor(LogColors.SLOWMODE)
                    .setTitle(`${LogIcons.SLOWMODE} Slowmode Alterado`)
                    .addFields(
                        {
                            name: "📺 Canal",
                            value: `${data.channel.name}`
                        },
                        {
                            name: "⏱️ Novo tempo",
                            value: `${data.extra.seconds} segundos`
                        },
                        {
                            name: "🛡️ Moderador",
                            value: executorTag
                        },
                        {
                            name: "📝 Motivo",
                            value: data.reason
                        }
                    );

                break;

            // ==========================
            // ENTROU NO SERVIDOR
            // ==========================

            case LogTypes.MEMBER_JOIN:

                embed
                    .setColor(LogColors.MEMBER_JOIN)
                    .setTitle(`${LogIcons.MEMBER_JOIN} Membro Entrou`)
                    .setThumbnail(data.target.user?.displayAvatarURL?.() ?? null)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "📅 Conta criada em",
                            value: `<t:${Math.floor(data.target.user.createdTimestamp / 1000)}:R>`
                        },
                        {
                            name: "👥 Total de membros",
                            value: `${data.extra?.memberCount ?? "?"}`
                        }
                    );

                break;

            // ==========================
            // SAIU DO SERVIDOR
            // ==========================

            case LogTypes.MEMBER_LEAVE:

                embed
                    .setColor(LogColors.MEMBER_LEAVE)
                    .setTitle(`${LogIcons.MEMBER_LEAVE} Membro Saiu`)
                    .setThumbnail(data.target.user?.displayAvatarURL?.() ?? null)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: `${targetTag}\n\`${data.target.id}\``
                        },
                        {
                            name: "📥 Estava no servidor desde",
                            value: data.extra?.joinedTimestamp
                                ? `<t:${Math.floor(data.extra.joinedTimestamp / 1000)}:R>`
                                : "Desconhecido"
                        },
                        {
                            name: "🎭 Cargos",
                            value: data.extra?.roles?.length
                                ? data.extra.roles.join(", ")
                                : "Nenhum"
                        }
                    );

                break;

            // ==========================
            // BOOST
            // ==========================

            case LogTypes.MEMBER_BOOST:

                embed
                    .setColor(LogColors.MEMBER_BOOST)
                    .setTitle(`${LogIcons.MEMBER_BOOST} Novo Boost`)
                    .setDescription(`${targetTag} impulsionou o servidor! 🚀`);

                break;

            case LogTypes.MEMBER_UNBOOST:

                embed
                    .setColor(LogColors.MEMBER_UNBOOST)
                    .setTitle(`${LogIcons.MEMBER_UNBOOST} Boost Removido`)
                    .setDescription(`${targetTag} não está mais impulsionando o servidor.`);

                break;

            // ==========================
            // APELIDO
            // ==========================

            case LogTypes.MEMBER_NICKNAME:

                embed
                    .setColor(LogColors.MEMBER_NICKNAME)
                    .setTitle(`${LogIcons.MEMBER_NICKNAME} Apelido Alterado`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "⬅️ Antes",
                            value: data.extra?.before || "*Nenhum*"
                        },
                        {
                            name: "➡️ Depois",
                            value: data.extra?.after || "*Nenhum*"
                        }
                    );

                break;

            // ==========================
            // MENSAGEM APAGADA
            // ==========================

            case LogTypes.MESSAGE_DELETE:

                embed
                    .setColor(LogColors.MESSAGE_DELETE)
                    .setTitle(`${LogIcons.MESSAGE_DELETE} Mensagem Apagada`)
                    .addFields(
                        {
                            name: "👤 Autor",
                            value: targetTag
                        },
                        {
                            name: "📺 Canal",
                            value: `${data.channel}`
                        },
                        {
                            name: "📝 Conteúdo",
                            value: (data.extra?.content || "*Sem conteúdo (anexo, embed, etc.)*")
                                .slice(0, 1000)
                        }
                    );

                break;

            // ==========================
            // MENSAGEM EDITADA
            // ==========================

            case LogTypes.MESSAGE_EDIT:

                embed
                    .setColor(LogColors.MESSAGE_EDIT)
                    .setTitle(`${LogIcons.MESSAGE_EDIT} Mensagem Editada`)
                    .addFields(
                        {
                            name: "👤 Autor",
                            value: targetTag
                        },
                        {
                            name: "📺 Canal",
                            value: `${data.channel}`
                        },
                        {
                            name: "⬅️ Antes",
                            value: (data.extra?.before || "*Vazio*").slice(0, 500)
                        },
                        {
                            name: "➡️ Depois",
                            value: (data.extra?.after || "*Vazio*").slice(0, 500)
                        }
                    );

                if (data.extra?.url) {
                    embed.setURL(data.extra.url);
                }

                break;

            // ==========================
            // LIMPEZA EM MASSA (BULK DELETE)
            // ==========================

            case LogTypes.MESSAGE_BULK_DELETE:

                embed
                    .setColor(LogColors.MESSAGE_BULK_DELETE)
                    .setTitle(`${LogIcons.MESSAGE_BULK_DELETE} Mensagens Apagadas em Massa`)
                    .addFields(
                        {
                            name: "📺 Canal",
                            value: `${data.channel}`
                        },
                        {
                            name: "🧹 Quantidade",
                            value: `${data.extra?.amount ?? "?"}`
                        }
                    );

                break;

            // ==========================
            // CANAL CRIADO / APAGADO / ATUALIZADO
            // ==========================

            case LogTypes.CHANNEL_CREATE:

                embed
                    .setColor(LogColors.CHANNEL_CREATE)
                    .setTitle(`${LogIcons.CHANNEL_CREATE} Canal Criado`)
                    .addFields(
                        {
                            name: "📁 Canal",
                            value: `${data.channel?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "🛡️ Responsável",
                            value: executorTag
                        }
                    );

                break;

            case LogTypes.CHANNEL_DELETE:

                embed
                    .setColor(LogColors.CHANNEL_DELETE)
                    .setTitle(`${LogIcons.CHANNEL_DELETE} Canal Apagado`)
                    .addFields(
                        {
                            name: "📁 Canal",
                            value: `${data.channel?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "🛡️ Responsável",
                            value: executorTag
                        }
                    );

                break;

            case LogTypes.CHANNEL_UPDATE:

                embed
                    .setColor(LogColors.CHANNEL_UPDATE)
                    .setTitle(`${LogIcons.CHANNEL_UPDATE} Canal Atualizado`)
                    .addFields(
                        {
                            name: "📁 Canal",
                            value: `${data.channel?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "✏️ Alterações",
                            value: data.extra?.changes?.length
                                ? data.extra.changes.join("\n")
                                : "Não especificado"
                        },
                        {
                            name: "🛡️ Responsável",
                            value: executorTag
                        }
                    );

                break;

            // ==========================
            // CARGOS
            // ==========================

            case LogTypes.ROLE_CREATE:

                embed
                    .setColor(LogColors.ROLE_CREATE)
                    .setTitle(`${LogIcons.ROLE_CREATE} Cargo Criado`)
                    .addFields(
                        {
                            name: "🎭 Cargo",
                            value: `${data.extra?.role?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "🛡️ Responsável",
                            value: executorTag
                        }
                    );

                break;

            case LogTypes.ROLE_DELETE:

                embed
                    .setColor(LogColors.ROLE_DELETE)
                    .setTitle(`${LogIcons.ROLE_DELETE} Cargo Apagado`)
                    .addFields(
                        {
                            name: "🎭 Cargo",
                            value: `${data.extra?.role?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "🛡️ Responsável",
                            value: executorTag
                        }
                    );

                break;

            case LogTypes.ROLE_UPDATE:

                embed
                    .setColor(LogColors.ROLE_UPDATE)
                    .setTitle(`${LogIcons.ROLE_UPDATE} Cargo Atualizado`)
                    .addFields(
                        {
                            name: "🎭 Cargo",
                            value: `${data.extra?.role?.name ?? "Desconhecido"}`
                        },
                        {
                            name: "✏️ Alterações",
                            value: data.extra?.changes?.length
                                ? data.extra.changes.join("\n")
                                : "Não especificado"
                        }
                    );

                break;

            case LogTypes.ROLE_ADD:

                embed
                    .setColor(LogColors.ROLE_ADD)
                    .setTitle(`${LogIcons.ROLE_ADD} Cargo Adicionado`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🎭 Cargo",
                            value: `${data.extra?.role?.name ?? "Desconhecido"}`
                        }
                    );

                break;

            case LogTypes.ROLE_REMOVE:

                embed
                    .setColor(LogColors.ROLE_REMOVE)
                    .setTitle(`${LogIcons.ROLE_REMOVE} Cargo Removido`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🎭 Cargo",
                            value: `${data.extra?.role?.name ?? "Desconhecido"}`
                        }
                    );

                break;

            // ==========================
            // VOZ
            // ==========================

            case LogTypes.VOICE_JOIN:

                embed
                    .setColor(LogColors.VOICE_JOIN)
                    .setTitle(`${LogIcons.VOICE_JOIN} Entrou em Canal de Voz`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🎙️ Canal",
                            value: `${data.extra?.channel ?? "Desconhecido"}`
                        }
                    );

                break;

            case LogTypes.VOICE_LEAVE:

                embed
                    .setColor(LogColors.VOICE_LEAVE)
                    .setTitle(`${LogIcons.VOICE_LEAVE} Saiu de Canal de Voz`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🎙️ Canal",
                            value: `${data.extra?.channel ?? "Desconhecido"}`
                        }
                    );

                break;

            case LogTypes.VOICE_MOVE:

                embed
                    .setColor(LogColors.VOICE_MOVE)
                    .setTitle(`${LogIcons.VOICE_MOVE} Mudou de Canal de Voz`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "⬅️ De",
                            value: `${data.extra?.from ?? "Desconhecido"}`
                        },
                        {
                            name: "➡️ Para",
                            value: `${data.extra?.to ?? "Desconhecido"}`
                        }
                    );

                break;

            // ==========================
            // TICKETS
            // ==========================

            case LogTypes.TICKET_CREATE:

                embed
                    .setColor(LogColors.TICKET_CREATE)
                    .setTitle(`${LogIcons.TICKET_CREATE} Ticket Aberto`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🎫 Ticket",
                            value: `#${data.extra?.number ?? "?"} — ${data.channel ?? "Desconhecido"}`
                        }
                    );

                break;

            case LogTypes.TICKET_CLOSE:

                embed
                    .setColor(LogColors.TICKET_CLOSE)
                    .setTitle(`${LogIcons.TICKET_CLOSE} Ticket Fechado`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🛡️ Fechado por",
                            value: executorTag
                        },
                        {
                            name: "🎫 Ticket",
                            value: `#${data.extra?.number ?? "?"}`
                        }
                    );

                break;

            case LogTypes.TICKET_REOPEN:

                embed
                    .setColor(LogColors.TICKET_REOPEN)
                    .setTitle(`${LogIcons.TICKET_REOPEN} Ticket Reaberto`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🛡️ Reaberto por",
                            value: executorTag
                        },
                        {
                            name: "🎫 Ticket",
                            value: `#${data.extra?.number ?? "?"}`
                        }
                    );

                break;

            case LogTypes.TICKET_DELETE:

                embed
                    .setColor(LogColors.TICKET_DELETE)
                    .setTitle(`${LogIcons.TICKET_DELETE} Ticket Deletado`)
                    .addFields(
                        {
                            name: "👤 Usuário",
                            value: targetTag
                        },
                        {
                            name: "🛡️ Deletado por",
                            value: executorTag
                        },
                        {
                            name: "🎫 Ticket",
                            value: `#${data.extra?.number ?? "?"}`
                        }
                    );

                break;

            // ==========================
            // SORTEIOS
            // ==========================

            case LogTypes.GIVEAWAY_CREATE:

                embed
                    .setColor(LogColors.GIVEAWAY)
                    .setTitle(`${LogIcons.GIVEAWAY} Sorteio Criado`)
                    .addFields(
                        { name: "🎁 Prêmio", value: data.extra?.prize || "—" },
                        { name: "🏆 Vencedores", value: String(data.extra?.winners ?? "—"), inline: true },
                        { name: "📍 Canal", value: data.extra?.channelId ? `<#${data.extra.channelId}>` : "—", inline: true },
                        { name: "🛡️ Criado por", value: executorTag }
                    );

                break;

            case LogTypes.GIVEAWAY_END:

                embed
                    .setColor(LogColors.GIVEAWAY)
                    .setTitle(`${LogIcons.GIVEAWAY} Sorteio Encerrado`)
                    .addFields(
                        { name: "🎁 Prêmio", value: data.extra?.prize || "—" },
                        {
                            name: "🏆 Vencedor(es)",
                            value: data.extra?.winners?.length
                                ? data.extra.winners.map(id => `<@${id}>`).join(", ")
                                : "Ninguém participou"
                        },
                        { name: "👥 Participantes", value: String(data.extra?.participants ?? 0), inline: true }
                    );

                break;

            case LogTypes.GIVEAWAY_CANCEL:

                embed
                    .setColor(LogColors.GIVEAWAY_CANCEL)
                    .setTitle(`${LogIcons.GIVEAWAY} Sorteio Cancelado`)
                    .addFields(
                        { name: "🎁 Prêmio", value: data.extra?.prize || "—" },
                        { name: "🛡️ Cancelado por", value: executorTag }
                    );

                break;

            case LogTypes.GIVEAWAY_REROLL:

                embed
                    .setColor(LogColors.GIVEAWAY)
                    .setTitle(`${LogIcons.GIVEAWAY} Reroll de Sorteio`)
                    .addFields(
                        { name: "🎁 Prêmio", value: data.extra?.prize || "—" },
                        {
                            name: "🏆 Novo(s) vencedor(es)",
                            value: data.extra?.winners?.length
                                ? data.extra.winners.map(id => `<@${id}>`).join(", ")
                                : "—"
                        },
                        { name: "🛡️ Solicitado por", value: executorTag }
                    );

                break;

            case LogTypes.GIVEAWAY_EDIT:

                embed
                    .setColor(LogColors.GIVEAWAY)
                    .setTitle(`${LogIcons.GIVEAWAY} Sorteio Editado`)
                    .addFields(
                        { name: "🎁 Prêmio", value: data.extra?.prize || "—" },
                        { name: "✏️ Alterações", value: data.extra?.mudancas || "—" },
                        { name: "🛡️ Editado por", value: executorTag }
                    );

                break;

            // ==========================
            // AUTOMOD
            // ==========================

            case LogTypes.AUTOMOD_ACTION:

                embed
                    .setColor(LogColors.AUTOMOD)
                    .setTitle(`${LogIcons.AUTOMOD} AutoMod`)
                    .addFields(
                        { name: "👤 Usuário", value: targetTag, inline: true },
                        { name: "📍 Canal", value: data.extra?.channelId ? `<#${data.extra.channelId}>` : "—", inline: true },
                        { name: "📋 Motivo", value: data.reason || "—" },
                        { name: "⚙️ Ações", value: data.extra?.actions || "—" }
                    );

                break;

            case LogTypes.RAID_DETECTED:

                embed
                    .setColor(LogColors.RAID)
                    .setTitle(`${LogIcons.RAID} Possível raid detectado`)
                    .addFields(
                        { name: "👥 Entradas na janela", value: String(data.extra?.joins ?? "—"), inline: true },
                        { name: "⏱️ Janela", value: `${data.extra?.windowSeconds ?? "—"}s`, inline: true },
                        { name: "🛡️ Ação tomada", value: data.extra?.action || "—" }
                    );

                break;

            case LogTypes.RAID_LOCKDOWN_LIFT:

                embed
                    .setColor(LogColors.AUTOMOD)
                    .setTitle(`${LogIcons.RAID} Lockdown de anti-raid encerrado`)
                    .addFields(
                        { name: "🔓 Canais destravados", value: String(data.extra?.channelsUnlocked ?? 0) }
                    );

                break;

            // ==========================
            // FALLBACK GENÉRICO
            //
            // Garante que nenhum log seja perdido
            // silenciosamente caso um tipo ainda não
            // tenha um builder específico.
            // ==========================

            default: {

                const icon = LogIcons[data.type] ?? "📋";
                const color = LogColors[data.type] ?? "#8E8E93";

                embed
                    .setColor(color)
                    .setTitle(`${icon} ${data.type}`);

                if (data.target) {
                    embed.addFields({
                        name: "👤 Alvo",
                        value: targetTag
                    });
                }

                if (data.executor) {
                    embed.addFields({
                        name: "🛡️ Responsável",
                        value: executorTag
                    });
                }

                if (data.reason) {
                    embed.addFields({
                        name: "📝 Motivo",
                        value: String(data.reason)
                    });
                }

                if (data.extra) {
                    embed.addFields({
                        name: "ℹ️ Detalhes",
                        value: `\`\`\`json\n${JSON.stringify(data.extra, null, 2).slice(0, 900)}\n\`\`\``
                    });
                }

            }

        }

        return embed;

    }

}

module.exports = LogBuilder;