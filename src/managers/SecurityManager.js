const { PermissionFlagsBits } = require("discord.js");
const SecurityRepository = require("../database/repositories/SecurityRepository");
const WarningRepository = require("../database/repositories/WarningRepository");
const LogManager = require("./LogManager");
const LogTypes = require("./LogTypes");
const GuildRepository = require("../database/repositories/GuildRepository");

const recentMessages = new Map();
const alertCooldowns = new Map();
const NOTICE_TTL_MS = 7000;
const CONTEXT_MODEL = process.env.SECURITY_CONTEXT_MODEL || "llama-3.3-70b-versatile";

const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, items] of recentMessages) {
        const fresh = items.filter(item => item.time >= cutoff);
        if (fresh.length) recentMessages.set(key, fresh);
        else recentMessages.delete(key);
    }
    for (const [key, expiresAt] of alertCooldowns) {
        if (expiresAt <= Date.now()) alertCooldowns.delete(key);
    }
}, 5 * 60 * 1000);
cleanupTimer.unref?.();

function shouldRecordSignal(key, cooldownMs = 30000) {
    const now = Date.now();
    if ((alertCooldowns.get(key) || 0) > now) return false;
    alertCooldowns.set(key, now + cooldownMs);
    return true;
}

function normalize(value) {
    return String(value || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ").trim();
}

function isExempt(message, config) {
    const member = message.member;
    if (!member) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    let ignored = [];
    try { ignored = JSON.parse(config.ignored_roles || "[]"); } catch {}
    return ignored.some(roleId => member.roles.cache.has(roleId));
}

function localKeywordMatch(content, keywords) {
    const normalizedContent = ` ${normalize(content)} `;
    return keywords.some(keyword => {
        const normalizedKeyword = normalize(keyword);
        return normalizedKeyword.length > 0 && normalizedContent.includes(` ${normalizedKeyword} `);
    });
}

async function contextualDecision(message, topic, keywords) {
    if (!process.env.GROQ_API_KEY) return { violation: false, confidence: 0, unavailable: true };
    try {
        const groq = require("../ai/groq");
        const response = await groq.chat.completions.create({
            model: CONTEXT_MODEL,
            temperature: 0,
            max_tokens: 120,
            messages: [
                { role: "system", content: "Você é um classificador de regras de moderação. Determine se a mensagem está realmente discutindo o assunto proibido, e não apenas citando a palavra, perguntando sobre a regra, ou mencionando-a incidentalmente. Retorne SOMENTE JSON válido: {\"violation\":boolean,\"confidence\":number,\"reason\":\"curta\"}. Seja conservador: ambiguidade deve resultar em violation=false." },
                { role: "user", content: JSON.stringify({ prohibited_topic: topic, trigger_terms: keywords, message: String(message.content || "").slice(0, 1500) }) }
            ]
        });
        const raw = response.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
        return {
            violation: parsed.violation === true,
            confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
            reason: String(parsed.reason || "").slice(0, 160)
        };
    } catch (error) {
        console.warn(`[Security:Context] Análise contextual indisponível: ${error.message}`);
        return { violation: false, confidence: 0, unavailable: true };
    }
}

async function sendAlert(guild, config, content) {
    const key = `${guild.id}:${content.key || "security"}`;
    const now = Date.now();
    if ((alertCooldowns.get(key) || 0) > now) return;
    alertCooldowns.set(key, now + 30000);

    let channel = config.alert_channel_id ? guild.channels.cache.get(config.alert_channel_id) : null;
    if (!channel) {
        const settings = await GuildRepository.getSettings(guild.id).catch(() => null);
        if (settings?.log_channel) channel = guild.channels.cache.get(settings.log_channel);
    }
    if (!channel?.isTextBased?.() || channel.isThread?.()) return;
    await channel.send({
        content: content.text,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false }
    }).catch(() => {});
}

async function checkTopicGuard(message, config) {
    if (!config.topic_enabled) return false;
    const rules = (await SecurityRepository.listRules(message.guild.id))
        .filter(rule => rule.enabled && rule.channel_id === message.channel.id);
    if (!rules.length) return false;

    for (const rule of rules) {
        if (!localKeywordMatch(message.content, rule.keywords)) continue;
        let violation = true;
        let reason = `Assunto não permitido: ${rule.topic}`;

        if (config.contextual_enabled) {
            const decision = await contextualDecision(message, rule.topic, rule.keywords);
            violation = decision.violation && decision.confidence >= 0.82;
            if (decision.unavailable) {
                // Fail-open: se a análise contextual foi habilitada mas falhou,
                // não apagamos mensagens com base apenas numa correspondência ambígua.
                violation = false;
                await SecurityRepository.logEvent({
                    guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
                    eventType: "topic_context_unavailable", reason: "Análise contextual indisponível; mensagem mantida.",
                    details: { ruleId: rule.id }
                }).catch(() => {});
            }
            if (!violation) continue;
            reason = `Assunto não permitido: ${rule.topic}${decision.reason ? ` (${decision.reason})` : ""}`;
        }

        let deleted = false;
        try {
            if (!message.channel.permissionsFor(message.guild.members.me)?.has(PermissionFlagsBits.ManageMessages)) {
                await SecurityRepository.logEvent({
                    guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
                    eventType: "topic_delete_failed", reason: "Nina sem permissão para apagar mensagens.", details: { ruleId: rule.id }
                });
                return false;
            }
            await message.delete();
            deleted = true;
        } catch (error) {
            await SecurityRepository.logEvent({
                guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
                eventType: "topic_delete_failed", reason: `Falha ao excluir mensagem: ${error.message}`, details: { ruleId: rule.id }
            }).catch(() => {});
            return false;
        }

        if (deleted) {
            const notice = await message.channel.send({
                content: `<@${message.author.id}> ⚠️ Sua mensagem foi removida porque o assunto **${rule.topic}** não é permitido neste canal.`,
                allowedMentions: { parse: [], users: [message.author.id], roles: [], repliedUser: false }
            }).catch(() => null);
            if (notice) setTimeout(() => notice.delete().catch(() => {}), NOTICE_TTL_MS).unref?.();
            let extraAction = "none";
            if (config.topic_warn_enabled) {
                await WarningRepository.create({
                    guildId: message.guild.id,
                    userId: message.author.id,
                    moderatorId: message.client.user.id,
                    reason: `[TopicGuard] ${reason}`
                }).then(() => { extraAction = "warn"; }).catch(error => {
                    console.error("[Security:TopicGuard] Falha ao registrar advertência:", error.message);
                });
            }
            if (config.topic_timeout_enabled) {
                const botMember = message.guild.members.me;
                if (message.member?.moderatable && botMember?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
                    await message.member.timeout(
                        Math.max(1, Math.min(60, Number(config.topic_timeout_minutes) || 5)) * 60 * 1000,
                        `[TopicGuard] ${rule.topic}`
                    ).then(() => { extraAction = extraAction === "warn" ? "warn,timeout" : "timeout"; }).catch(error => {
                        console.error("[Security:TopicGuard] Falha ao aplicar timeout:", error.message);
                    });
                } else {
                    await SecurityRepository.logEvent({
                        guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
                        eventType: "topic_timeout_failed", reason: "Timeout configurado, mas faltam permissões ou hierarquia."
                    }).catch(() => {});
                }
            }
            await SecurityRepository.logEvent({
                guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
                eventType: "topic_blocked", reason, details: { ruleId: rule.id, contextual: !!config.contextual_enabled, extraAction }
            }).catch(() => {});
            await LogManager.send({
                type: LogTypes.AUTOMOD_ACTION,
                guild: message.guild,
                executor: { tag: "🛡️ TopicGuard", username: "TopicGuard" },
                target: { id: message.author.id, username: message.author.username, displayName: message.member?.displayName },
                reason,
                extra: { channelId: message.channel.id, actions: ["delete", "notify", extraAction].filter(action => action !== "none").join(", ") }
            }).catch(() => {});
            return true;
        }
    }
    return false;
}

function checkBehavior(message) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const old = recentMessages.get(key) || [];
    const current = [...old.filter(item => now - item.time < 10000), { time: now, content: normalize(message.content) }];
    recentMessages.set(key, current);
    const repeated = current.filter(item => item.content && item.content === normalize(message.content)).length;
    return current.length >= 7 || repeated >= 4;
}

async function handleMessage(message) {
    if (!message.guild || message.author.bot || !message.member) return false;
    const config = await SecurityRepository.get(message.guild.id);
    if (isExempt(message, config)) return false;

    if (config.honeypot_enabled && config.honeypot_channel_id === message.channel.id &&
        shouldRecordSignal(`honeypot-event:${message.guild.id}:${message.author.id}`)) {
        await SecurityRepository.logEvent({
            guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
            eventType: "honeypot_channel_interaction", reason: "Mensagem enviada no canal-isca. Revisão humana recomendada."
        }).catch(() => {});
        await sendAlert(message.guild, config, {
            key: `honeypot:${message.author.id}`,
            text: `🪤 **Honeypot acionado** em <#${message.channel.id}>. Usuário: <@${message.author.id}>. O evento é um sinal para revisão, não prova de abuso.`
        });
    }

    if (config.behavior_enabled && checkBehavior(message) &&
        shouldRecordSignal(`behavior-event:${message.guild.id}:${message.author.id}`)) {
        await SecurityRepository.logEvent({
            guildId: message.guild.id, channelId: message.channel.id, userId: message.author.id,
            eventType: "behavior_signal", reason: "Padrão de mensagens potencialmente repetitivo; requer revisão."
        }).catch(() => {});
        await sendAlert(message.guild, config, {
            key: `behavior:${message.author.id}`,
            text: `🔎 **Sinal comportamental** em <#${message.channel.id}> envolvendo <@${message.author.id}>. Verifique o contexto antes de aplicar punições.`
        });
    }

    return checkTopicGuard(message, config);
}

async function handleChannelUpdate(oldChannel, newChannel) {
    if (!newChannel.guild) return;
    const config = await SecurityRepository.get(newChannel.guild.id);
    if (!config.honeypot_enabled || config.honeypot_channel_id !== newChannel.id) return;
    const everyone = newChannel.guild.roles.everyone;
    const effectivePermissions = newChannel.permissionsFor(everyone);
    const canView = effectivePermissions?.has(PermissionFlagsBits.ViewChannel);
    const canSend = effectivePermissions?.has(PermissionFlagsBits.SendMessages);
    if (canView || canSend) {
        await SecurityRepository.logEvent({
            guildId: newChannel.guild.id, channelId: newChannel.id, eventType: "honeypot_permission_warning",
            reason: "O canal-isca pode estar visível ou acessível a @everyone; verifique permissões herdadas."
        }).catch(() => {});
    }
}

module.exports = { handleMessage, handleChannelUpdate };
