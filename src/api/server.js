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

        this.app.use(cors());
        this.app.use(express.json({ limit: "100kb" }));

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