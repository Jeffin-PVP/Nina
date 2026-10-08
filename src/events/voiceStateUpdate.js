const { Events } = require("discord.js");

const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const ServerStatsManager = require("../managers/ServerStatsManager");
const TempVoiceManager = require("../managers/TempVoiceManager");
const TempVoiceRepository = require("../database/repositories/TempVoiceRepository");

module.exports = {
    name: Events.VoiceStateUpdate,

    async execute(oldState, newState) {
        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        // Entrou no canal de criação: cria/reaproveita a sala pessoal.
        if (newState.channelId) {
            const config = await TempVoiceRepository.get(newState.guild.id);

            if (
                config.enabled &&
                newState.channelId === config.trigger_channel_id
            ) {
                await TempVoiceManager.createRoom(member, newState.channel).catch(error => {
                    console.error("❌ Erro ao criar TempVoice:", error);
                });
            }
        }

        // Se saiu/trocou de uma sala temporária, apaga se ficou vazia.
        if (
            oldState.channelId &&
            oldState.channelId !== newState.channelId &&
            oldState.channel
        ) {
            const room = await TempVoiceRepository.getRoom(oldState.channelId);

            if (
                room &&
                room.owner_id === member.id &&
                oldState.channel.members.size > 0
            ) {
                const nextOwner = oldState.channel.members.first();

                if (nextOwner) {
                    await TempVoiceManager.transferOwnership(
                        oldState.channel,
                        member.id,
                        nextOwner
                    ).catch(error => {
                        console.error("❌ Erro ao transferir dono do TempVoice:", error);
                    });
                }
            }

            await TempVoiceManager.cleanupIfEmpty(oldState.channel).catch(error => {
                console.error("❌ Erro ao limpar TempVoice:", error);
            });
        }

        if (!oldState.channelId && newState.channelId) {
            await LogManager.send({
                type: LogTypes.VOICE_JOIN,
                guild: newState.guild,
                target: member,
                extra: { channel: newState.channel?.name ?? "Desconhecido" }
            }).catch(() => {});
        } else if (oldState.channelId && !newState.channelId) {
            await LogManager.send({
                type: LogTypes.VOICE_LEAVE,
                guild: oldState.guild,
                target: member,
                extra: { channel: oldState.channel?.name ?? "Desconhecido" }
            }).catch(() => {});
        } else if (
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
            }).catch(() => {});
        }

        await ServerStatsManager.updateGuild(newState.guild).catch(() => {});
    }
};
