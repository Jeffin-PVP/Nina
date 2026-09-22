const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getRoles",

            description: "Lista todos os cargos do servidor.",

            category: "Server"

        });

    }

    async execute(message) {

        return message.guild.roles.cache

            .filter(role => role.name !== "@everyone")

            .sort((a, b) => b.position - a.position)

            .map(role => ({

                id: role.id,

                name: role.name,

                color: role.hexColor,

                position: role.position,

                mentionable: role.mentionable,

                hoist: role.hoist,

                managed: role.managed,

                permissions: role.permissions.toArray()

            }));

    }

};