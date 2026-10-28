/*
Atualiza src/config/emojiRegistry.json com TODOS os emojis do Developer Portal.

Uso:
    node scripts/syncEmojiRegistry.js            # lê emojis.txt (se existir); senão busca na API
    node scripts/syncEmojiRegistry.js --api      # força buscar na API (precisa de TOKEN e CLIENT_ID no .env)
    node scripts/syncEmojiRegistry.js --check    # só confere: quais E("nome") do código ainda não têm emoji personalizado

Fluxo para adicionar emoji novo:
    1. Suba o emoji no Developer Portal (aba Emojis)
    2. node scripts/syncEmojiRegistry.js --api
    3. Use no código:  E("nome_do_emoji")
*/
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REGISTRY_FILE = path.join(ROOT, "src", "config", "emojiRegistry.json");
const TXT_FILE = path.join(ROOT, "emojis.txt");
const MARKUP = /<a?:([A-Za-z0-9_]+):\d{15,}>/g;

function walk(dir, acc = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { if (f !== "node_modules") walk(p, acc); }
        else if (f.endsWith(".js")) acc.push(p);
    }
    return acc;
}

function check() {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    const { FALLBACK_UI, FALLBACK_MAP } = require("../src/config/emojiRegistry");
    const used = new Map();
    const re = /\b(?:E|NinaE|e|component)\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*[,)]/g;
    for (const file of [...walk(path.join(ROOT, "src")), path.join(ROOT, "index.js")].filter(f => !/src[\\/]config[\\/]/.test(f))) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(re)) {
            const set = used.get(m[1]) || new Set(); set.add(path.relative(ROOT, file)); used.set(m[1], set);
        }
    }
    const has = n => registry[n] || registry[`ui_${n}`] || (n.startsWith("ui_") && registry[n.slice(3)]);
    const missing = [...used.keys()].filter(n => !has(n)).sort();
    console.log(`${used.size} nome(s) usados no código · ${used.size - missing.length} com emoji personalizado · ${missing.length} usando Unicode:\n`);
    for (const n of missing) {
        const fb = FALLBACK_MAP[n] ?? FALLBACK_MAP[`ui_${n}`] ?? FALLBACK_UI[n] ?? "(sem fallback → ▫️)";
        console.log(`  ${n.padEnd(22)} ${fb}   em ${[...used.get(n)].slice(0, 2).join(", ")}`);
    }
    if (missing.length) console.log("\nCrie esses emojis no portal com o mesmo nome (ou com prefixo ui_) e rode --api.");
}

async function main() {
    if (process.argv.includes("--check")) return check();

    let entries = {};
    if (!process.argv.includes("--api") && fs.existsSync(TXT_FILE)) {
        const txt = fs.readFileSync(TXT_FILE, "utf8");
        for (const m of txt.matchAll(MARKUP)) entries[m[1]] = m[0];
        console.log(`📄 Lido de emojis.txt`);
    } else {
        const { REST, Routes } = require("discord.js");
        const { TOKEN, CLIENT_ID } = process.env;
        if (!TOKEN || !CLIENT_ID) { console.error("❌ Defina TOKEN e CLIENT_ID no .env (ou gere emojis.txt com scripts/listEmojis.js)."); process.exit(1); }
        const { items } = await new REST({ version: "10" }).setToken(TOKEN).get(Routes.applicationEmojis(CLIENT_ID));
        for (const e of items) entries[e.name] = `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;
        console.log("🌐 Lido da API do Discord");
    }
    if (!Object.keys(entries).length) { console.error("❌ Nenhum emoji encontrado; registro não alterado."); process.exit(1); }

    const old = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase())));
    const added = Object.keys(sorted).filter(k => !(k in old));
    const removed = Object.keys(old).filter(k => !(k in sorted));
    const changed = Object.keys(sorted).filter(k => k in old && old[k] !== sorted[k]);
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(sorted, null, 2) + "\n");

    console.log(`\n✅ emojiRegistry.json atualizado: ${Object.keys(sorted).length} emoji(s)`);
    if (added.length) console.log(`  + novos (${added.length}): ${added.join(", ")}`);
    if (changed.length) console.log(`  ~ ID alterado (${changed.length}): ${changed.join(", ")}`);
    if (removed.length) console.log(`  - removidos do portal (${removed.length}): ${removed.join(", ")}\n    (se o código ainda usa algum, ele cai no Unicode; rode --check)`);
    console.log("\nReinicie o bot para carregar o novo registro.");
}

main().catch(error => { console.error("❌ Falha:", error.message); process.exit(1); });
