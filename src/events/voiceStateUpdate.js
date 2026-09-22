const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");

module.exports = {

    name: Events.VoiceStateUpdate,

    async execute(oldState, newState) {

        const member = newState.member ?? oldState.member;

        if (!member || member.user.bot) return;

        // Entrou em um canal (não estava em nenhum antes)
        if (!oldState.channelId && newState.channelId) {

            await LogManager.send({
                type: LogTypes.VOICE_JOIN,
                guild: newState.guild,
                target: member,
                extra: { channel: newState.channel?.name ?? "Desconhecido" }
            });

            return;

        }

        // Saiu de um canal (não entrou em nenhum outro)
        if (oldState.channelId && !newState.channelId) {

            await LogManager.send({
                type: LogTypes.VOICE_LEAVE,
                guild: oldState.guild,
                target: member,
                extra: { channel: oldState.channel?.name ?? "Desconhecido" }
            });

            return;

        }

        // Trocou de canal
        if (
            oldState.channelId &&
            newState.channelId &&
            oldState.channelId !== newState.channelId
        ) {

            await LogManager.send({
                type: LogTypes.VOICE_MOVE,
                guild: newState.guild,
                target: member,
                extra: {
                    from: oldState.channel?.name ?? "Desconhecido",
                    to: newState.channel?.name ?? "Desconhecido"
                }
            });

        }

    }

};
