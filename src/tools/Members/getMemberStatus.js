const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {

    constructor() {

        super({

            name: "getMemberStatus",

            description: "Verifica o status de um membro.",

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


        return {

            onlineStatus: member.presence?.status ?? "offline",

            boosting: Boolean(member.premiumSince),

            timeout: Boolean(member.communicationDisabledUntil),

            timeoutUntil: member.communicationDisabledUntil,

            voiceChannel: member.voice.channel?.name ?? null

        };


    }

};