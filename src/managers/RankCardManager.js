const { createCanvas, loadImage } = require("@napi-rs/canvas");

const { fetchBuffer } = require("../utils/safeFetch");
const AutoroleRepository = require("../database/repositories/AutoroleRepository");
const LevelManager = require("./LevelManager");

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function resolveLevelTitle(level) {
    const titles = [
        { min: 0, label: "Novato" },
        { min: 5, label: "Explorador" },
        { min: 10, label: "Ativo" },
        { min: 20, label: "Veterano" },
        { min: 35, label: "Elite" },
        { min: 50, label: "Lenda" },
        { min: 75, label: "Mestre" }
    ];

    return titles.filter(entry => level >= entry.min).at(-1)?.label || "Novato";
}

async function loadRemoteImage(url) {
    const buffer = await fetchBuffer(url);
    return loadImage(buffer);
}

async function drawRoundedAvatar(ctx, url, x, y, radius) {
    try {
        const avatar = await loadRemoteImage(url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, x, y, radius * 2, radius * 2);
        ctx.restore();
    } catch {
        ctx.fillStyle = "#2f3542";
        ctx.beginPath();
        ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

async function generateRankCard({ member, profile, position, totalUsers, guild }) {
    const canvas = createCanvas(1200, 420);
    const ctx = canvas.getContext("2d");

    const user = member?.user ?? { username: "Usuário", displayAvatarURL: () => "" };
    const accentColor = member?.displayHexColor && member.displayHexColor !== "#000000"
        ? member.displayHexColor
        : "#5865F2";

    const baseXp = LevelManager.totalXpForLevel(profile.level);
    const currentXpInLevel = Math.max(0, profile.xp - baseXp);
    const xpNeeded = LevelManager.xpNeededForLevel(profile.level);
    const currentProgress = clamp(currentXpInLevel / Math.max(1, xpNeeded), 0, 1);

    const levelRoleEntries = (await AutoroleRepository.listLevelRoles(guild.id))
        .filter(entry => entry.level <= profile.level)
        .sort((a, b) => b.level - a.level);
    const levelRole = levelRoleEntries.length
        ? guild.roles.cache.get(levelRoleEntries[0].role_id) || null
        : null;

    const title = resolveLevelTitle(profile.level);

    const gradient = ctx.createLinearGradient(0, 0, 1200, 420);
    gradient.addColorStop(0, "#0f1220");
    gradient.addColorStop(0.45, "#151d31");
    gradient.addColorStop(1, accentColor + "CC");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 420);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(42, 42, 1116, 336);

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, 1116, 336);

    const glow = ctx.createRadialGradient(930, 80, 20, 930, 80, 260);
    glow.addColorStop(0, accentColor + "99");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1200, 420);

    const avatarX = 90;
    const avatarY = 95;
    const avatarRadius = 92;
    await drawRoundedAvatar(ctx, user.displayAvatarURL({ extension: "png", size: 256 }), avatarX, avatarY, avatarRadius);

    ctx.beginPath();
    ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius + 8, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    ctx.fillStyle = "rgba(14, 16, 26, 0.8)";
    ctx.fillRect(300, 110, 790, 150);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#B9C5FF";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("NIVEL", 334, 155);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 76px sans-serif";
    ctx.fillText(String(profile.level), 334, 235);

    ctx.fillStyle = "#e9ecff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(String(user.globalName || user.username || "Usuário"), 334, 295);

    ctx.fillStyle = "#bfc7e8";
    ctx.font = "20px sans-serif";
    ctx.fillText(`${title} • Posição #${position || "-"} de ${totalUsers || 1}`, 334, 332);

    const badgeWidth = 208;
    const badgeX = 980;
    const badgeY = 110;
    ctx.fillStyle = "rgba(13, 15, 24, 0.72)";
    roundRect(ctx, badgeX, badgeY, badgeWidth, 84, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(`#${position || "-"}`, badgeX + 86, badgeY + 53);

    const barX = 334;
    const barY = 350;
    const barWidth = 740;
    const barHeight = 22;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, barX, barY, barWidth, barHeight, 12);
    ctx.fill();

    const fillWidth = barWidth * currentProgress;
    const grad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, fillWidth, barHeight, 12);
    ctx.fill();

    ctx.fillStyle = "#eef2ff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`${formatNumber(currentXpInLevel)} / ${formatNumber(xpNeeded)} XP`, barX, barY - 12);

    ctx.fillStyle = "#dfe5ff";
    ctx.font = "18px sans-serif";
    const roleLabel = levelRole ? `Cargo: ${levelRole.name}` : "Cargo: nenhum ainda";
    ctx.fillText(roleLabel, 334, 392);

    ctx.fillStyle = "#c8d0ff";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Servidor: ${guild.name}`, 742, 392);

    return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

module.exports = {
    generateRankCard,
    resolveLevelTitle
};
