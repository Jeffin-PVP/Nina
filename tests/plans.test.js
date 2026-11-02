const test = require("node:test");
const assert = require("node:assert/strict");

// O PlanManager só usa o discord.js para montar embeds (ui.js). Se as dependências não estiverem
// instaladas (ambiente sem rede), troca o módulo por um stub para o teste de regras rodar mesmo assim.
const Module = require("node:module");
try {
    require.resolve("discord.js");
} catch {
    const originalLoad = Module._load;
    const stub = new Proxy(function () { }, {
        get: (_, prop) => (prop === "MessageFlags" ? { Ephemeral: 64 } : stub),
        apply: () => stub,
        construct: () => stub
    });
    Module._load = function (request, ...rest) {
        if (request === "discord.js") return stub;
        return originalLoad.call(this, request, ...rest);
    };
}

const Plans = require("../src/config/plans");

test("catálogo: todo limite de cada plano existe no CATALOG e vice-versa", () => {
    for (const id of Plans.PLAN_ORDER) {
        const keys = Object.keys(Plans.PLANS[id].limits).sort();
        assert.deepEqual(keys, Object.keys(Plans.CATALOG).sort(), `plano ${id}`);
    }
});

test("planos mais altos nunca têm limite menor que os mais baixos", () => {
    for (const key of Object.keys(Plans.CATALOG)) {
        const values = Plans.PLAN_ORDER.map(id => Plans.PLANS[id].limits[key]);
        for (let i = 1; i < values.length; i++) {
            const a = values[i - 1], b = values[i];
            if (typeof a === "boolean") assert.ok(!a || b, `${key}: recurso some em plano maior`);
            else assert.ok(b >= a, `${key}: ${b} < ${a}`);
        }
    }
});

test("toPublic serializa Infinity como null (JSON seguro)", () => {
    const pub = Plans.toPublic();
    assert.doesNotThrow(() => JSON.stringify(pub));
    assert.equal(Plans.serializeValue(Infinity), null);
});

test("minPlanFor acha o primeiro plano que libera o recurso", () => {
    assert.equal(Plans.minPlanFor("anti_scam_images"), "basic");
    assert.equal(Plans.minPlanFor("ai_user_daily"), "free");
});

test("PlanManager: grant, expiração, códigos e cotas", async () => {
    const PlanManager = require("../src/managers/PlanManager");
    const PlanRepository = require("../src/database/repositories/PlanRepository");
    const g = "9".repeat(18);

    await PlanManager.revoke({ guildId: g });

    // Sistema DESLIGADO (padrão): ninguém é limitado, mesmo sem assinatura
    await PlanManager.setEnabled(false);
    assert.equal(await PlanManager.isEnabled(), false);
    assert.equal((await PlanManager.getPlan(g)).id, "legacy");
    assert.equal(await PlanManager.can(g, "anti_scam_images"), true);
    assert.equal(await PlanManager.limit(g, "backups_max"), 10);
    assert.equal(await PlanManager.limit(g, "ai_user_daily"), 15);
    assert.equal((await PlanManager.consumeMonthly(g, "server_builder_month")).allowed, true);
    await PlanManager.refundMonthly(g, "server_builder_month");

    // Mesmo desligado dá para conceder plano (para testar) e o plano real é guardado
    const granted = await PlanManager.grant({ guildId: g, plan: "pro", days: 3 });
    assert.equal(granted.id, "pro");
    assert.equal((await PlanManager.getPlan(g)).id, "legacy");
    await PlanManager.revoke({ guildId: g });

    // Liga o sistema
    await PlanManager.setEnabled(true);
    assert.equal(await PlanManager.isEnabled(), true);

    // Sem assinatura = Free
    assert.equal((await PlanManager.getPlan(g)).id, "free");
    assert.equal(await PlanManager.can(g, "anti_scam_images"), false);

    // Liberar Basic por 10 dias
    let plan = await PlanManager.grant({ guildId: g, plan: "basic", days: 10, actor: "teste" });
    assert.equal(plan.id, "basic");
    assert.equal(await PlanManager.can(g, "anti_scam_images"), true);
    assert.equal(await PlanManager.limit(g, "backups_max"), Plans.PLANS.basic.limits.backups_max);

    // Renovar o mesmo plano soma dias
    const first = plan.expiresAt;
    plan = await PlanManager.grant({ guildId: g, plan: "basic", days: 5, actor: "teste" });
    assert.ok(plan.expiresAt > first + 4.9 * 86400000);

    // Override por servidor
    await PlanManager.setOverride({ guildId: g, key: "backups_max", value: 77 });
    assert.equal(await PlanManager.limit(g, "backups_max"), 77);
    await PlanManager.setOverride({ guildId: g, key: "ai_user_daily", value: "ilimitado" });
    assert.equal(await PlanManager.limit(g, "ai_user_daily"), Infinity);
    await PlanManager.removeOverride({ guildId: g, key: "backups_max" });
    await PlanManager.removeOverride({ guildId: g, key: "ai_user_daily" });

    // Vencido volta ao Free sem apagar nada
    await PlanRepository.upsertSubscription({ guildId: g, plan: "pro", source: "manual", expiresAt: Date.now() - 1000 });
    PlanManager.invalidate(g);
    assert.equal((await PlanManager.getPlan(g)).id, "free");
    assert.ok(await PlanRepository.getSubscription(g), "linha da assinatura permanece");

    // Cota mensal: respeita o teto e não passa dele
    await PlanManager.grant({ guildId: g, plan: "basic", days: 1 });
    const key = "server_builder_month";
    const max = await PlanManager.limit(g, key);
    for (let i = 0; i < max; i++) assert.equal((await PlanManager.consumeMonthly(g, key)).allowed, true);
    assert.equal((await PlanManager.consumeMonthly(g, key)).allowed, false);
    await PlanManager.refundMonthly(g, key);
    assert.equal((await PlanManager.consumeMonthly(g, key)).allowed, true);

    // Códigos
    const [code] = await PlanManager.createCode({ plan: "pro", durationDays: 30, maxUses: 1 });
    await assert.rejects(() => PlanManager.redeem({ code: "NINA-INVALIDO", guildId: g, userId: "1" }), /inválido/i);
    const g2 = "8".repeat(18);
    await PlanManager.revoke({ guildId: g2 });
    const r = await PlanManager.redeem({ code: code.toLowerCase(), guildId: g2, userId: "1" });
    assert.equal(r.id, "pro");
    // Esgotado
    await assert.rejects(() => PlanManager.redeem({ code, guildId: g, userId: "1" }), /utilizado|usado/i);

    // Plano menor não sobrescreve plano maior ativo
    const [low] = await PlanManager.createCode({ plan: "basic", durationDays: 30 });
    await assert.rejects(() => PlanManager.redeem({ code: low, guildId: g2, userId: "1" }), /superior/i);
    // ...e o uso do código não é gasto nesse caso
    assert.equal((await PlanRepository.getCode(low)).uses, 0);

    // Limpeza (volta ao padrão: desligado)
    await PlanManager.setEnabled(false);
    await PlanManager.revoke({ guildId: g });
    await PlanManager.revoke({ guildId: g2 });
});
