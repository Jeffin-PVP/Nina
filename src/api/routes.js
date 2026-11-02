const router = require("express").Router();
const Plans = require("../config/plans");
const PlanManager = require("../managers/PlanManager");


module.exports = (client) => {


    router.get("/status", (req, res) => {


        res.json({

            online: client.isReady(),

            bot: client.user ? client.user.tag : "Inicializando...",

            ping: client.ws.ping,

            servers: client.guilds.cache.size,

            users: client.guilds.cache.reduce(
                (acc, guild) => acc + guild.memberCount,
                0
            ),

            uptime: process.uptime()

        });


    });


    // Catálogo público de planos (usado pelo site). Não expõe nada de servidor algum.
    router.get("/plans", async (req, res) => {

        res.set("Cache-Control", "public, max-age=30");
        res.json({ enabled: await PlanManager.isEnabled(), ...Plans.toPublic() });

    });


    return router;

};