/* =========================================================
   NINA — COMMANDS
========================================================= */

const commands = [

    // =====================================================
    // CONFIGURAÇÃO
    // =====================================================

    {
        name: "/config",
        category: "Configuração",
        icon: "⚙️",
        description: "Configuração do Nina."
    },

    {
        name: "/logs",
        category: "Configuração",
        icon: "⚙️",
        description: "Configuração dos sistemas de logs."
    },


    // =====================================================
    // SORTEIOS
    // =====================================================

    {
        name: "/sorteio",
        category: "Sorteios",
        icon: "🎉",
        description: "Gerenciamento de sorteios."
    },


    // =====================================================
    // TICKETS
    // =====================================================

    {
        name: "/ticket",
        category: "Tickets",
        icon: "🎫",
        description: "Sistema de tickets do servidor."
    },


    // =====================================================
    // AUTOROLE
    // =====================================================

    {
        name: "/autorole",
        category: "Cargos automáticos",
        icon: "🎭",
        description: "Gerenciamento de cargos automáticos."
    },


    // =====================================================
    // JOGOS
    // =====================================================

    {
        name: "/coinflip",
        category: "Jogos",
        icon: "🎮",
        description: "Jogo de cara ou coroa."
    },

    {
        name: "/slots",
        category: "Jogos",
        icon: "🎰",
        description: "Jogo de caça-níqueis."
    },


    // =====================================================
    // SERVIDOR
    // =====================================================

    {
        name: "/criar-servidor",
        category: "Servidor",
        icon: "🏗️",
        description: "Ferramenta para criação de servidor."
    },


    // =====================================================
    // BOAS-VINDAS
    // =====================================================

    {
        name: "/boasvindas",
        category: "Boas-vindas",
        icon: "👋",
        description: "Configuração do sistema de boas-vindas."
    },


    // =====================================================
    // ECONOMIA
    // =====================================================

    {
        name: "/balance",
        category: "Economia",
        icon: "💰",
        description: "Consulta o saldo econômico."
    },

    {
        name: "/daily",
        category: "Economia",
        icon: "💰",
        description: "Resgata a recompensa diária."
    },

    {
        name: "/deposit",
        category: "Economia",
        icon: "💰",
        description: "Deposita dinheiro na conta."
    },

    {
        name: "/leaderboard",
        category: "Economia",
        icon: "🏆",
        description: "Exibe o ranking econômico."
    },

    {
        name: "/pay",
        category: "Economia",
        icon: "💸",
        description: "Envia dinheiro para outro usuário."
    },

    {
        name: "/withdraw",
        category: "Economia",
        icon: "💰",
        description: "Retira dinheiro da conta."
    },

    {
        name: "/work",
        category: "Economia",
        icon: "💼",
        description: "Trabalha para ganhar dinheiro."
    },


    // =====================================================
    // GERAL
    // =====================================================

    {
        name: "/dm",
        category: "Geral",
        icon: "📌",
        description: "Recursos relacionados a mensagens diretas."
    },


    // =====================================================
    // UTILIDADE
    // =====================================================

    {
        name: "/ajuda",
        category: "Utilidade",
        icon: "📚",
        description: "Consulta os comandos e informações do Nina."
    },

    {
        name: "/avatar",
        category: "Utilidade",
        icon: "🖼️",
        description: "Visualiza o avatar de um usuário."
    },

    {
        name: "/embed",
        category: "Utilidade",
        icon: "🧩",
        description: "Cria uma embed."
    },

    {
        name: "/embedia",
        category: "Utilidade",
        icon: "🧩",
        description: "Ferramenta relacionada a embeds."
    },

    {
        name: "/ping",
        category: "Utilidade",
        icon: "📡",
        description: "Verifica a latência do bot."
    },

    {
        name: "/roleinfo",
        category: "Utilidade",
        icon: "🏷️",
        description: "Exibe informações sobre um cargo."
    },

    {
        name: "/say",
        category: "Utilidade",
        icon: "💬",
        description: "Faz o bot enviar uma mensagem."
    },

    {
        name: "/serverinfo",
        category: "Utilidade",
        icon: "🖥️",
        description: "Exibe informações do servidor."
    },

    {
        name: "/userinfo",
        category: "Utilidade",
        icon: "👤",
        description: "Exibe informações de um usuário."
    },


    // =====================================================
    // MODERAÇÃO
    // =====================================================

    {
        name: "/automod",
        category: "Moderação",
        icon: "🛡️",
        description: "Sistema de moderação automática."
    },

    {
        name: "/ban",
        category: "Moderação",
        icon: "🔨",
        description: "Bane um membro do servidor."
    },

    {
        name: "/banlist",
        category: "Moderação",
        icon: "📋",
        description: "Lista os banimentos do servidor."
    },

    {
        name: "/kick",
        category: "Moderação",
        icon: "👢",
        description: "Expulsa um membro do servidor."
    },

    {
        name: "/lock",
        category: "Moderação",
        icon: "🔒",
        description: "Bloqueia um canal."
    },

    {
        name: "/nick",
        category: "Moderação",
        icon: "✏️",
        description: "Altera o apelido de um membro."
    },

    {
        name: "/purge",
        category: "Moderação",
        icon: "🧹",
        description: "Remove várias mensagens."
    },

    {
        name: "/removetimeout",
        category: "Moderação",
        icon: "🔓",
        description: "Remove o timeout de um membro."
    },

    {
        name: "/removewarn",
        category: "Moderação",
        icon: "⚠️",
        description: "Remove uma advertência."
    },

    {
        name: "/role",
        category: "Moderação",
        icon: "🏷️",
        description: "Gerencia cargos de membros."
    },

    {
        name: "/slowmode",
        category: "Moderação",
        icon: "🐢",
        description: "Configura o modo lento de um canal."
    },

    {
        name: "/timeout",
        category: "Moderação",
        icon: "⏱️",
        description: "Aplica timeout a um membro."
    },

    {
        name: "/unban",
        category: "Moderação",
        icon: "🔓",
        description: "Remove um banimento."
    },

    {
        name: "/unlock",
        category: "Moderação",
        icon: "🔓",
        description: "Desbloqueia um canal."
    },

    {
        name: "/warn",
        category: "Moderação",
        icon: "⚠️",
        description: "Adverte um membro."
    },

    {
        name: "/warnings",
        category: "Moderação",
        icon: "📋",
        description: "Consulta as advertências de um membro."
    }

];


// =========================================================
// ELEMENTOS
// =========================================================

const grid =
    document.getElementById("commandsGrid");

const search =
    document.getElementById("commandSearch");

const filters =
    document.getElementById("categoryFilters");

const empty =
    document.getElementById("commandsEmpty");

const resultText =
    document.getElementById("resultText");

const totalCommands =
    document.getElementById("totalCommands");


// =========================================================
// TOTAL
// =========================================================

totalCommands.textContent =
    commands.length;


// =========================================================
// CATEGORIAS
// =========================================================

const categories = [
    ...new Set(
        commands.map(command => command.category)
    )
];


// =========================================================
// FILTROS
// =========================================================

categories.forEach(category => {

    const button =
        document.createElement("button");

    button.className = "filter";

    button.dataset.category =
        category;

    button.textContent =
        category;

    filters.appendChild(button);

});


// =========================================================
// RENDER
// =========================================================

function renderCommands() {

    const query =
        search.value
            .trim()
            .toLowerCase();

    const activeFilter =
        document.querySelector(
            ".filter.active"
        )?.dataset.category || "all";


    const filtered =
        commands.filter(command => {

            const matchesSearch =
                command.name
                    .toLowerCase()
                    .includes(query) ||

                command.description
                    .toLowerCase()
                    .includes(query);


            const matchesCategory =
                activeFilter === "all" ||
                command.category === activeFilter;


            return (
                matchesSearch &&
                matchesCategory
            );

        });


    grid.innerHTML = "";


    filtered.forEach(command => {

        const card =
            document.createElement("article");

        card.className =
            "command-card";


        card.innerHTML = `

            <div class="command-top">

                <div class="command-icon">
                    ${command.icon}
                </div>

                <span class="command-category">
                    ${command.category}
                </span>

            </div>

            <h3 class="command-name">
                ${command.name}
            </h3>

            <p class="command-description">
                ${command.description}
            </p>

        `;


        grid.appendChild(card);

    });


    // =====================================================
    // RESULTADO
    // =====================================================

    resultText.textContent =
        `Mostrando ${filtered.length} ${
            filtered.length === 1
                ? "comando"
                : "comandos"
        }`;


    // =====================================================
    // EMPTY
    // =====================================================

    if (filtered.length === 0) {

        empty.classList.add("show");

    } else {

        empty.classList.remove("show");

    }

}


// =========================================================
// FILTRO DE CATEGORIA
// =========================================================

filters.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(".filter");

        if (!button) return;


        document
            .querySelectorAll(".filter")
            .forEach(filter => {

                filter.classList.remove(
                    "active"
                );

            });


        button.classList.add("active");


        renderCommands();

    }
);


// =========================================================
// PESQUISA
// =========================================================

search.addEventListener(
    "input",
    renderCommands
);


// =========================================================
// ATALHO "/"
// =========================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "/" &&
            document.activeElement !== search
        ) {

            event.preventDefault();

            search.focus();

        }

    }
);


// =========================================================
// PRIMEIRO RENDER
// =========================================================

renderCommands();