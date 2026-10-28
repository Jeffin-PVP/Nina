/*
Troca emojis fixos do código por E("nome"), usando src/config/emojiRegistry.js.

  1) Marcações <:nome:id>  →  E("nome")            (sempre seguro: já eram emojis personalizados)
  2) Emojis normais (Unicode) → E("nome")          (só onde o Discord aceita emoji personalizado)
     conforme src/config/emojiMap.js

Em contextos que NÃO aceitam emoji personalizado (nome de canal, rótulo de botão,
rodapé/autor de embed, placeholder, descrição de slash command, console.log,
comparações...) o emoji Unicode é mantido.

Uso:
    node scripts/applyEmojis.js            # simulação: só mostra o que mudaria
    node scripts/applyEmojis.js --write    # aplica
    node scripts/applyEmojis.js --verbose  # lista também o que foi ignorado e por quê
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const write = process.argv.includes("--write");
const verbose = process.argv.includes("--verbose");
const registry = require("../src/config/emojiRegistry.json");
const unicodeMap = require("../src/config/emojiMap");

// Arquivos onde NÃO se troca Unicode (marcações <:x:id> continuam sendo trocadas em todos).
const SKIP_UNICODE = [
    /src[\\/]managers[\\/]ServerBuilderManager\.js$/, // nomes de canais/categorias do servidor-modelo
    /src[\\/]config[\\/]/, /src[\\/]utils[\\/]emojis\.js$/,
    /src[\\/]ai[\\/]/,                                // prompts e emojis de expressão da IA
    /src[\\/]commands[\\/]index\.js$/,                // rótulos de categoria usados em select menus
    /src[\\/]commands[\\/]Games[\\/]slots\.js$/,      // símbolos do jogo
    /src[\\/]database[\\/]/,                       // valores padrão gravados no banco (nomes de canal, texto de imagem)
    /TempVoiceManager\.js$/,                         // monta nomes de canais de voz
    /ConfigPanelManager\.js$/,                       // rótulos de contadores/menus do /config
    /WelcomeCardManager\.js$/,                       // texto desenhado em imagem (canvas)
    /(^|[\\/])index\.js$/                            // só mensagens de console
];
const SKIP_ALL = [/src[\\/]config[\\/]emoji/];

const DENY = [
    [/console\./, "console"], [/name_template|\btag\s*:|\breason\s*:|\bnick(name)?\s*:|\busername\s*:/, "nome/motivo de auditoria"], [/\.setFooter\(|\bfooter\s*:/, "rodapé de embed"], [/\.setAuthor\(|\bauthor\s*:/, "autor de embed"],
    [/\.setLabel\(|\blabel\s*:/, "rótulo de botão/menu"], [/\.setPlaceholder\(|\bplaceholder\s*:/, "placeholder"],
    [/\.setName\(/, "nome"], [/addChoices|\bchoices\b/, "choices"], [/throw new/, "erro interno"],
    [/customId|setCustomId/, "customId"], [/===|!==|==\s|\bcase\s/, "comparação"], [/\.react\(/, "reação"],
    [/ModalBuilder|\.setTitle\(.*[Mm]odal/, "modal"], [/\bvalue\s*:.*\bdescription\s*:|\bdescription\s*:.*\bvalue\s*:/, "opção de select"]
];

const KEYWORDS_BEFORE_REGEX = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do"]);

// ---------- scanner de literais (strings e templates) ----------
function scan(src) {
    const lits = [];
    let i = 0;
    function template() {
        const start = i; i++;
        const parts = []; let segStart = i;
        while (i < src.length) {
            const ch = src[i];
            if (ch === "\\") { i += 2; continue; }
            if (ch === "`") { parts.push({ start: segStart, end: i }); i++; break; }
            if (ch === "$" && src[i + 1] === "{") { parts.push({ start: segStart, end: i }); i += 2; code(true); segStart = i; continue; }
            i++;
        }
        lits.push({ kind: "tpl", start, end: i, parts });
    }
    function code(untilBrace) {
        let depth = 0, operand = false;
        while (i < src.length) {
            const c = src[i], n = src[i + 1];
            if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
            if (c === "/" && n === "*") { const j = src.indexOf("*/", i + 2); i = j < 0 ? src.length : j + 2; continue; }
            if (c === '"' || c === "'") {
                const start = i; i++;
                while (i < src.length && src[i] !== c && src[i] !== "\n") { if (src[i] === "\\") i++; i++; }
                i++; lits.push({ kind: "str", q: c, start, end: i }); operand = true; continue;
            }
            if (c === "`") { template(); operand = true; continue; }
            if (c === "/") {
                if (!operand) {
                    i++; let cls = false;
                    while (i < src.length && src[i] !== "\n") {
                        const ch = src[i];
                        if (ch === "\\") { i += 2; continue; }
                        if (ch === "[") cls = true; else if (ch === "]") cls = false;
                        else if (ch === "/" && !cls) { i++; break; }
                        i++;
                    }
                    operand = true;
                } else { i++; operand = false; }
                continue;
            }
            if (c === "{") { depth++; i++; operand = false; continue; }
            if (c === "}") { if (untilBrace && depth === 0) { i++; return; } depth--; i++; operand = true; continue; }
            if (/[A-Za-z0-9_$]/.test(c)) {
                const s = i; while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) i++;
                operand = !KEYWORDS_BEFORE_REGEX.has(src.slice(s, i)); continue;
            }
            if (c === ")" || c === "]") { operand = true; i++; continue; }
            if (/\s/.test(c)) { i++; continue; }
            operand = false; i++;
        }
    }
    code(false);
    return lits;
}

// ---------- conversão do conteúdo de um literal ----------
const uniKeys = Object.keys(unicodeMap).sort((a, b) => b.length - a.length);
const MARKUP = /<a?:([A-Za-z0-9_]+):\d{15,}>/y;

function tokenize(raw, { allowUni, isStr, q }) {
    const pieces = []; let text = ""; let changed = false; let skippedUni = 0;
    const flush = () => { if (text) { pieces.push({ text }); text = ""; } };
    for (let k = 0; k < raw.length;) {
        MARKUP.lastIndex = k;
        const m = MARKUP.exec(raw);
        if (m && registry[m[1]]) { flush(); pieces.push({ key: m[1] }); k += m[0].length; changed = true; continue; }
        const uni = uniKeys.find(u => raw.startsWith(u, k));
        if (uni) {
            if (allowUni) { flush(); pieces.push({ key: unicodeMap[uni] }); changed = true; }
            else { text += uni; skippedUni++; }
            k += uni.length; continue;
        }
        const ch = raw[k];
        if (ch === "\\") {
            const nx = raw[k + 1] ?? "";
            text += isStr && (nx === q || nx === '"' || nx === "'") ? nx : ch + nx;
            k += 2; continue;
        }
        if (isStr && ch === "`") text += "\\`";
        else if (isStr && ch === "$" && raw[k + 1] === "{") text += "\\$";
        else text += ch;
        k++;
    }
    flush();
    return { pieces, changed, skippedUni };
}

// ---------- processa um arquivo ----------
function process_(file, src) {
    const rel = path.relative(ROOT, file);
    const alias = /\bE\b/.test(src) ? "NinaE" : "E";
    const unicodeAllowedFile = !SKIP_UNICODE.some(r => r.test(file));
    const isSlashFile = src.includes("SlashCommandBuilder");
    const execIdx = isSlashFile ? src.search(/async execute\s*\(|\bexecute\s*\(/) : -1;
    const stats = { markup: 0, unicode: 0, skipped: [] };
    const edits = [];

    function lineInfo(pos) {
        const ls = src.lastIndexOf("\n", pos - 1) + 1;
        let le = src.indexOf("\n", pos); if (le < 0) le = src.length;
        return { line: src.slice(ls, le), lineNo: src.slice(0, pos).split("\n").length };
    }
    function context(pos) {
        if (!unicodeAllowedFile) return { ok: false, why: "arquivo ignorado para Unicode" };
        if (execIdx > 0 && pos < execIdx) return { ok: false, why: "definição de slash command" };
        const { line } = lineInfo(pos);
        const prev = src.slice(0, src.lastIndexOf("\n", pos - 1)).split("\n").slice(-2).join(" ");
        if (/console\.\w+\(\s*$/.test(prev) && /^\s*["'`]/.test(line)) return { ok: false, why: "console" };
        const before = line.slice(0, Math.max(0, pos - (src.lastIndexOf("\n", pos - 1) + 1)));
        if (/\bbutton\s*\(\s*[^,()]+,\s*$/.test(before)) return { ok: false, why: "rótulo de botão" };
        if (/^\s*(recording|processing|ready|failed|pending|none|disabled)\s*:/.test(line)) return { ok: false, why: "status usado em select" };
        for (const [re, why] of DENY) if (re.test(line)) return { ok: false, why };
        if (/\bname\s*:/.test(line) && !/\bvalue\s*:/.test(line)) return { ok: false, why: "name:" };
        return { ok: true };
    }
    const count = pieces => pieces.filter(p => p.key).length;

    for (const lit of scan(src)) {
        if (lit.kind === "str") {
            const raw = src.slice(lit.start + 1, lit.end - 1);
            if (!/<a?:|[^\x00-\u2000]/.test(raw)) continue;
            const ctx = context(lit.start);
            const { pieces, changed, skippedUni } = tokenize(raw, { allowUni: ctx.ok, isStr: true, q: lit.q });
            if (skippedUni && !ctx.ok) stats.skipped.push({ ...lineInfo(lit.start), why: ctx.why });
            if (!changed) continue;
            const markupCount = (raw.match(/<a?:[A-Za-z0-9_]+:\d{15,}>/g) || []).length;
            stats.markup += Math.min(markupCount, count(pieces)); stats.unicode += Math.max(0, count(pieces) - markupCount);
            const rep = pieces.length === 1 && pieces[0].key
                ? `${alias}("${pieces[0].key}")`
                : "`" + pieces.map(p => (p.key ? `\${${alias}("${p.key}")}` : p.text)).join("") + "`";
            edits.push({ start: lit.start, end: lit.end, rep });
        } else {
            for (const part of lit.parts) {
                const raw = src.slice(part.start, part.end);
                if (!/<a?:|[^\x00-\u2000]/.test(raw)) continue;
                const ctx = context(part.start);
                const { pieces, changed, skippedUni } = tokenize(raw, { allowUni: ctx.ok, isStr: false });
                if (skippedUni && !ctx.ok) stats.skipped.push({ ...lineInfo(part.start), why: ctx.why });
                if (!changed) continue;
                const markupCount = (raw.match(/<a?:[A-Za-z0-9_]+:\d{15,}>/g) || []).length;
                stats.markup += Math.min(markupCount, count(pieces)); stats.unicode += Math.max(0, count(pieces) - markupCount);
                edits.push({ start: part.start, end: part.end, rep: pieces.map(p => (p.key ? `\${${alias}("${p.key}")}` : p.text)).join("") });
            }
        }
    }
    if (!edits.length) return { rel, stats, out: null };

    edits.sort((a, b) => b.start - a.start);
    let out = src;
    for (const ed of edits) out = out.slice(0, ed.start) + ed.rep + out.slice(ed.end);

    // import no topo (depois de comentários iniciais e de "use strict")
    const eol = src.includes("\r\n") ? "\r\n" : "\n";
    let pos = 0;
    for (;;) {
        const rest = out.slice(pos);
        const ws = /^\s+/.exec(rest); if (ws) { pos += ws[0].length; continue; }
        if (rest.startsWith("/*")) { const j = out.indexOf("*/", pos + 2); pos = j < 0 ? out.length : j + 2; continue; }
        if (rest.startsWith("//")) { const j = out.indexOf("\n", pos); pos = j < 0 ? out.length : j + 1; continue; }
        const us = /^(["'])use strict\1;?/.exec(rest); if (us) { pos += us[0].length; continue; }
        break;
    }
    let relPath = path.relative(path.dirname(file), path.join(ROOT, "src", "config", "emojiRegistry")).split(path.sep).join("/");
    if (!relPath.startsWith(".")) relPath = "./" + relPath;
    const imp = `const { E${alias === "E" ? "" : ": " + alias} } = require("${relPath}");${eol}`;
    out = out.slice(0, pos) + (pos > 0 ? "" : "") + imp + out.slice(pos);
    return { rel, stats, out };
}

function walk(dir, acc = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { if (f !== "node_modules") walk(p, acc); }
        else if (f.endsWith(".js")) acc.push(p);
    }
    return acc;
}

const files = [...walk(path.join(ROOT, "src")), path.join(ROOT, "index.js")].filter(f => !SKIP_ALL.some(r => r.test(f)));
let totalMarkup = 0, totalUni = 0, changedFiles = 0, skippedTotal = 0, failures = 0;
const skippedByWhy = {};

for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    let result;
    try { result = process_(file, src); } catch (error) { console.error(`✖ ${path.relative(ROOT, file)}: ${error.message}`); failures++; continue; }
    for (const s of result.stats.skipped) { skippedTotal++; skippedByWhy[s.why] = (skippedByWhy[s.why] || 0) + 1; if (verbose) console.log(`  ignorado (${s.why}) ${result.rel}:${s.lineNo}  ${s.line.trim().slice(0, 110)}`); }
    if (!result.out) continue;
    totalMarkup += result.stats.markup; totalUni += result.stats.unicode; changedFiles++;
    console.log(`${write ? "✔" : "•"} ${result.rel}  marcações: ${result.stats.markup}  unicode: ${result.stats.unicode}`);
    if (write) {
        fs.writeFileSync(file, result.out);
        try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
        catch (error) { fs.writeFileSync(file, src); failures++; console.error(`✖ ${result.rel}: erro de sintaxe após a troca; arquivo restaurado.`); }
    }
}
console.log(`\n${write ? "Aplicado" : "Simulação"}: ${changedFiles} arquivo(s) · ${totalMarkup} marcação(ões) → E() · ${totalUni} emoji(s) Unicode → E()`);
console.log(`Emojis Unicode mantidos por contexto sem suporte: ${skippedTotal}`, skippedTotal ? JSON.stringify(skippedByWhy) : "");
if (failures) { console.error(`${failures} falha(s).`); process.exitCode = 1; }
if (!write) console.log("Nada foi gravado. Use --write para aplicar (ou --verbose para ver os ignorados).");
