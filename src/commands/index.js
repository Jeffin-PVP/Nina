const fs = require("fs");
const path = require("path");

const commands = {};

const CATEGORY_LABELS = {
    Autorole: "🎭 Cargos automáticos",
    Boasvindas: "👋 Boas-vindas",
    Economy: "💰 Economia",
    Games: "🎮 Jogos",
    Moderation: "🛡️ Moderação",
    Servidor: "🏗️ Servidor",
    Sorteios: "🎉 Sorteios",
    Tickets: "🎫 Tickets",
    Utility: "🔧 Utilidade",
    configuration: "⚙️ Configuração",
    AI: "🤖 Inteligência Artificial",
    Geral: "📌 Geral"
};

function load(dir, category = "Geral") {

    const files = fs.readdirSync(dir);

    for (const file of files) {

        const filePath = path.join(dir, file);

        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {

            // O nome da subpasta vira a categoria de todos os comandos dentro dela
            load(filePath, file);
            continue;

        }

        if (!file.endsWith(".js")) continue;

        if (file === "index.js") continue;

        const command = require(filePath);

        if (!command.data) continue;

        command.category = CATEGORY_LABELS[category] || `📌 ${category}`;

        commands[command.data.name] = command;

        console.log(
            `✔ Slash carregado: ${command.data.name}`
        );

    }

}

load(__dirname);

module.exports = commands;