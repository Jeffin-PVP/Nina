const {
    PermissionFlagsBits
} = require("discord.js");

const Tool = require("../../structures/Tool");

const LogManager = require("../../managers/LogManager");
const LogTypes = require("../../managers/LogTypes");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "unbanMember",

            description: "Remove o banimento de um usuário.",

            category: "Moderation",

            guildOnly: true,

            permissions: [
                PermissionFlagsBits.BanMembers
            ],

            parameters: {

                type: "object",

                properties: {

                    userId: {

                        type: "string",

                        description: "ID do usuário banido."

                    },

                    reason: {

                        type: "string",

                        description: "Motivo do desbanimento."

                    }

                },

                required: [
                    "userId"
                ]

            }

        });

    }



    async execute(message, args) {


        try {


            const bans =
                await message.guild.bans.fetch();



            const ban =
                bans.get(args.userId);



            if (!ban) {

                return {

                    success: false,

                    error: "Usuário não está banido."

                };

            }



            const reason =
                args.reason || "Banimento removido.";



            const targetData = {

                id: ban.user.id,

                username: ban.user.username,

                tag: ban.user.tag

            };



            await message.guild.members.unban(

                args.userId,

                reason

            );



            await LogManager.send({

                type: LogTypes.UNBAN_MEMBER,

                guild: message.guild,

                executor: message.member,

                target: targetData,

                reason,

                extra: {

                    action: "ban_removed"

                }

            });



            return {

                success: true,

                action: "unban",

                target: targetData,

                moderator: {

                    id: message.author.id,

                    username: message.author.username

                },

                reason,

                logged: true,

                message:
                    `${ban.user.tag} foi desbanido.`

            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};