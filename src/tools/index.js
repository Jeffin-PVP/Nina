const fs = require("fs");
const path = require("path");

const tools = {};
const categories = {};
let totalTools = 0;

/**
 * Carrega todas as ferramentas recursivamente.
 */
function loadTools(dir) {

    const files = fs.readdirSync(dir);

    for (const file of files) {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Entra nas subpastas
        if (stat.isDirectory()) {
            loadTools(filePath);
            continue;
        }

        // Apenas arquivos JS
        if (!file.endsWith(".js")) continue;

        // Ignora arquivos especiais
        if (["index.js", "schema.js"].includes(file)) continue;

        let tool;

        try {

            tool = require(filePath);

        } catch (err) {

            console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.error(`❌ Erro ao carregar: ${file}`);
            console.error(err);
            console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

            continue;

        }

        // Verifica se exportou corretamente
        if (!tool || typeof tool !== "object") {

            console.warn(`⚠ ${file} não exportou um objeto.`);
            continue;

        }

        if (!tool.name) {

            console.warn(`⚠ ${file} não possui "name".`);
            continue;

        }

        if (typeof tool.execute !== "function") {

            console.warn(`⚠ ${file} não possui execute().`);
            continue;

        }

        if (tools[tool.name]) {

            console.warn(`⚠ Ferramenta duplicada: ${tool.name}`);
            continue;

        }

        tools[tool.name] = tool;

        totalTools++;

        const category = tool.category || "Outros";

        if (!categories[category]) {
            categories[category] = [];
        }

        categories[category].push(tool.name);

    }

}

loadTools(__dirname);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🛠 Ferramentas carregadas\n");

if (Object.keys(categories).length === 0) {

    console.log("⚠ Nenhuma ferramenta encontrada.\n");

} else {

    for (const category of Object.keys(categories).sort()) {

        console.log(`📂 ${category}`);

        for (const tool of categories[category].sort()) {

            console.log(`   ✔ ${tool}`);

        }

        console.log("");

    }

}

console.log(`📊 Total: ${totalTools} ferramenta(s)`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

module.exports = tools;