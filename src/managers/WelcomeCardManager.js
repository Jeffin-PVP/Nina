const { createCanvas, loadImage } = require("@napi-rs/canvas");

const LARGURA = 1000;
const ALTURA = 380;

/*
=========================
    HELPERS DE DESENHO
=========================
*/

function roundedRectPath(ctx, x, y, w, h, r) {

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();

}

// Desenha a imagem preenchendo a caixa (cover), cortando o excesso, sem distorcer.
function desenharImagemCover(ctx, img, x, y, w, h) {

    const imgRatio = img.width / img.height;
    const boxRatio = w / h;

    let sx, sy, sw, sh;

    if (imgRatio > boxRatio) {

        sh = img.height;
        sw = sh * boxRatio;
        sx = (img.width - sw) / 2;
        sy = 0;

    } else {

        sw = img.width;
        sh = sw / boxRatio;
        sx = 0;
        sy = (img.height - sh) / 2;

    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

}

// Quebra o texto em várias linhas se ele não couber na largura máxima
function quebrarLinhas(ctx, texto, maxWidth) {

    const palavras = texto.split(" ");
    const linhas = [];
    let linhaAtual = "";

    for (const palavra of palavras) {

        const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;

        if (ctx.measureText(tentativa).width > maxWidth && linhaAtual) {

            linhas.push(linhaAtual);
            linhaAtual = palavra;

        } else {

            linhaAtual = tentativa;

        }

    }

    if (linhaAtual) linhas.push(linhaAtual);

    return linhas;

}

async function carregarImagemDeUrl(url) {

    const resposta = await fetch(url);

    if (!resposta.ok) throw new Error(`Falha ao baixar imagem (HTTP ${resposta.status})`);

    const buffer = Buffer.from(await resposta.arrayBuffer());

    return loadImage(buffer);

}

/*
=========================
    SUBSTITUIÇÃO DE VARIÁVEIS
=========================
*/

function aplicarVariaveis(texto, { member }) {

    return String(texto || "")
        .replaceAll("{usuario}", member.user.username)
        .replaceAll("{tag}", member.user.tag)
        .replaceAll("{servidor}", member.guild.name)
        .replaceAll("{membros}", String(member.guild.memberCount))
        .replaceAll("{menção}", `<@${member.user.id}>`)
        .replaceAll("{mencao}", `<@${member.user.id}>`);

}

/*
=========================
    GERAÇÃO DO CARTÃO
=========================
*/

async function gerarCartao(member, config) {

    const canvas = createCanvas(LARGURA, ALTURA);
    const ctx = canvas.getContext("2d");

    /* ---------- FUNDO ---------- */

    if (config.background_url) {

        try {

            const bg = await carregarImagemDeUrl(config.background_url);
            desenharImagemCover(ctx, bg, 0, 0, LARGURA, ALTURA);

        } catch {

            desenharFundoPadrao(ctx, config.accent_color);

        }

    } else {

        desenharFundoPadrao(ctx, config.accent_color);

    }

    // Camada escura por cima do fundo, pra garantir contraste com o texto
    ctx.fillStyle = "rgba(10, 12, 18, 0.55)";
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Moldura
    roundedRectPath(ctx, 6, 6, LARGURA - 12, ALTURA - 12, 24);
    ctx.lineWidth = 4;
    ctx.strokeStyle = config.accent_color;
    ctx.stroke();

    /* ---------- AVATAR ---------- */

    const raio = 90;
    const cx = 150;
    const cy = ALTURA / 2;

    try {

        const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
        const avatar = await carregarImagemDeUrl(avatarUrl);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, raio, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, cx - raio, cy - raio, raio * 2, raio * 2);
        ctx.restore();

    } catch {
        // se não conseguir baixar o avatar, segue só sem ele
    }

    ctx.beginPath();
    ctx.arc(cx, cy, raio + 5, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = config.accent_color;
    ctx.stroke();

    /* ---------- TEXTOS ---------- */

    const textX = 300;
    const maxTextWidth = LARGURA - textX - 50;

    const titulo = aplicarVariaveis(config.title_text, { member });
    const subtitulo = aplicarVariaveis(config.subtitle_text, { member });

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 46px sans-serif";

    const linhasTitulo = quebrarLinhas(ctx, titulo, maxTextWidth).slice(0, 2);
    let cursorY = ALTURA / 2 - (linhasTitulo.length > 1 ? 30 : 5);

    linhasTitulo.forEach(linha => {

        ctx.fillText(linha, textX, cursorY);
        cursorY += 54;

    });

    ctx.fillStyle = "#D8DAE3";
    ctx.font = "28px sans-serif";

    const linhasSubtitulo = quebrarLinhas(ctx, subtitulo, maxTextWidth).slice(0, 2);

    cursorY += 8;

    linhasSubtitulo.forEach(linha => {

        ctx.fillText(linha, textX, cursorY);
        cursorY += 36;

    });

    return canvas.toBuffer("image/png");

}

function desenharFundoPadrao(ctx, accentColor) {

    const gradiente = ctx.createLinearGradient(0, 0, LARGURA, ALTURA);
    gradiente.addColorStop(0, "#0b0d12");
    gradiente.addColorStop(1, accentColor || "#5865F2");

    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, LARGURA, ALTURA);

}

module.exports = {
    gerarCartao,
    aplicarVariaveis
};
