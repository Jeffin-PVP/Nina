class ContextProvider {

    static async build(message) {

        const guild = message.guild;
        const member = message.member;

        return {

            server: {
                id: guild.id,
                name: guild.name,
                description: guild.description || "Sem descrição",
                createdAt: guild.createdAt,
                memberCount: guild.memberCount,
                ownerId: guild.ownerId
            },

            channel: {
                id: message.channel.id,
                name: message.channel.name,
                type: message.channel.type
            },

            author: {
                id: member.id,
                username: member.user.username,
                displayName: member.displayName,
                roles: member.roles.cache
                    .filter(role => role.name !== "@everyone")
                    .map(role => role.name)
            }

        };

    }

}

module.exports = ContextProvider;