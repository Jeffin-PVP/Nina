/*
Envia os PNGs de assets/emojis/ para os Application Emojis do bot
(Developer Portal → seu app → aba "Emojis").

Uso:
    npm run emojis            # envia só os que ainda não existem
    npm run emojis -- --force # apaga e reenvia todos (atualiza a arte)

Requer TOKEN e CLIENT_ID no .env.
*/

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const DIR = path.join(__dirname, "..", "assets", "emojis");
const force = process.argv.includes("--force");

(async () => {

    const { TOKEN, CLIENT_ID } = process.env;

    if (!TOKEN || !CLIENT_ID) {
        console.error("❌ Defina TOKEN e CLIENT_ID no .env.");
        process.exit(1);
    }

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    const files = fs.readdirSync(DIR)
        .filter(f => f.startsWith("ui_") && f.endsWith(".png"))
        .sort();

    const { items = [] } = await rest.get(Routes.applicationEmojis(CLIENT_ID));
    const existing = new Map(items.map(emoji => [emoji.name, emoji]));

    console.log(`📦 ${files.length} arquivos • ${existing.size} emojis já na aplicação${force ? " • modo --force" : ""}\n`);

    let created = 0, skipped = 0, failed = 0;

    for (const file of files) {

        const name = path.basename(file, ".png");
        const current = existing.get(name);

        if (current && !force) {
            skipped++;
            console.log(`⏭  ${name} (já existe)`);
            continue;
        }

        try {

            if (current) {
                await rest.delete(Routes.applicationEmoji(CLIENT_ID, current.id));
            }

            const image = `data:image/png;base64,${fs.readFileSync(path.join(DIR, file)).toString("base64")}`;

            await rest.post(Routes.applicationEmojis(CLIENT_ID), { body: { name, image } });

            created++;
            console.log(`✅ ${name}`);

        } catch (error) {

            failed++;
            console.error(`❌ ${name}: ${error.message}`);

        }

    }

    console.log(`\nConcluído: ${created} enviados, ${skipped} ignorados, ${failed} com erro.`);
    console.log("Reinicie a Nina para ela carregar os emojis.");

})().catch(error => {
    console.error("❌ Falha:", error.message);
    process.exit(1);
});
