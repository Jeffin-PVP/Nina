const test = require("node:test");
const assert = require("node:assert/strict");
const SecurityRepository = require("../src/database/repositories/SecurityRepository");

const guildA = "88888888888888001";
const guildB = "88888888888888002";

test("Security Center: configurações e regras são isoladas por servidor", async () => {
    await SecurityRepository.update(guildA, { topic_enabled: 1, contextual_enabled: 0 });
    await SecurityRepository.update(guildB, { topic_enabled: 0, contextual_enabled: 1 });

    const a = await SecurityRepository.get(guildA);
    const b = await SecurityRepository.get(guildB);
    assert.equal(a.topic_enabled, 1);
    assert.equal(a.contextual_enabled, 0);
    assert.equal(b.topic_enabled, 0);
    assert.equal(b.contextual_enabled, 1);

    const id = await SecurityRepository.addRule({
        guildId: guildA,
        channelId: "77777777777777001",
        topic: "Política",
        keywords: ["política", "eleições"]
    });
    const rulesA = await SecurityRepository.listRules(guildA);
    const rulesB = await SecurityRepository.listRules(guildB);
    assert.ok(rulesA.some(rule => rule.id === id && rule.keywords.includes("eleições")));
    assert.equal(rulesB.length, 0);

    await SecurityRepository.removeRule(guildA, id);
    await SecurityRepository.update(guildA, { topic_enabled: 0 });
    await SecurityRepository.update(guildB, { contextual_enabled: 0 });
});

test("Security Center: painel e evento de mensagens estão integrados", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.resolve(__dirname, "..");
    const panel = fs.readFileSync(path.join(root, "src/managers/ConfigPanelManager.js"), "utf8");
    const handler = fs.readFileSync(path.join(root, "src/interactions/config/panelHandler.js"), "utf8");
    const messageEvent = fs.readFileSync(path.join(root, "src/events/messageCreate.js"), "utf8");
    assert.match(panel, /value: "security"/);
    assert.match(panel, /buildSecurity/);
    assert.match(handler, /config_submit:security_rule/);
    assert.match(messageEvent, /SecurityManager\.handleMessage/);
});
