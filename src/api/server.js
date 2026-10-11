
const path = require("path");
const fs = require("fs");

const express = require("express");
const cors = require("cors");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const routes = require("./routes");
const dashboardRoutes = require("./dashboardRoutes");
const panelRoutes = require("./panelRoutes");

class ApiServer {
    constructor(client) {
        this.client = client;
        this.app = express();

        this.app.disable("x-powered-by");

        // Configuração do proxy reverso da hospedagem.
        const trustProxy = process.env.TRUST_PROXY ?? "1";

        this.app.set(
            "trust proxy",
            /^\d+$/.test(trustProxy)
                ? Number(trustProxy)
                : trustProxy
        );

        // Health checks.
        this.app.get("/teste", (req, res) => {
            res.status(200).send("NINA PUBLIC TEST OK");
        });

        this.app.get("/health", (req, res) => {
            res.status(200).json({ ok: true });
        });

        // CORS para os painéis.
        let origemPermitida = false;

        try {
            if (process.env.PUBLIC_URL) {
                origemPermitida = new URL(
                    process.env.PUBLIC_URL
                ).origin;
            }
        } catch {
            // Mantém o CORS fechado se PUBLIC_URL for inválida.
        }

        this.app.use(cors({ origin: origemPermitida }));

        this.app.use(express.json({ limit: "100kb" }));

        // ==========================================
        // UNVEIL - NOTIFICAÇÕES DE VOTO
        // ==========================================

        this.app.post(
            "/api/unveil/vote",
            async (req, res) => {
                const secret =
                    process.env.UNVEIL_WEBHOOK_SECRET;

                if (!secret) {
                    console.error(
                        "[Unveil Vote] Segredo não configurado."
                    );

                    return res.sendStatus(503);
                }

                // Confere o segredo enviado pelo Unveil.
                if (
                    req.get("Authorization") !== secret
                ) {
                    console.warn(
                        "[Unveil Vote] Autorização inválida."
                    );

                    return res.sendStatus(401);
                }

                const { bot, user, type, isWeekend } =
                    req.body || {};

                // O bot precisa estar conectado ao Discord.
                if (!this.client.isReady()) {
                    console.warn(
                        "[Unveil Vote] Nina ainda não está pronta."
                    );

                    return res.sendStatus(503);
                }

                // Se o payload informar o bot, confere seu ID.
                if (
                    bot &&
                    bot !== this.client.user.id
                ) {
                    console.warn(
                        "[Unveil Vote] ID do bot não corresponde."
                    );

                    return res.sendStatus(400);
                }

                // O teste do painel pode não representar um voto real.
                // Confirma o recebimento sem publicar um voto falso.
                if (!user || !type) {
                    console.log(
                        "[Unveil Vote] Notificação de teste recebida."
                    );

                    return res.sendStatus(204);
                }

                // Ignora eventos que não sejam votos válidos.
                if (
                    !/^\d{17,20}$/.test(String(user)) ||
                    type !== "upvote"
                ) {
                    console.warn(
                        "[Unveil Vote] Payload de voto inválido."
                    );

                    return res.sendStatus(400);
                }

                const channelId =
                    process.env.UNVEIL_VOTE_CHANNEL_ID;

                const voteUrl =
                    process.env.UNVEIL_VOTE_URL;

                if (!channelId) {
                    console.error(
                        "[Unveil Vote] Canal não configurado."
                    );

                    return res.sendStatus(503);
                }

                try {
                    const channel =
                        await this.client.channels.fetch(
                            channelId
                        );

                    if (
                        !channel ||
                        !channel.isTextBased() ||
                        typeof channel.send !== "function"
                    ) {
                        console.error(
                            "[Unveil Vote] Canal inválido."
                        );

                        return res.sendStatus(500);
                    }

                    // Contagem local dos votos recebidos.
                    const dataDir = path.join(
                        __dirname,
                        "..",
                        "..",
                        "data"
                    );

                    const votesFile = path.join(
                        dataDir,
                        "unveil-votes.json"
                    );

                    fs.mkdirSync(dataDir, {
                        recursive: true,
                    });

                    let votes = {};

                    if (fs.existsSync(votesFile)) {
                        try {
                            votes = JSON.parse(
                                fs.readFileSync(
                                    votesFile,
                                    "utf8"
                                )
                            );

                            if (
                                !votes ||
                                typeof votes !== "object" ||
                                Array.isArray(votes)
                            ) {
                                throw new Error(
                                    "Formato inválido"
                                );
                            }
                        } catch (error) {
                            console.error(
                                "[Unveil Vote] Erro ao ler contagem:",
                                error.message
                            );

                            return res.sendStatus(500);
                        }
                    }

                    const count =
                        (Number(votes[user]) || 0) + 1;

                    const member =
                        await this.client.users
                            .fetch(user)
                            .catch(() => null);

                    const mention = `<@${user}>`;

                    const embed = new EmbedBuilder()
                        .setColor(0xf569ff)
                        .setTitle(
                            "💜 Obrigado por votar na Nina!"
                        )
                        .setDescription(
                            `🔔 ${mention} acabou de votar na Nina!\n\n` +
                            `Esse usuário já votou **${count} vez(es)** ` +
                            "desde que a contagem local foi iniciada.\n\n" +
                            "Seu apoio ajuda a Nina a crescer. " +
                            "Vote também e faça parte da comunidade!"
                        )
                        .setTimestamp();

                    if (member) {
                        embed.setThumbnail(
                            member.displayAvatarURL()
                        );
                    }

                    if (isWeekend === true) {
                        embed.addFields({
                            name: "🎉 Voto de fim de semana",
                            value:
                                "Obrigado pelo apoio especial!",
                        });
                    }

                    const components = [];

                    if (voteUrl) {
                        let parsedUrl;

                        try {
                            parsedUrl = new URL(voteUrl);

                            if (
                                parsedUrl.protocol !== "https:"
                            ) {
                                throw new Error(
                                    "A URL precisa usar HTTPS."
                                );
                            }
                        } catch (error) {
                            console.error(
                                "[Unveil Vote] URL inválida:",
                                error.message
                            );

                            return res.sendStatus(500);
                        }

                        components.push(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setLabel("Votar na Nina")
                                    .setStyle(
                                        ButtonStyle.Link
                                    )
                                    .setURL(
                                        parsedUrl.toString()
                                    )
                                    .setEmoji("💜")
                            )
                        );
                    }

                    // Envia a mensagem antes de salvar a contagem.
                    await channel.send({
                        embeds: [embed],
                        components,
                        allowedMentions: {
                            users: [user],
                        },
                    });

                    votes[user] = count;

                    fs.writeFileSync(
                        votesFile,
                        JSON.stringify(votes, null, 2),
                        "utf8"
                    );

                    console.log(
                        `[Unveil Vote] Voto de ${user} processado. ` +
                        `Total local: ${count}`
                    );

                    return res.sendStatus(204);
                } catch (error) {
                    console.error(
                        "[Unveil Vote] Erro ao processar voto:",
                        error
                    );

                    return res.sendStatus(500);
                }
            }
        );

        // ==========================================
        // PÁGINA INICIAL
        // ==========================================

        this.app.get("/", (req, res) => {
            const base = process.env.PUBLIC_URL
                ? process.env.PUBLIC_URL.replace(/\/+$/, "")
                : "";

            res.status(200).send(
                `<!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Nina API</title>
                </head>
                <body>
                    <h1>Nina API funcionando!</h1>
                    <h3>
                        Painel de controle:
                        <a href="${base}/panel/">${base}/panel/</a>
                    </h3>
                </body>
                </html>`
            );
        });

        // ==========================================
        // ROTAS DA API E PAINÉIS
        // ==========================================

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

        this.app.use(
            "/dashboard",
            express.static(
                path.join(
                    __dirname,
                    "..",
                    "..",
                    "public",
                    "dashboard"
                )
            )
        );

        this.app.use(
            "/panel",
            express.static(
                path.join(
                    __dirname,
                    "..",
                    "..",
                    "public",
                    "panel"
                )
            )
        );
    }

    start(port = process.env.PORT || 3000) {
        console.log(
            `🌐 Iniciando API na porta ${port}...`
        );

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
