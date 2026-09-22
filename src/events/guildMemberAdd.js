const { Events, AttachmentBuilder } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const WelcomeRepository = require("../database/repositories/WelcomeRepository");
const WelcomeCardManager = require("../managers/WelcomeCardManager");
const AutomodManager = require("../managers/AutomodManager");

module.exports = {

    name: Events.GuildMemberAdd,

    async execute(member) {

        await LogManager.send({
            type: LogTypes.MEMBER_JOIN,
            guild: member.guild,
            target: member,
            extra: {
                memberCount: member.guild.memberCount
            }
        });

        // Anti-raid: registra a entrada e ativa lockdown/kick/ban se detectar um pico
        if (!member.user.bot) {

            await AutomodManager.registrarEntrada(member).catch(error => {

                console.error(`❌ Erro no anti-raid em "${member.guild.name}":`, error);

            });

        }

        // Auto-role de entrada
        if (!member.user.bot) {

            const roleIds = await AutoroleRepository.getJoinRoles(member.guild.id);

            for (const roleId of roleIds) {

                const role = member.guild.roles.cache.get(roleId);

                if (!role) continue;

                await member.roles.add(role).catch(() => null);

            }

        }

        // Cartão de boas-vindas
        if (!member.user.bot) {

            try {

                const config = await WelcomeRepository.get(member.guild.id);

                if (config.enabled && config.channel_id) {

                    const canal = await member.guild.channels.fetch(config.channel_id).catch(() => null);

                    if (canal) {

                        const buffer = await WelcomeCardManager.gerarCartao(member, config);
                        const anexo = new AttachmentBuilder(buffer, { name: "boas-vindas.png" });

                        const conteudo = WelcomeCardManager.aplicarVariaveis(config.message_content, { member });

                        await canal.send({ content: conteudo, files: [anexo] }).catch(() => {});

                    }

                }

            } catch (error) {

                console.error(`❌ Falha ao gerar cartão de boas-vindas em "${member.guild.name}":`, error);

            }

        }

    }

};
