require("dotenv").config();

const fs = require("fs");
const path = require("path");
// oi
const {
    REST,
    Routes
} = require("discord.js");

const commands = [];

const commandsPath = path.join(
    __dirname,
    "src",
    "commands"
);

function loadCommands(dir) {

    if (!fs.existsSync(dir))
        return;

    const files = fs.readdirSync(dir);

    for (const file of files) {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {

            loadCommands(filePath);
            continue;

        }

        if (!file.endsWith(".js"))
            continue;

        const command = require(filePath);

        if (!command.data) {

            console.warn(
                `⚠ Ignorando ${file} (sem data).`
            );

            continue;

        }

        commands.push(
            command.data.toJSON()
        );

        console.log(
            `✔ ${command.data.name}`
        );

    }

}

loadCommands(commandsPath);

const rest = new REST({

    version: "10"

}).setToken(process.env.TOKEN);

(async () => {

    try {

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(
            `📦 Registrando ${commands.length} comandos...`
        );

        await rest.put(

            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),

            {

                body: commands

            }

        );

        console.log("✅ Deploy concluído.");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {

        console.error(error);

    }

})();
//
//
//
//
//
//git