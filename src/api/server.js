
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

        // CORS restrito ao endereço público do painel/dashboard. Como o site é
        // servido por este mesmo servidor, requisições do próprio site não
        // dependem de CORS; qualquer outra origem fica bloqueada.
        let corsOrigin = false;

        try {
            if (process.env.PUBLIC_URL) {
                corsOrigin = new URL(process.env.PUBLIC_URL).origin;
            }
        } catch {
            console.warn("[API] PUBLIC_URL inválida; CORS desativado para outras origens.");
        }

        this.app.use(cors({ origin: corsOrigin }));

        // Atrás de proxy reverso (Railway, Render, etc.) o IP real vem em
        // X-Forwarded-For; sem isso, o limite de tentativas de login do
        // dashboard enxergaria todos como o mesmo IP do proxy.
        if (process.env.TRUST_PROXY) {
            const valor = process.env.TRUST_PROXY;
            this.app.set("trust proxy", /^\d+$/.test(valor) ? Number(valor) : valor);
        }
        this.app.use(express.json({ limit: "100kb" }));
        this.app.use(express.urlencoded({ extended: true }));

        // ==========================================
        // UNVEIL - WEBHOOK DE VOTOS
        // ==========================================
        this.app.post("/api/unveil/vote", async (req, res) => {
            try {
                const secret = process.env.UNVEIL_WEBHOOK_SECRET;
                const authorization = req.get("Authorization");

                // Confere a senha configurada no Unveil.
                if (!secret || authorization !== secret) {
                    console.warn("[Unveil Vote] Autorização inválida.");
                    return res.sendStatus(401);
                }

                const { bot, user, type } = req.body || {};

                // Não registrar tokens, senhas ou cabeçalhos de autorização.
                console.log("[Unveil Vote] Payload recebido:", {
                    bot: bot ?? null,
                    user: user ?? null,
                    type: type ?? null,
                    isReady: this.client.isReady(),
                    botId: this.client.user?.id ?? null,
                });

                // Se o bot ainda estiver iniciando, não processa o voto.
                if (!this.client.isReady()) {
                    console.warn("[Unveil Vote] Bot ainda não está pronto.");
                    return res.sendStatus(503);
                }

                // Testes do painel podem não trazer os mesmos campos de um voto.
                // Eventos que não forem votos válidos são ignorados com sucesso.
                if (
                    !user ||
                    type !== "upvote" ||
                    !/^\d{17,20}$/.test(String(user))
                ) {
                    console.log(
                        "[Unveil Vote] Teste ou evento não contabilizado."
                    );
                    return res.sendStatus(204);
                }

                // Impede contabilizar um voto destinado a outro bot.
                if (bot && String(bot) !== this.client.user.id) {
                    console.warn(
                        "[Unveil Vote] O ID recebido não corresponde à Nina."
                    );
                    return res.sendStatus(204);
                }

                const channelId = process.env.UNVEIL_VOTE_CHANNEL_ID;
                const voteUrl = process.env.UNVEIL_VOTE_URL;

                if (!channelId) {
                    console.error(
                        "[Unveil Vote] UNVEIL_VOTE_CHANNEL_ID não configurado."
                    );
                    return res.sendStatus(500);
                }

                const channel =
                    await this.client.channels.fetch(channelId).catch(() => null);

                if (!channel || !channel.isTextBased() || !channel.send) {
                    console.error(
                        "[Unveil Vote] Canal não encontrado ou não é de texto."
                    );
                    return res.sendStatus(500);
                }

                // Salva a contagem de votos recebidos desde a instalação.
                const dataDir = path.join(__dirname, "..", "..", "data");
                const votesFile = path.join(dataDir, "unveil-votes.json");

                fs.mkdirSync(dataDir, { recursive: true });

                let votes = {};

                if (fs.existsSync(votesFile)) {
                    try {
                        votes = JSON.parse(
                            fs.readFileSync(votesFile, "utf8")
                        );
                    } catch (error) {
                        console.error(
                            "[Unveil Vote] Erro ao ler o arquivo de votos:",
                            error.message
                        );
                    }
                }

                votes[String(user)] = (votes[String(user)] || 0) + 1;

                fs.writeFileSync(
                    votesFile,
                    JSON.stringify(votes, null, 2),
                    "utf8"
                );

                const embed = new EmbedBuilder()
                    .setColor(0xf569ff)
                    .setTitle("🌟 A Nina recebeu um voto!")
                    .setDescription(
                        `<@${user}> votou na Nina pelo Unveil. Obrigado pelo apoio!`
                    )
                    .addFields(
                        {
                            name: "📊 Votos deste usuário",
                            value: String(votes[String(user)]),
                            inline: true,
                        },
                        {
                            name: "🤖 Bot",
                            value: this.client.user.username,
                            inline: true,
                        }
                    )
                    .setTimestamp();

                const components = [];

                if (voteUrl) {
                    components.push(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel("Votar na Nina")
                                .setStyle(ButtonStyle.Link)
                                .setURL(voteUrl)
                        )
                    );
                }

                await channel.send({
                    embeds: [embed],
                    components,
                });

                console.log(
                    `[Unveil Vote] Voto de ${user} processado com sucesso.`
                );

                // O webhook espera uma resposta HTTP 2xx.
                return res.sendStatus(204);
            } catch (error) {
                console.error("[Unveil Vote] Erro no webhook:", error);
                return res.sendStatus(500);
            }
        });

        // ==========================================
        // ROTAS DA API E PAINÉIS EXISTENTES
        // ==========================================
        // Cada módulo exporta uma função que recebe o client e devolve o Router.
        // Montar a função direto no Express faria toda requisição ficar pendurada.
        this.app.use("/api/dashboard", dashboardRoutes(this.client));
        this.app.use("/api/panel", panelRoutes(this.client));
        this.app.use("/api", routes(this.client));

        // Os arquivos do site ficam na pasta public, na raiz do projeto.
        const publicDir = path.join(__dirname, "..", "..", "public");

        this.app.use(
            "/dashboard",
            express.static(path.join(publicDir, "dashboard"), { index: "index.html" })
        );

        this.app.use(
            "/panel",
            express.static(path.join(publicDir, "panel"), { index: "index.html" })
        );

        // Verificação simples de disponibilidade.
        this.app.get("/health", (req, res) => {
            res.status(200).json({
                status: "ok",
                botReady: this.client.isReady(),
            });
        });

        this.app.get("/", (req, res) => {
            res.status(200).send("Nina API online!");
        });
    }

    start(port = process.env.PORT || 3000) {
        this.server = this.app.listen(port, () => {
            console.log(`[API] Servidor iniciado na porta ${port}.`);
        });

        return this.server;
    }
}

module.exports = ApiServer;
