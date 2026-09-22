const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getMemberRoles",

            description: "Lista os cargos de um membro.",

            category: "Members",

            parameters: {

                type: "object",

                properties: {

                    userId: {

                        type: "string"

                    }

                },

                required: [

                    "userId"

                ]

            }

        });

    }


    async execute(message, args) {


        const member = await message.guild.members.fetch(args.userId)
            .catch(() => null);


        if (!member) {

            return {

                success: false,

                message: "Usuário não encontrado."

            };

        }


        return member.roles.cache

            .filter(role => role.name !== "@everyone")

            .map(role => ({

                id: role.id,

                name: role.name,

                color: role.hexColor,

                position: role.position

            }));


    }

};