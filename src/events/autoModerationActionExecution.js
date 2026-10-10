const { Events, AutoModerationActionType } = require("discord.js");

const AutomodRepository = require("../database/repositories/AutomodRepository");
const WarningRepository = require("../database/repositories/WarningRepository");
const LogManager = require("../managers/LogManager");
const LogTypes = require("../managers/LogTypes");
const { REGRAS, PREFIXO } = require("../managers/NativeAutomodSync");

/*
 * Disparado quando uma regra NATIVA do Discord age. Para as regras criadas
 * pela Nina, registra o warn (se a config pedir) e manda o log de AutoMod,
 * mantendo o comportamento do AutoMod antigo.
 */

module.exports = {

    name: Events.AutoModerationActionExecution,

    async execute(execution) {

        const { guild, client } = execution;

        const rule = execution.autoModerationRule
            || await guild.autoModerationRules.fetch(execution.ruleId).catch(() => null);

        if (!rule || rule.creatorId !== client.user.id || !rule.name.startsWith(PREFIXO)) return;

        // O evento chega uma vez por ação da regra: trata só na primeira, pra não duplicar
        const primeira = rule.actions?.[0]?.type;
        if (primeira !== undefined && primeira !== execution.action.type) return;

        const definicao = Object.values(REGRAS).find(r => r.nome === rule.name);
        if (!definicao) return;

        const config = await AutomodRepository.get(guild.id);
        const acoes = AutomodRepository.parseLista(config[definicao.acoes]);

        if (acoes.includes("warn")) {

            await WarningRepository.create({
                guildId: guild.id,
                userId: execution.userId,
                moderatorId: client.user.id,
                reason: `[AutoMod] ${definicao.motivo}`
            }).catch(error => console.error("[AutoMod] Falha ao registrar warn:", error));

        }

        const membro = await guild.members.fetch(execution.userId).catch(() => null);

        await LogManager.send({
            type: LogTypes.AUTOMOD_ACTION,
            guild,
            executor: { tag: "🤖 AutoMod", username: "AutoMod" },
            target: {
                id: execution.userId,
                username: membro?.user.username || execution.userId,
                displayName: membro?.displayName
            },
            reason: definicao.motivo,
            extra: { channelId: execution.channelId, actions: acoes.join(", ") }
        }).catch(() => {});

    }

};
