const { PermissionFlagsBits, GuildVerificationLevel, GuildMFALevel, GuildExplicitContentFilter } = require("discord.js");

const SEVERITY = { critical: { weight: 25, icon: "🔴", label: "Crítico" }, high: { weight: 12, icon: "🟠", label: "Alto" }, medium: { weight: 6, icon: "🟡", label: "Médio" }, low: { weight: 2, icon: "🔵", label: "Baixo" } };

const DANGEROUS = [
    ["Administrator", "Administrador"], ["ManageGuild", "Gerenciar Servidor"], ["ManageRoles", "Gerenciar Cargos"],
    ["ManageChannels", "Gerenciar Canais"], ["BanMembers", "Banir Membros"], ["KickMembers", "Expulsar Membros"],
    ["ManageWebhooks", "Gerenciar Webhooks"], ["MentionEveryone", "Mencionar @everyone"]
];
const EVERYONE_FORBIDDEN = DANGEROUS.map(([flag, label]) => [PermissionFlagsBits[flag], label]);
const CHANNEL_DANGEROUS = [
    [PermissionFlagsBits.ManageChannels, "Gerenciar Canal"], [PermissionFlagsBits.ManageRoles, "Gerenciar Permissões"],
    [PermissionFlagsBits.ManageWebhooks, "Gerenciar Webhooks"], [PermissionFlagsBits.MentionEveryone, "Mencionar @everyone"],
    [PermissionFlagsBits.ManageMessages, "Gerenciar Mensagens"]
];

async function loadMembers(guild) {
    // Em servidores grandes usa só o cache para não travar; o relatório avisa quando é parcial.
    if (guild.memberCount <= 5000 && guild.members.cache.size < guild.memberCount) {
        await Promise.race([guild.members.fetch().catch(() => null), new Promise(r => setTimeout(r, 15000))]);
    }
    return { partial: guild.members.cache.size < guild.memberCount };
}

async function audit(guild) {
    const findings = [];
    const add = (severity, title, detail) => findings.push({ severity, title, detail });
    const { partial } = await loadMembers(guild);
    const everyone = guild.roles.everyone;
    const total = Math.max(guild.memberCount, 1);

    // @everyone com permissões perigosas
    const everyoneBad = EVERYONE_FORBIDDEN.filter(([bit]) => everyone.permissions.has(bit)).map(([, label]) => label);
    if (everyoneBad.length) {
        const critical = everyone.permissions.has(PermissionFlagsBits.Administrator) || everyone.permissions.has(PermissionFlagsBits.ManageRoles);
        add(critical ? "critical" : "high", "@everyone com permissões perigosas", `Todos os membros podem: ${everyoneBad.join(", ")}.`);
    }

    // Cargos com Administrador
    const adminRoles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.permissions.has(PermissionFlagsBits.Administrator));
    for (const role of adminRoles.values()) {
        const humans = role.members.filter(m => !m.user.bot).size;
        const share = humans / total;
        if (share > 0.1 || humans > 8) add("high", `Cargo ${role.name} com Administrador e muita gente`, `${humans} membros (${Math.round(share * 100)}%) têm poder total. Reduza ao mínimo necessário.`);
        else add("medium", `Cargo ${role.name} com Administrador`, `${humans} membro(s). Confirme se todos realmente precisam de poder total.`);
    }

    // Bots com Administrador
    const adminBots = guild.members.cache.filter(m => m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator));
    if (adminBots.size) {
        add(adminBots.size > 2 ? "high" : "medium", "Bots com Administrador", `${[...adminBots.values()].slice(0, 10).map(m => m.user.username).join(", ")}${adminBots.size > 10 ? "…" : ""}. Dê só as permissões necessárias a cada bot.`);
    }

    // Outros cargos perigosos distribuídos para muita gente
    for (const role of guild.roles.cache.values()) {
        if (role.id === guild.id || role.managed || role.permissions.has(PermissionFlagsBits.Administrator)) continue;
        const flags = DANGEROUS.filter(([flag]) => flag !== "Administrator" && role.permissions.has(PermissionFlagsBits[flag])).map(([, label]) => label);
        if (!flags.length) continue;
        const humans = role.members.filter(m => !m.user.bot).size;
        if (humans / total > 0.2 && humans > 10) add("medium", `Cargo ${role.name} com permissões de moderação`, `${humans} membros podem: ${flags.join(", ")}.`);
    }

    // Permissões perigosas para @everyone em canais
    const exposed = [];
    for (const channel of guild.channels.cache.values()) {
        const ow = channel.permissionOverwrites?.cache?.get(guild.id);
        if (!ow) continue;
        const labels = CHANNEL_DANGEROUS.filter(([bit]) => ow.allow.has(bit)).map(([, label]) => label);
        if (labels.length) exposed.push(`#${channel.name} (${labels.join(", ")})`);
    }
    if (exposed.length) add("high", "Canais com permissões perigosas para @everyone", `${exposed.slice(0, 6).join("; ")}${exposed.length > 6 ? ` e mais ${exposed.length - 6}` : ""}.`);

    // Configurações do servidor
    const hasMods = guild.roles.cache.some(r => r.id !== guild.id && !r.managed && (r.permissions.has(PermissionFlagsBits.BanMembers) || r.permissions.has(PermissionFlagsBits.ManageGuild) || r.permissions.has(PermissionFlagsBits.Administrator)));
    if (hasMods && guild.mfaLevel === GuildMFALevel.None) add("medium", "2FA não exigido para moderadores", "Ative a exigência de autenticação em dois fatores para ações de moderação (Configurações do servidor → Segurança).");
    if (guild.verificationLevel === GuildVerificationLevel.None) add("medium", "Sem nível de verificação", "Qualquer conta pode entrar e falar imediatamente. Considere o nível Baixo ou superior.");
    if (guild.explicitContentFilter === GuildExplicitContentFilter.Disabled && guild.memberCount > 50) add("low", "Filtro de conteúdo explícito desativado", "Ative para ao menos membros sem cargo.");

    const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + SEVERITY[f.severity].weight, 0));
    const grade = score >= 90 ? "Excelente" : score >= 75 ? "Bom" : score >= 55 ? "Atenção" : "Arriscado";
    const order = ["critical", "high", "medium", "low"];
    findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    return { score, grade, findings, partial };
}

module.exports = { audit, SEVERITY };
