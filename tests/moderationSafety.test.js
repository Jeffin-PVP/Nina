const test = require("node:test");
const assert = require("node:assert/strict");

const { canModerateMember } = require("../src/ai/moderationSafety");

function role(position) {
    return {
        position,
        comparePositionTo(other) {
            return this.position - other.position;
        }
    };
}

function member(id, position, guildOwnerId = "owner") {
    return {
        id,
        guild: { ownerId: guildOwnerId },
        roles: { highest: role(position) },
        permissions: { has: () => true },
        user: { bot: false }
    };
}

test("bloqueia ação contra si mesmo", () => {
    const executor = member("u1", 5);
    const result = canModerateMember({
        executor,
        target: executor,
        botMember: member("bot", 10)
    });

    assert.equal(result.ok, false);
});

test("bloqueia alvo com cargo igual ou superior ao moderador", () => {
    const executor = member("u1", 5);
    const target = member("u2", 5);

    const result = canModerateMember({
        executor,
        target,
        botMember: member("bot", 10)
    });

    assert.equal(result.ok, false);
});

test("permite alvo abaixo do moderador e abaixo da Nina", () => {
    const executor = member("u1", 10);
    const target = member("u2", 5);

    const result = canModerateMember({
        executor,
        target,
        botMember: member("bot", 15)
    });

    assert.equal(result.ok, true);
});

test("bloqueia alvo acima da Nina", () => {
    const executor = member("u1", 20);
    const target = member("u2", 15);

    const result = canModerateMember({
        executor,
        target,
        botMember: member("bot", 10)
    });

    assert.equal(result.ok, false);
});
