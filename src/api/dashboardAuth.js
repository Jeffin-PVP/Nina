const crypto = require("crypto");

const SESSAO_DURACAO_MS = 12 * 60 * 60 * 1000; // 12 horas

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000; // 5 minutos

const sessoes = new Map(); // token -> expiresAt
const tentativas = new Map(); // ip -> { count, bloqueadoAte }

function limparSessoesExpiradas() {

    const agora = Date.now();

    for (const [token, expiresAt] of sessoes.entries()) {

        if (expiresAt <= agora) sessoes.delete(token);

    }

}

function ipEstaBloqueado(ip) {

    const registro = tentativas.get(ip);

    if (!registro) return false;

    if (registro.bloqueadoAte && registro.bloqueadoAte > Date.now()) return true;

    if (registro.bloqueadoAte && registro.bloqueadoAte <= Date.now()) tentativas.delete(ip);

    return false;

}

function registrarFalha(ip) {

    const registro = tentativas.get(ip) || { count: 0, bloqueadoAte: null };

    registro.count++;

    if (registro.count >= MAX_TENTATIVAS) {

        registro.bloqueadoAte = Date.now() + BLOQUEIO_MS;
        registro.count = 0;

    }

    tentativas.set(ip, registro);

}

function registrarSucesso(ip) {

    tentativas.delete(ip);

}

function login(req, res) {

    const ip = req.ip;

    if (ipEstaBloqueado(ip)) {

        return res.status(429).json({
            error: "Muitas tentativas erradas. Tente novamente em alguns minutos."
        });

    }

    const { password } = req.body || {};
    const senhaConfigurada = process.env.DASHBOARD_PASSWORD;

    if (!senhaConfigurada) {

        return res.status(500).json({
            error: "DASHBOARD_PASSWORD não configurada no .env do bot."
        });

    }

    if (!password || password !== senhaConfigurada) {

        registrarFalha(ip);

        return res.status(401).json({ error: "Senha incorreta." });

    }

    registrarSucesso(ip);
    limparSessoesExpiradas();

    const token = crypto.randomBytes(32).toString("hex");

    sessoes.set(token, Date.now() + SESSAO_DURACAO_MS);

    return res.json({ token, expiresIn: SESSAO_DURACAO_MS });

}

function logout(req, res) {

    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    sessoes.delete(token);

    return res.json({ ok: true });

}

function requireAuth(req, res, next) {

    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

    const expiresAt = sessoes.get(token);

    if (!token || !expiresAt || expiresAt <= Date.now()) {

        return res.status(401).json({ error: "Não autenticado. Faça login novamente." });

    }

    next();

}

module.exports = {
    login,
    logout,
    requireAuth
};
