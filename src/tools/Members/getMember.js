module.exports = {

    name: "getMember",

    description:
        "Obtém informações de um membro do servidor usando APENAS o ID numérico do Discord. Nunca use nomes ou apelidos. Se você possui apenas um nome, utilize searchMember antes.",

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

        return {

            success: true,

            message: `Informações de ${member.user.username} obtidas com sucesso.`,

            data: {

                id: member.id,

                username: member.user.username,

                displayName: member.displayName,

                nickname: member.nickname,

                bot: member.user.bot,

                createdAt: member.user.createdAt,

                joinedAt: member.joinedAt,

                roles: member.roles.cache

                    .filter(role => role.name !== "@everyone")

                    .map(role => ({

                        id: role.id,

                        name: role.name,

                        color: role.hexColor

                    })),

                boosting: Boolean(member.premiumSince),

                timeout: Boolean(member.communicationDisabledUntil),

                timeoutUntil: member.communicationDisabledUntil

            }

        };

    }

};