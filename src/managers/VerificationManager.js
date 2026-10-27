const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    PermissionFlagsBits, MessageFlags
} = require("discord.js");
const Repo = require("../database/repositories/ServerToolsRepository");
const ui = require("../utils/ui");

const TABLE = "verification_config";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const LOCK_MS = 5 * 60 * 1000;

const challenges = new Map(); // "guild:user" -> { answer, expires, attempts }
const locks = new Map();      // "guild:user" -> timestamp até quando está bloqueado
const key = (guildId, userId) => `${guildId}:${userId}`;

function newChallenge() {
    const a = 2 + Math.floor(Math.random() * 9);
    const b = 2 + Math.floor(Math.random() * 9);
    if (Math.random() < 0.5) return { text: `Quanto é ${a} + ${b}?`, answer: String(a + b) };
    const big = Math.max(a, b), small = Math.min(a, b);
    return { text: `Quanto é ${big} - ${small}?`, answer: String(big - small) };
}

// Valida se a Nina consegue entregar/retirar os cargos configurados.
function checkRoleUsable(guild, role) {
    if (!role) return "Cargo não encontrado.";
    if (role.managed) return `${role} é gerenciado por uma integração e não pode ser entregue.`;
    if (role.id === guild.id) return "Não use o @everyone como cargo de verificação.";
    if (role.permissions.has(PermissionFlagsBits.Administrator)) return `${role} tem **Administrador**: não é seguro entregá-lo automaticamente.`;
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return "Eu preciso da permissão **Gerenciar Cargos**.";
    if (role.position >= me.roles.highest.position) return `${role} está acima (ou igual) ao meu maior cargo. Suba meu cargo acima dele.`;
    return null;
}

async function grant(member, config) {
    const role = member.guild.roles.cache.get(config.role_id);
    if (!role) throw new Error("role_missing");
    await member.roles.add(role, "Verificação concluída");
    if (config.unverified_role_id && member.roles.cache.has(config.unverified_role_id)) {
        await member.roles.remove(config.unverified_role_id, "Verificação concluída").catch(() => null);
    }
}

function panelPayload(guild, config) {
    const captcha = config.mode === "captcha";
    const embed = ui.panel({
        color: ui.COLORS.info,
        emoji: "<:escudo:1562187519150395393>",
        title: "Verificação",
        description: captcha
            ? "Para liberar o acesso ao servidor, clique no botão e responda uma pergunta rápida."
            : "Para liberar o acesso ao servidor, clique no botão abaixo.",
        thumbnail: guild.iconURL({ size: 256 })
    });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("verify:start").setLabel("Verificar").setEmoji("<:ui_check:1560326782610047098>").setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
}

async function sendPanel(guild, config, channel) {
    // Remove o painel antigo, se existir, para não ficar duplicado.
    if (config.message_id && config.channel_id) {
        const old = guild.channels.cache.get(config.channel_id);
        const msg = await old?.messages?.fetch?.(config.message_id).catch(() => null);
        await msg?.delete?.().catch(() => null);
    }
    const sent = await channel.send(panelPayload(guild, config));
    await Repo.setConfig(TABLE, guild.id, { channel_id: channel.id, message_id: sent.id });
    return sent;
}

async function handleButton(interaction) {
    if (interaction.customId !== "verify:start") return;
    const { guild, member } = interaction;
    const config = await Repo.getConfig(TABLE, guild.id);
    if (!config.enabled || !config.role_id) {
        return ui.caution(interaction, "A verificação não está ativa neste servidor.", "Indisponível");
    }
    if (member.roles.cache.has(config.role_id)) {
        return ui.ok(interaction, "Você já está verificado. Aproveite o servidor!", "Já verificado");
    }

    const lockedUntil = locks.get(key(guild.id, member.id)) || 0;
    if (lockedUntil > Date.now()) {
        return ui.caution(interaction, `Muitas tentativas erradas. Tente de novo ${ui.ts(lockedUntil)}.`, "Aguarde um pouco");
    }

    if (config.mode !== "captcha") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            await grant(member, config);
        } catch {
            return ui.fail(interaction, "Não consegui te dar o cargo de verificado. Avise a equipe.", "Falha na verificação");
        }
        return ui.respond(interaction, ui.success("Verificação concluída! O acesso ao servidor foi liberado.", "Verificado", interaction));
    }

    const challenge = newChallenge();
    challenges.set(key(guild.id, member.id), { answer: challenge.answer, expires: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });
    const modal = new ModalBuilder().setCustomId("verify:modal").setTitle("Verificação")
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("answer").setLabel(challenge.text.slice(0, 45)).setStyle(TextInputStyle.Short)
                .setMinLength(1).setMaxLength(4).setRequired(true).setPlaceholder("Digite só o número")
        ));
    return interaction.showModal(modal);
}

async function handleModal(interaction) {
    if (interaction.customId !== "verify:modal") return;
    const { guild, member } = interaction;
    const k = key(guild.id, member.id);
    const config = await Repo.getConfig(TABLE, guild.id);
    if (!config.enabled || !config.role_id) return ui.caution(interaction, "A verificação não está ativa neste servidor.", "Indisponível");

    const challenge = challenges.get(k);
    if (!challenge || challenge.expires < Date.now()) {
        challenges.delete(k);
        return ui.caution(interaction, "A pergunta expirou. Clique em **Verificar** de novo.", "Expirou");
    }

    const answer = interaction.fields.getTextInputValue("answer").trim();
    if (answer !== challenge.answer) {
        challenge.attempts += 1;
        if (challenge.attempts >= MAX_ATTEMPTS) {
            challenges.delete(k);
            locks.set(k, Date.now() + LOCK_MS);
            return ui.caution(interaction, `Resposta incorreta. Você tentou ${MAX_ATTEMPTS} vezes; tente de novo ${ui.ts(Date.now() + LOCK_MS)}.`, "Tentativas esgotadas");
        }
        return ui.caution(interaction, `Resposta incorreta (${challenge.attempts}/${MAX_ATTEMPTS}). Clique em **Verificar** para tentar outra pergunta.`, "Quase!");
    }

    challenges.delete(k);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await grant(member, config);
    } catch {
        return ui.fail(interaction, "Resposta certa, mas não consegui te dar o cargo. Avise a equipe.", "Falha na verificação");
    }
    return ui.respond(interaction, ui.success("Verificação concluída! O acesso ao servidor foi liberado.", "Verificado", interaction));
}

// Chamado na entrada de membros: aplica o cargo "não verificado", se configurado.
async function handleJoin(member) {
    if (member.user.bot) return;
    const config = await Repo.getConfig(TABLE, member.guild.id);
    if (!config.enabled || !config.unverified_role_id) return;
    const role = member.guild.roles.cache.get(config.unverified_role_id);
    if (role) await member.roles.add(role, "Aguardando verificação").catch(() => null);
}

// Limpeza periódica para o mapa não crescer.
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of challenges) if (v.expires < now) challenges.delete(k);
    for (const [k, v] of locks) if (v < now) locks.delete(k);
}, 10 * 60 * 1000).unref?.();

module.exports = { TABLE, checkRoleUsable, sendPanel, handleButton, handleModal, handleJoin };
