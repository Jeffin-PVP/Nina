const Tool = require("../../structures/Tool");

module.exports = new class extends Tool {


    constructor() {

        super({

            name: "searchMember",

            description:
                "Procura um membro do servidor pelo nome, username ou apelido e retorna o ID correto do Discord para usar em outras ferramentas.",

            category: "Members",

            parameters: {

                type:"object",

                properties:{

                    query:{

                        type:"string",

                        description:"Nome ou apelido do usuário."

                    }

                },

                required:[

                    "query"

                ]

            }

        });

    }


    async execute(message, args) {

        const query = args.query.toLowerCase();

        // Antes: message.guild.members.fetch() pedia TODOS os membros
        // do servidor via Gateway (opcode 8, query: '', limit: 0) toda
        // vez que essa tool era chamada. Isso é uma operação pesada e
        // o Discord aplica rate limit agressivo nela — daí os erros
        // "GatewayRateLimitError: Request with opcode 8 was rate limited".
        //
        // Agora: pedimos só os membros que batem com a query (até 10),
        // que é bem mais leve e não esbarra no mesmo limite.
        let members;

        try {

            members = await message.guild.members.fetch({
                query,
                limit: 10
            });

        } catch (error) {

            // Se ainda assim bater rate limit (ex: muitas buscas em
            // sequência), tenta usar o que já estiver em cache antes
            // de desistir.
            members = message.guild.members.cache.filter(member =>

                member.user.username.toLowerCase().includes(query) ||
                member.displayName.toLowerCase().includes(query)

            );

            if (members.size === 0) {

                throw error;

            }

        }

        return members
            .filter(member =>

                member.user.username
                    .toLowerCase()
                    .includes(query)

                ||

                member.displayName
                    .toLowerCase()
                    .includes(query)

            )

            .first(10)

            .map(member => ({

                id: member.id,

                username: member.user.username,

                nickname: member.displayName

            }));


    }


};