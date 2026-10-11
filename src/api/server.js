const path = require("path");

const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const dashboardRoutes = require("./dashboardRoutes");
const panelRoutes = require("./panelRoutes");


class ApiServer {

    constructor(client) {

        this.client = client;

        this.app = express();

        this.app.disable("x-powered-by");

        // Atrás de proxy reverso (hospedagem), o IP real vem em X-Forwarded-For.
        // Sem isso o limite de tentativas de login trataria todo mundo como o mesmo IP.
        // Ajuste com TRUST_PROXY (número de proxies; "0" desativa).
        const trustProxy = process.env.TRUST_PROXY ?? "1";
        this.app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

        // Health checks (a hospedagem pode usar um destes para saber se o app está no ar)
        this.app.get("/teste", (req, res) => res.status(200).send("NINA PUBLIC TEST OK"));
        this.app.get("/health", (req, res) => res.status(200).json({ ok: true }));

        // Os painéis são servidos por esta mesma API (mesma origem), então CORS só
        // precisa liberar o PUBLIC_URL. Sem PUBLIC_URL, nenhuma origem externa.
        let origemPermitida = false;

        try {
            if (process.env.PUBLIC_URL) origemPermitida = new URL(process.env.PUBLIC_URL).origin;
        } catch { /* PUBLIC_URL inválida: mantém CORS fechado */ }

        this.app.use(cors({ origin: origemPermitida }));
        this.app.use(express.json({ limit: "100kb" }));


        // ==========================================
        // UNVEIL - NOTIFICAÇÕES DE VOTO
        // ==========================================
        this.app.post("/api/unveil/vote", async (req, res) => {
            const secret = process.env.UNVEIL_WEBHOOK_SECRET;

            if (!secret) {
                console.error("[Unveil Vote] Segredo não configurado.");
                return res.sendStatus(503);
            }

            if (req.get("Authorization") !== secret) {
                return res.sendStatus(401);
            }

            const { bot, user, type, isWeekend } = req.body || {};

            if (
                !client.isReady() ||
                bot !== client.user.id ||
                !/^\d{17,20}$/.test(user || "") ||
                type !== "upvote"
            ) {
                return res.sendStatus(400);
            }

            const channelId = process.env.UNVEIL_VOTE_CHANNEL_ID;
            const voteUrl = process.env.UNVEIL_VOTE_URL;

            if (!channelId) {
                console.error("[Unveil Vote] Canal não configurado.");
                return res.sendStatus(503);
            }

            try {
                const channel = await client.channels.fetch(channelId);

                if (!channel?.isTextBased() || !channel.send) {
                    console.error("[Unveil Vote] Canal inválido.");
                    return res.sendStatus(500);
                }

                // Guarda a contagem local em disco.
                // Conta apenas os votos recebidos por esta integração.
                const dataDir = path.join(__dirname, "..", "..", "data");
                const votesFile = path.join(dataDir, "unveil-votes.json");

                fs.mkdirSync(dataDir, { recursive: true });

                let votes = {};

                if (fs.existsSync(votesFile)) {
                    try {
                        votes = JSON.parse(
                            fs.readFileSync(votesFile, "utf8")
                        );
                    } catch {
                        console.error(
                            "[Unveil Vote] Arquivo de contagem inválido."
                        );
                        return res.sendStatus(500);
                    }
                }

                votes[user] = (Number(votes[user]) || 0) + 1;

                fs.writeFileSync(
                    votesFile,
                    JSON.stringify(votes, null, 2),
                    "utf8"
                );

                const member = await client.users.fetch(user).catch(() => null);
                const mention = `<@${user}>`;
                const count = votes[user];

                const embed = new EmbedBuilder()
                    .setColor(0xf569ff)
                    .setTitle("💜 Obrigado por votar na Nina!")
                    .setDescription(
                        `🔔 ${mention} acabou de votar na Nina!\n\n` +
                        `Esse usuário já teve **${count} voto(s) ` +
                        `registrado(s)** por esta integração.\n\n` +
                        "Seu apoio ajuda a Nina a crescer. " +
                        "Obrigado por fazer parte disso!"
                    )
                    .setTimestamp();

                if (member) {
                    embed.setThumbnail(member.displayAvatarURL());
                }

                if (isWeekend === true) {
                    embed.addFields({
                        name: "🎉 Voto de fim de semana",
                        value: "Obrigado pelo apoio especial!",
                    });
                }

                const components = [];

                if (voteUrl) {
                    try {
                        const parsedUrl = new URL(voteUrl);

                        if (parsedUrl.protocol !== "https:") {
                            throw new Error("A URL precisa usar HTTPS.");
                        }

                        components.push(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setLabel("Votar na Nina")
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(parsedUrl.toString())
                                    .setEmoji("💜")
                            )
                        );
                    } catch (error) {
                        console.error(
                            "[Unveil Vote] URL de votação inválida:",
                            error.message
                        );
                        return res.sendStatus(500);
                    }
                }

                await channel.send({
                    embeds: [embed],
                    components,
                    allowedMentions: {
                        users: [user],
                    },
                });

                console.log(
                    `[Unveil Vote] Voto de ${user} recebido. Total local: ${count}`
                );

                return res.sendStatus(204);
            } catch (error) {
                console.error("[Unveil Vote] Erro:", error);
                return res.sendStatus(500);
            }
        });


        this.app.get("/", (req, res) => {

            const base = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/+$/, "") : "";

            res.send(
                "<h1>Nina API funcionando!</h1>" +
                `<h3>Para acessar o painel de controle, vá para <a href="${base}/panel/">${base}/panel/</a>.</h3>` +
                `<a href="https://www.flaticon.com/free-icons/turn-on" title="turn on icons">Turn on icons created by Elite Art - Flaticon</a>` +
                `<a href="https://www.flaticon.com/free-icons/start-button" title="start button icons">Start button icons created by Uniconlabs - Flaticon</a>` +
                `<a href="https://www.flaticon.com/free-animated-icons/connect" title="connect animated icons">Connect animated icons created by Magnific - Flaticon</a>` +
                `<div> Ícones feitos por <a href="https://www.flaticon.com/br/autores/magnific" title="Magnific"> Magnific </a> from <a href="https://www.flaticon.com/br/" title="Flaticon">www.flaticon.com'</a></div>`
            );

        });

        this.app.use(
            "/api",
            routes(client)
        );

        this.app.use(
            "/api/dashboard",
            dashboardRoutes(client)
        );

        this.app.use(
            "/api/panel",
            panelRoutes(client)
        );

        // Painel do dono (arquivos estáticos servidos em /dashboard)
        this.app.use(
            "/dashboard",
            express.static(path.join(__dirname, "..", "..", "public", "dashboard"))
        );

        // Painel do servidor, login com Discord (arquivos estáticos em /panel)
        this.app.use(
            "/panel",
            express.static(path.join(__dirname, "..", "..", "public", "panel"))
        );

    }


    start(port = process.env.PORT || 3000) {

        console.log(`🌐 Iniciando API na porta ${port}...`);

        this.app.listen(port, "0.0.0.0", () => {

            console.log(
                `🌐 API online na porta ${port}`
            );

            console.log(
                `🖥️ Dashboard do dono em http://localhost:${port}/dashboard`
            );

            console.log(
                `🖥️ Painel de servidor em http://localhost:${port}/panel`
            );

        });

    }

}


module.exports = ApiServer;