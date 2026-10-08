const { Events } = require("discord.js");
const reactionRoles = require("../interactions/autorole/reactionHandler");

module.exports = {
    name: Events.MessageReactionRemove,
    execute(reaction, user) {
        return reactionRoles.remove(reaction, user);
    }
};
