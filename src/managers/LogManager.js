const GuildRepository = require("../database/repositories/GuildRepository");
const { CATEGORY_OF } = require("./LogCategories");

const Builders = require("./logs");

class LogManager {

    static async send(data) {

        try {

            if (!data.guild) {

                console.error(
                    "[LogManager] Guild não informado."
                );

                return false;

            }

            // Busca o canal de logs

            const logChannelId =
                await GuildRepository.getLogChannel(
                    data.guild.id
                );

            if (!logChannelId) {

                console.log(
                    "[LogManager] Canal de logs não configurado."
                );

                return false;

            }

            // Verifica se a categoria deste tipo de log está ativada

            const category = CATEGORY_OF[data.type];

            if (category) {

                const enabled =
                    await GuildRepository.isCategoryEnabled(
                        data.guild.id,
                        category
                    );

                if (!enabled) {
                    return false;
                }

            }

            // Busca o canal

            const channel =
                await data.guild.channels
                    .fetch(logChannelId)
                    .catch(() => null);

            if (!channel) {

                console.log(
                    "[LogManager] Canal de logs não encontrado."
                );

                return false;

            }

            // Cria o embed

            const embed =
                Builders.create(data);

            if (!embed) {

                console.log(
                    "[LogManager] Nenhum builder encontrado para:",
                    data.type
                );

                return false;

            }

            await channel.send({

                embeds: [
                    embed
                ]

            });

            console.log(
                `📋 Log enviado (${data.type})`
            );

            return true;

        } catch (error) {

            console.error(
                "[LogManager]",
                error
            );

            return false;

        }

    }

}

module.exports = LogManager;