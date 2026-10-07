const test = require("node:test");
const assert = require("node:assert/strict");

const ServerStatsRepository = require("../src/database/repositories/ServerStatsRepository");
const AntiNukeRepository = require("../src/database/repositories/AntiNukeRepository");

const guildId = "99999999999999999";

test("stats: cria configuração e alterna contador individual", async () => {
    const initial = await ServerStatsRepository.get(guildId);
    assert.equal(initial.enabled, 0);
    assert.equal(initial.online_enabled, 1);

    await ServerStatsRepository.setEnabled(guildId, true);
    await ServerStatsRepository.setCounter(guildId, "online", false);

    const updated = await ServerStatsRepository.get(guildId);
    assert.equal(updated.enabled, 1);
    assert.equal(updated.online_enabled, 0);

    await ServerStatsRepository.reset(guildId);
});

test("anti-nuke: mantém limites e ação configuráveis", async () => {
    await AntiNukeRepository.update(guildId, {
        enabled: 1,
        window_seconds: 15,
        channel_limit: 4,
        role_limit: 5,
        member_limit: 6,
        action: "strip"
    });

    const config = await AntiNukeRepository.get(guildId);
    assert.equal(config.enabled, 1);
    assert.equal(config.window_seconds, 15);
    assert.equal(config.channel_limit, 4);
    assert.equal(config.role_limit, 5);
    assert.equal(config.member_limit, 6);
    assert.equal(config.action, "strip");

    await AntiNukeRepository.update(guildId, { enabled: 0 });
});
