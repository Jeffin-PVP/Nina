const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {


    constructor() {

        super({

            name: "getOnlineMembers",

            description: "Lista membros online no servidor.",

            category: "Members"

        });

    }


    async execute(message) {


        await message.guild.members.fetch();


        return message.guild.members.cache

            .filter(member => 
                member.presence &&
                member.user.bot === false
            )

            .map(member => ({

                id: member.id,

                username: member.user.username,

                status: member.presence.status

            }));


    }


};