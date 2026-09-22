const crypto = require("crypto");

const SESSAO_DURACAO_MS = 12 * 60 * 60 * 1000; // 12 horas
const PERM_ADMINISTRATOR = 0x8n;
const PERM_MANAGE_GUILD = 0x20n;

const sessoes = new Map(); // token -> { user, guilds, expiresAt }

function limparSessoesExpiradas() {

    const agora = Date.now();

    for (const [token, sessao] of sessoes.entries()) {

        if (sessao.expiresAt <= agora) sessoes.delete(token);

    }

}

function temPermissaoDeGerenciar(guildRaw) {

    if (guildRaw.owner) return true;

    try {

        const bits = BigInt(guildRaw.permissions);

        return (bits & PERM_ADMINISTRATOR) === PERM_ADMINISTRATOR || (bits & PERM_MANAGE_GUILD) === PERM_MANAGE_GUILD;

    } catch {

        return false;

    }

}

module.exports = (client) => {

    function getRedirectUri() {

        return `${process.env.PUBLIC_URL}/api/panel/callback`;

    }

    /*
    =========================
        LOGIN (gera a URL de autorização do Discord)
    =========================
    */

    function loginUrl(req, res) {

        if (!process.env.PUBLIC_URL || !process.env.CLIENT_SECRET) {

            return res.status(500).json({
                error: "Painel não configurado: defina PUBLIC_URL e CLIENT_SECRET no .env do bot."
            });

        }

        const params = new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            redirect_uri: getRedirectUri(),
            response_type: "code",
            scope: "identify guilds",
            prompt: "consent"
        });

        res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });

    }

    /*
    =========================
        CALLBACK
    =========================
    */

    async function callback(req, res) {

        const { code, error } = req.query;

        if (error) return res.redirect(`/panel/?erro=${encodeURIComponent(error)}`);
        if (!code) return res.redirect("/panel/?erro=sem_codigo");

        try {

            const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: getRedirectUri()
                })
            });

            if (!tokenRes.ok) throw new Error("Falha ao trocar o código pelo token de acesso.");

            const tokenData = await tokenRes.json();

            const [userRes, guildsRes] = await Promise.all([

                fetch("https://discord.com/api/users/@me", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                }),

                fetch("https://discord.com/api/users/@me/guilds", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                })

            ]);

            if (!userRes.ok || !guildsRes.ok) throw new Error("Falha ao buscar dados do usuário no Discord.");

            const user = await userRes.json();
            const guildsRaw = await guildsRes.json();

            /*
            =========================
                SERVIDORES DO PAINEL
            =========================

                Dono da Nina:
                - pode ver TODOS os servidores onde o bot está;
                - isso inclui servidores onde o dono não está pessoalmente.

                Outros usuários:
                - continuam vendo somente servidores onde estão;
                - precisam ter permissão de gerenciar o servidor.
            */

            const isOwner = String(user.id) === String(process.env.OWNER_ID);

            let guilds;

            if (isOwner) {

                guilds = [...client.guilds.cache.values()]
                    .map(g => ({
                        id: g.id,
                        name: g.name,
                        icon: g.iconURL({ extension: "png", size: 128 }),
                        botPresent: true
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));

            } else {

                guilds = guildsRaw
                    .filter(temPermissaoDeGerenciar)
                    .map(g => ({
                        id: g.id,
                        name: g.name,
                        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
                        botPresent: client.guilds.cache.has(g.id)
                    }))
                    .sort((a, b) => Number(b.botPresent) - Number(a.botPresent));

            }

            limparSessoesExpiradas();

            const token = crypto.randomBytes(32).toString("hex");

            sessoes.set(token, {
                user: {
                    id: user.id,
                    username: user.global_name || user.username,
                    isOwner,
                    avatar: user.avatar
                        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                        : `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`
                },
                guilds,
                expiresAt: Date.now() + SESSAO_DURACAO_MS
            });

            res.redirect(`/panel/?token=${token}`);

        } catch (err) {

            console.error("[Painel] Erro no login com Discord:", err);
            res.redirect(`/panel/?erro=${encodeURIComponent(err.message)}`);

        }

    }

    /*
    =========================
        MIDDLEWARES
    =========================
    */

    function requireAuth(req, res, next) {

        const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        const sessao = sessoes.get(token);

        if (!token || !sessao || sessao.expiresAt <= Date.now()) {

            return res.status(401).json({ error: "Não autenticado. Faça login novamente." });

        }

        req.painelSessao = sessao;

        next();

    }

    function requireGuildAccess(req, res, next) {

        const guildInfo = req.painelSessao.guilds.find(g => g.id === req.params.guildId);

        if (!guildInfo) {

            return res.status(403).json({ error: "Você não tem permissão de gerenciar este servidor." });

        }

        if (!guildInfo.botPresent) {

            return res.status(404).json({ error: "O bot não está neste servidor." });

        }

        const guild = client.guilds.cache.get(req.params.guildId);

        if (!guild) {

            return res.status(404).json({ error: "O bot não está neste servidor." });

        }

        req.painelGuild = guild;

        next();

    }

    function logout(req, res) {

        const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

        sessoes.delete(token);

        res.json({ ok: true });

    }

    return { loginUrl, callback, requireAuth, requireGuildAccess, logout };

};
