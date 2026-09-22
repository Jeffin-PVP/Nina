const Tool = require("../../structures/Tool");

const WarningRepository =
    require("../../database/repositories/WarningRepository");


module.exports = new class extends Tool {


    constructor() {

        super({

            name: "getWarnings",

            description: "Consulta advertências de um membro.",

            category: "Moderation",

            guildOnly: true,

            permissions: [],

            parameters: {

                type: "object",

                properties: {

                    userId: {

                        type: "string",

                        description: "ID do membro."

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


            const member =
                await message.guild.members
                    .fetch(args.userId)
                    .catch(() => null);



            if (!member) {

                return {

                    success: false,

                    error: "Membro não encontrado."

                };

            }



            const warnings =
                await WarningRepository.getUserWarnings({

                    guildId: message.guild.id,

                    userId: member.id

                });



            if (!warnings.length) {


                return {

                    success: true,

                    user: {

                        id: member.id,

                        username: member.user.username,

                        displayName: member.displayName

                    },

                    total: 0,

                    message:
                        "Este membro não possui advertências."

                };


            }



            const formattedWarnings =
                warnings.map((warn, index) => ({


                    id:
                        warn.id,


                    number:
                        index + 1,


                    reason:
                        warn.reason,


                    moderatorId:
                        warn.moderator_id,


                    date:
                        warn.created_at


                }));



            return {


                success: true,


                user: {

                    id: member.id,

                    username: member.user.username,

                    displayName: member.displayName

                },


                total:
                    formattedWarnings.length,


                warnings:
                    formattedWarnings


            };



        } catch (error) {


            return {

                success: false,

                error: error.message

            };


        }


    }


};