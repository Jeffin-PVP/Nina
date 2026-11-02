const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const net = require("node:net");

const database = require("../database/database");
const AiRepository = require("../database/repositories/AiRepository");
const lazyGroq = require("./lazyGroq");
const { validateHttpUrl, isPrivateIp } = require("../utils/safeFetch");

/*
=========================
    PROVEDORES DE IA POR SERVIDOR
=========================
Cada servidor pode:
  - desligar a IA por completo (ai_guild_config.enabled);
  - usar a API padrão da Nina (modo "default");
  - usar a própria API (modo "custom"), com uma chave para tudo (escopo "all")
    ou uma chave por funcionalidade (escopo "per_feature"). Funcionalidade sem
    chave própria continua usando a API padrão da Nina.

As chaves ficam criptografadas (AES-256-GCM) e nunca são devolvidas por inteiro.
Defina AI_KEYS_SECRET no .env (sem ele usa CLIENT_SECRET / TOKEN como base).
*/

const FEATURES = {
    chat: { label: "Conversar", description: "Menção à Nina e /ia", env: "GROQ_API_KEY" },
    tickets: { label: "Tickets", description: "Atendimento e resumo dos tickets", env: "GROQ_API_KEY" },
    antiscam: { label: "Anti-Scam", description: "Análise de imagens (precisa de modelo com visão)", env: "ANTISCAM_GROQ_API_KEY" },
    security: { label: "Security Center", description: "Análise contextual do TopicGuard", env: "GROQ_API_KEY" },
    embed: { label: "Embeds com IA", description: "Gerador de embeds", env: "EMBED_GROQ_API_KEY" },
    builder: { label: "Criar servidor", description: "Criador de servidor com IA", env: "GROQ_CRIAR_SERVIDOR_API_KEY" }
};

const PROVIDERS = {
    groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
    openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
    openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
    custom: { label: "Outra (compatível com OpenAI)", baseUrl: null, model: null }
};

const SCOPE_ALL = "all";

class AiError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

/* ---------- criptografia ---------- */

function secretKey() {
    const secret = process.env.AI_KEYS_SECRET || process.env.CLIENT_SECRET || process.env.TOKEN;
    if (!secret) return null;
    return crypto.createHash("sha256").update(`nina-ai-keys:${secret}`).digest();
}

function encrypt(plain) {
    const key = secretKey();
    if (!key) throw new AiError("Defina AI_KEYS_SECRET no .env do bot para guardar chaves com segurança.", "NO_SECRET");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

function decrypt(payload) {
    const key = secretKey();
    if (!key) return null;
    try {
        const [version, iv, tag, data] = String(payload).split(":");
        if (version !== "v1") return null;
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
        decipher.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}

/* ---------- cliente padrão (chaves do .env da Nina) ---------- */

const defaultClients = new Map();

function defaultClient(feature) {
    const env = FEATURES[feature].env;
    if (!process.env[env]) return null;
    if (!defaultClients.has(env)) defaultClients.set(env, lazyGroq(env));
    return defaultClients.get(env);
}

/* ---------- cliente da API do servidor (OpenAI-compatível) ---------- */

async function assertPublicHost(baseUrl) {
    const { hostname } = new URL(baseUrl);
    const host = hostname.replace(/^\[|\]$/g, "");
    const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
        throw new AiError("O endereço da API aponta para uma rede privada e não é permitido.", "BAD_URL");
    }
}

function normalizeBaseUrl(provider, rawUrl) {
    const preset = PROVIDERS[provider];
    if (!preset) throw new AiError("Provedor inválido.", "BAD_PROVIDER");
    const value = preset.baseUrl || String(rawUrl || "").trim();
    if (!value) throw new AiError("Informe a URL base da API (ex.: https://api.exemplo.com/v1).", "BAD_URL");
    let url;
    try {
        url = validateHttpUrl(value);
    } catch (error) {
        throw new AiError(error.message || "URL inválida.", "BAD_URL");
    }
    if (url.protocol !== "https:") throw new AiError("A URL da API precisa usar https.", "BAD_URL");
    return url.toString().replace(/\/+$/, "");
}

function customClient(cfg) {
    return {
        chat: {
            completions: {
                async create(params) {
                    const body = { ...params };
                    body.model = cfg.model || (cfg.provider === "groq" ? params.model : PROVIDERS[cfg.provider]?.model);
                    if (!body.model) throw new AiError("Defina um modelo para esta API.", "NO_MODEL");
                    if (cfg.provider === "openai" && body.max_tokens != null) {
                        body.max_completion_tokens = body.max_tokens;
                        delete body.max_tokens;
                    }

                    if (cfg.provider === "custom") await assertPublicHost(cfg.baseUrl);

                    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
                        body: JSON.stringify(body),
                        redirect: "error",
                        signal: AbortSignal.timeout(60000)
                    });

                    const raw = await response.text();
                    let json = null;
                    try { json = JSON.parse(raw); } catch { /* resposta não-JSON */ }

                    if (!response.ok) {
                        const detail = String(json?.error?.message || json?.message || raw || "").replace(cfg.apiKey, "***").slice(0, 200);
                        const error = new AiError(`A API do servidor respondeu ${response.status}${detail ? `: ${detail}` : ""}`, "API_ERROR");
                        error.status = response.status;
                        throw error;
                    }
                    if (!json?.choices) throw new AiError("A API do servidor devolveu uma resposta inesperada.", "API_ERROR");
                    return json;
                }
            }
        }
    };
}

/* ---------- configuração ---------- */

async function getRoutingConfig(guildId) {
    let row = await database.get("SELECT * FROM ai_provider_config WHERE guild_id = ?", [guildId]);
    if (!row) {
        await database.run("INSERT OR IGNORE INTO ai_provider_config (guild_id) VALUES (?)", [guildId]);
        row = await database.get("SELECT * FROM ai_provider_config WHERE guild_id = ?", [guildId]);
    }
    return row || { guild_id: guildId, mode: "default", scope: SCOPE_ALL };
}

async function getState(guildId) {
    const [ai, routing, rows] = await Promise.all([
        AiRepository.getGuildConfig(guildId),
        getRoutingConfig(guildId),
        database.all("SELECT feature, provider, model, base_url, last4, updated_at FROM ai_provider_keys WHERE guild_id = ?", [guildId])
    ]);
    const keys = {};
    for (const row of rows) keys[row.feature] = row;
    return { enabled: !!ai.enabled, mode: routing.mode, scope: routing.scope, keys };
}

async function setEnabled(guildId, enabled) {
    await AiRepository.setGuildConfig(guildId, { enabled: enabled ? 1 : 0 });
}

async function setRouting(guildId, { mode, scope }) {
    await getRoutingConfig(guildId);
    const values = {};
    if (mode !== undefined) {
        if (!["default", "custom"].includes(mode)) throw new AiError("Modo inválido.", "BAD_MODE");
        values.mode = mode;
    }
    if (scope !== undefined) {
        if (!["all", "per_feature"].includes(scope)) throw new AiError("Escopo inválido.", "BAD_SCOPE");
        values.scope = scope;
    }
    const keys = Object.keys(values);
    if (!keys.length) return;
    await database.run(
        `UPDATE ai_provider_config SET ${keys.map(key => `${key} = ?`).join(", ")} WHERE guild_id = ?`,
        [...keys.map(key => values[key]), guildId]
    );
}

async function loadKey(guildId, feature) {
    const row = await database.get("SELECT * FROM ai_provider_keys WHERE guild_id = ? AND feature = ?", [guildId, feature]);
    if (!row) return null;
    const apiKey = decrypt(row.api_key);
    if (!apiKey) return { unreadable: true };
    return { provider: row.provider, apiKey, model: row.model || null, baseUrl: normalizeBaseUrlSafe(row) };
}

function normalizeBaseUrlSafe(row) {
    return (PROVIDERS[row.provider]?.baseUrl || row.base_url || "").replace(/\/+$/, "");
}

/** Qual chave vale para a funcionalidade neste servidor (ou null = usar a padrão da Nina). */
async function pickKey(guildId, feature) {
    const routing = await getRoutingConfig(guildId);
    if (routing.mode !== "custom") return null;
    return loadKey(guildId, routing.scope === "per_feature" ? feature : SCOPE_ALL);
}

/**
 * Resolve o cliente de IA de uma funcionalidade.
 * Retorna { disabled } quando a IA está desligada, ou { client, source: "default"|"custom", provider }.
 */
async function resolve(guildId, feature) {
    if (!FEATURES[feature]) throw new AiError(`Funcionalidade de IA desconhecida: ${feature}`, "BAD_FEATURE");

    if (guildId) {
        const ai = await AiRepository.getGuildConfig(guildId);
        if (!ai.enabled) return { disabled: true };

        const key = await pickKey(guildId, feature);
        if (key?.unreadable) {
            throw new AiError("A chave de API cadastrada neste servidor não pôde ser lida. Cadastre a API novamente em /config → IA.", "KEY_UNREADABLE");
        }
        if (key) return { client: customClient(key), source: "custom", provider: key.provider };
    }

    const client = defaultClient(feature);
    if (!client) throw new AiError("A IA padrão da Nina não está configurada neste momento.", "NO_DEFAULT");
    return { client, source: "default", provider: "groq" };
}

/** true se a funcionalidade pode rodar agora neste servidor (ligada e com alguma chave). */
async function isAvailable(guildId, feature) {
    try {
        const resolved = await resolve(guildId, feature);
        return !resolved.disabled;
    } catch {
        return false;
    }
}

/** Faz a chamada de chat usando a API certa. Lança AiError code "AI_DISABLED" se a IA estiver desligada. */
async function complete(guildId, feature, params) {
    const resolved = await resolve(guildId, feature);
    if (resolved.disabled) throw new AiError("A IA está desativada neste servidor.", "AI_DISABLED");
    return resolved.client.chat.completions.create(params);
}

/* ---------- cadastro de chaves ---------- */

function maskLast4(apiKey) {
    return apiKey.slice(-4);
}

async function testConfig({ provider, apiKey, model, baseUrl }) {
    const url = normalizeBaseUrl(provider, baseUrl);
    const client = customClient({ provider, apiKey, model: model || null, baseUrl: url });
    await client.chat.completions.create({
        model: model || PROVIDERS[provider].model || "gpt-4o-mini",
        messages: [{ role: "user", content: "Responda apenas: ok" }],
        max_tokens: 32
    });
}

async function saveKey(guildId, feature, { provider, apiKey, model, baseUrl }, userId) {
    if (feature !== SCOPE_ALL && !FEATURES[feature]) throw new AiError("Funcionalidade inválida.", "BAD_FEATURE");
    if (!PROVIDERS[provider]) throw new AiError("Provedor inválido.", "BAD_PROVIDER");

    const cleanKey = String(apiKey || "").trim();
    if (cleanKey.length < 8 || cleanKey.length > 400 || /\s/.test(cleanKey)) throw new AiError("Chave de API inválida.", "BAD_KEY");

    const cleanModel = String(model || "").trim().slice(0, 100) || null;
    if (provider === "custom" && !cleanModel) throw new AiError("Para outra API, informe também o modelo.", "NO_MODEL");

    const url = normalizeBaseUrl(provider, baseUrl);
    const encrypted = encrypt(cleanKey);

    try {
        await testConfig({ provider, apiKey: cleanKey, model: cleanModel, baseUrl: url });
    } catch (error) {
        if (error instanceof AiError) throw error;
        throw new AiError(`Não consegui falar com essa API: ${error.message}`, "API_ERROR");
    }

    await database.run(
        `INSERT INTO ai_provider_keys (guild_id, feature, provider, api_key, model, base_url, last4, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(guild_id, feature) DO UPDATE SET
            provider = excluded.provider, api_key = excluded.api_key, model = excluded.model,
            base_url = excluded.base_url, last4 = excluded.last4, updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
        [guildId, feature, provider, encrypted, cleanModel, provider === "custom" ? url : null, maskLast4(cleanKey), userId || null]
    );
}

async function removeKey(guildId, feature = null) {
    if (feature) {
        await database.run("DELETE FROM ai_provider_keys WHERE guild_id = ? AND feature = ?", [guildId, feature]);
    } else {
        await database.run("DELETE FROM ai_provider_keys WHERE guild_id = ?", [guildId]);
    }
}

/** Testa o que está valendo hoje para cada funcionalidade; devolve [{ feature, ok, source, message }]. */
async function testGuild(guildId) {
    const results = [];
    for (const feature of Object.keys(FEATURES)) {
        try {
            const resolved = await resolve(guildId, feature);
            if (resolved.disabled) {
                results.push({ feature, ok: false, source: "-", message: "IA desativada no servidor" });
                continue;
            }
            if (resolved.source === "default") {
                results.push({ feature, ok: true, source: "default", message: "Usando a API padrão da Nina" });
                continue;
            }
            await resolved.client.chat.completions.create({
                model: PROVIDERS[resolved.provider]?.model || "gpt-4o-mini",
                messages: [{ role: "user", content: "Responda apenas: ok" }],
                max_tokens: 32
            });
            results.push({ feature, ok: true, source: "custom", message: "API do servidor respondeu" });
        } catch (error) {
            results.push({ feature, ok: false, source: "custom", message: error.message });
        }
    }
    return results;
}

/** Quem pode mexer em chaves: dono do servidor ou Administrador (as chaves custam dinheiro/são secretas). */
function canManageKeys(guild, member) {
    if (!guild || !member) return false;
    return guild.ownerId === member.id || member.permissions.has("Administrator");
}

module.exports = {
    FEATURES,
    PROVIDERS,
    SCOPE_ALL,
    AiError,
    getState,
    setEnabled,
    setRouting,
    resolve,
    isAvailable,
    complete,
    saveKey,
    removeKey,
    testGuild,
    canManageKeys
};
