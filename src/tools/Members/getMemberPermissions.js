module.exports = {

    name: "getMemberPermissions",

    description: "Verifica as permissões de um membro.",

    category: "Members",

    guildOnly: true,

    ownerOnly: false,

    parameters: {

        type: "object",

        properties: {

            userId: {

                type: "string",

                description: "ID do usuário."

            }

        },

        required: [

            "userId"

        ]

    },

    async execute(message, args) {

        const member = await message.guild.members
            .fetch(args.userId)
            .catch(() => null);

        if (!member) {

            return {

                success: false,

                message: "Usuário não encontrado."

            };

        }

        const permissions = member.permissions;

        return {

            success: true,

            message: `Permissões de ${member.user.username} obtidas com sucesso.`,

            data: {

                administrator: permissions.has("Administrator"),

                manageGuild: permissions.has("ManageGuild"),

                manageRoles: permissions.has("ManageRoles"),

                manageChannels: permissions.has("ManageChannels"),

                manageMessages: permissions.has("ManageMessages"),

                kickMembers: permissions.has("KickMembers"),

                banMembers: permissions.has("BanMembers"),

                moderateMembers: permissions.has("ModerateMembers")

            }

        };

    }

};