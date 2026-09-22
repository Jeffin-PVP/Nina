const router = require("express").Router();


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

            uptime: process.uptime(),

            memory: process.memoryUsage(),

            node: process.version

        });


    });


    return router;

};