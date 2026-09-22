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

        this.app.get("/teste", (req, res) => {
            res.status(200).send("NINA PUBLIC TEST OK");
        });

        this.app.use(cors());
        this.app.use(express.json());

        this.app.get("/", (req, res) => {

            res.send("<h1>Nina API funcionando! </h1> <h3> Caso esteja tentando acessar o painel de controle, acesse https://nina.injectcloud.space/panel/. <br> <br> Se quiser testar a API da Nina, acesse https://nina.injectcloud.space/teste.<h3/>");

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

        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🌐 CONFIGURAÇÃO DO SERVIDOR");
        console.log("PORT recebido:", process.env.PORT);
        console.log("PORT usado:", port);
        console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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