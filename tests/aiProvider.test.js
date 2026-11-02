const test = require("node:test");
process.env.CLIENT_SECRET = process.env.CLIENT_SECRET || "segredo-teste";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "gsk_default";
const assert = require("node:assert");
const M = require("../src/ai/AiProviderManager");
const T = require("../src/database/repositories/TicketRepository");
const database = require("../src/database/database");

test("IA por servidor: padrão, chave própria, por função, validações e tickets", async () => {
    const realFetch = global.fetch;
    let calls = [];
    global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization });
        return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "ok!" } }] }) }; };
    const g = `teste-${Date.now()}`;
    try {
    
      const g = `teste-${Date.now()}`;
      // padrão
      let r = await M.resolve(g, "chat"); assert.equal(r.source, "default");
      // desligar
      await M.setEnabled(g, false); assert.equal((await M.resolve(g, "chat")).disabled, true);
      await assert.rejects(M.complete(g, "chat", {}), e => e.code === "AI_DISABLED");
      await M.setEnabled(g, true);
      // chave única
      await M.saveKey(g, "all", { provider: "openai", apiKey: "sk-test-1234567890", model: "" }, "u1");
      await M.setRouting(g, { mode: "custom", scope: "all" });
      r = await M.resolve(g, "tickets"); assert.equal(r.source, "custom");
      const out = await M.complete(g, "tickets", { model: "openai/gpt-oss-120b", max_tokens: 50, messages: [] });
      const last = calls.at(-1);
      assert.equal(out.choices[0].message.content, "ok!");
      assert.equal(last.url, "https://api.openai.com/v1/chat/completions");
      assert.equal(last.body.model, "gpt-4o-mini"); assert.equal(last.body.max_completion_tokens, 50); assert.ok(!("max_tokens" in last.body));
      assert.equal(last.auth, "Bearer sk-test-1234567890");
      const raw = await database.get("SELECT api_key, last4 FROM ai_provider_keys WHERE guild_id=?", [g]);
      assert.ok(!raw.api_key.includes("sk-test") && raw.last4 === "7890");
      // por função: só chat tem chave; os outros usam o padrão
      await M.setRouting(g, { scope: "per_feature" });
      assert.equal((await M.resolve(g, "chat")).source, "default");
      await M.saveKey(g, "chat", { provider: "groq", apiKey: "gsk_abcdefgh1234" }, "u1");
      assert.equal((await M.resolve(g, "chat")).source, "custom");
      assert.equal((await M.resolve(g, "tickets")).source, "default");
      // SSRF / validações
      await assert.rejects(M.saveKey(g, "all", { provider: "custom", apiKey: "abcdefgh1234", model: "x", baseUrl: "http://exemplo.com/v1" }), e => e.code === "BAD_URL");
      await assert.rejects(M.saveKey(g, "all", { provider: "custom", apiKey: "abcdefgh1234", model: "x", baseUrl: "https://127.0.0.1/v1" }), e => e.code === "BAD_URL");
      await assert.rejects(M.saveKey(g, "all", { provider: "custom", apiKey: "abcdefgh1234", model: "x", baseUrl: "https://10.0.0.5/v1" }));
      await assert.rejects(M.saveKey(g, "xyz", { provider: "groq", apiKey: "abcdefgh1234" }), e => e.code === "BAD_FEATURE");
      // remoção
      await M.removeKey(g, "chat"); assert.equal((await M.resolve(g, "chat")).source, "default");
      // tickets: numeração atômica + migrações
      const nums = await Promise.all([1,2,3,4,5].map(() => T.nextNumber("999")));
      assert.deepEqual([...nums].sort(), [1,2,3,4,5]);
      const cfg = await T.getConfig("999"); assert.equal(cfg.ai_enabled, 0); assert.equal(cfg.ai_auto_reply, 1);
      await T.createTicket({ guildId: "999", number: 1, threadId: "t1", parentChannelId: "p", userId: "u" });
      await T.bumpAiReplies("t1"); await T.setAiActive("t1", 0);
      const t = await T.getByThread("t1"); assert.equal(t.ai_replies, 1); assert.equal(t.ai_active, 0);
      
    } finally {
        global.fetch = realFetch;
        await database.run("DELETE FROM ai_provider_keys WHERE guild_id = ?", [g]);
        await database.run("DELETE FROM ai_provider_config WHERE guild_id = ?", [g]);
        await database.run("DELETE FROM ai_guild_config WHERE guild_id = ?", [g]);
        await database.run("DELETE FROM tickets WHERE guild_id = ?", ["999"]);
        await database.run("DELETE FROM ticket_config WHERE guild_id = ?", ["999"]);
    }
});
