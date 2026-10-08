const { Events } = require("discord.js");
const reactionRoles = require("../interactions/autorole/reactionHandler");

module.exports = {
    name: Events.MessageReactionAdd,
    execute(reaction, user) {
        return reactionRoles.add(reaction, user);
    }
};
