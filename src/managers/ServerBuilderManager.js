const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const groq = require("../ai/groqServerBuilder");

/*
=========================
    CONFIGURAÇÃO
=========================
*/

const MODEL = "openai/gpt-oss-120b";
const MAX_TOKENS = 5500; // ajuste conforme o tier da sua chave Groq dedicada (GROQ_CRIAR_SERVIDOR_API_KEY)
const DELAY_MS = 350; // intervalo entre criações/exclusões para não bater rate limit do Discord

const MAX_CATEGORIAS = 9;
const MAX_CANAIS_POR_CATEGORIA = 8;
const MAX_CARGOS = 12;
const SESSAO_EXPIRA_MS = 5 * 60 * 1000; // 5 minutos entre o modal e a confirmação

const DIVISOR_PADRAO_CATEGORIA = "|";
const DIVISOR_PADRAO_CANAL = "╺╸";

// Canais (texto/voz) são normalizados pelo Discord (minúsculo, sem espaço) —
// caracteres abaixo costumam ser removidos, então são filtrados aqui antes.
const DIVISOR_INVALIDO_CANAL_REGEX = /[|\\/#@`"']/g;

// Categorias aceitam praticamente qualquer caractere visível — só remove o
// que quebra formatação/menções por segurança.
const DIVISOR_INVALIDO_CATEGORIA_REGEX = /[`"'\n\r]/g;

const EMOJIS_DISPONIVEIS = [
    "⚽", "🏟️", "🎽", "📢", "📊", "🧠", "🎙️", "👥", "📰", "💬", "🏅", "🔧", "💡", "📁", "🛠️",
    "📆", "📈", "🚀", "🌐", "🏆", "🎯", "🧪", "🧩", "🛡️", "👑", "🔔", "🧾", "🔍", "💻", "📚", "🗂️",
    "📜", "✏️", "📒", "🏷️", "📬", "📨", "🗣️", "👂", "👀", "🧑‍💻", "👨‍🏫", "🗳️", "🧭", "📍", "📌",
    "🖥️", "📲", "📳", "📱", "🛒", "💸", "💳", "🎉", "🗃️", "📂", "📄", "🛎️", "⚙️", "📡",
    "📺", "🎥", "📷", "🎞️", "📽️", "🖼️", "🎨", "🎭", "🎵", "🎼", "🎧", "🎤", "🎬", "🎹", "🪗", "🥁",
    "🎻", "🕹️", "🎮", "🏁", "🥇", "🥈", "🥉", "🎖️", "⚔️", "🗡️", "🪓", "🏹", "🪃"
];

// Mapeia o "tipo" retornado pela IA para o ChannelType real do discord.js
const TIPO_CANAL = {
    texto: ChannelType.GuildText,
    voz: ChannelType.GuildVoice,
    anuncio: ChannelType.GuildAnnouncement,
    forum: ChannelType.GuildForum
};

// Permissões que a IA pode atribuir aos cargos (safelist — evita que a IA
// invente permissões perigosas fora deste conjunto controlado)
const PERMISSOES_DISPONIVEIS = {
    Administrator: PermissionFlagsBits.Administrator,
    KickMembers: PermissionFlagsBits.KickMembers,
    BanMembers: PermissionFlagsBits.BanMembers,
    ManageChannels: PermissionFlagsBits.ManageChannels,
    ManageGuild: PermissionFlagsBits.ManageGuild,
    ManageMessages: PermissionFlagsBits.ManageMessages,
    ManageRoles: PermissionFlagsBits.ManageRoles,
    ManageNicknames: PermissionFlagsBits.ManageNicknames,
    ManageWebhooks: PermissionFlagsBits.ManageWebhooks,
    ModerateMembers: PermissionFlagsBits.ModerateMembers,
    MentionEveryone: PermissionFlagsBits.MentionEveryone,
    MuteMembers: PermissionFlagsBits.MuteMembers,
    DeafenMembers: PermissionFlagsBits.DeafenMembers,
    MoveMembers: PermissionFlagsBits.MoveMembers
};

// Palavras que, quando aparecem no nome da categoria, tornam ela restrita
// (oculta de @everyone, liberada só para cargos de staff)
const PALAVRAS_RESTRITAS = ["staff", "admin", "moderaç", "moderac", "equipe", "interno"];
const PALAVRAS_CARGO_STAFF = ["fundador", "dono", "admin", "moderador", "staff", "equipe", "suporte"];

/*
=========================
    SESSÕES (entre o modal e a confirmação)
=========================
*/

const sessoes = new Map();
const timers = new Map();

function iniciarExpiracao(userId) {

    const timerAntigo = timers.get(userId);

    if (timerAntigo) clearTimeout(timerAntigo);

    const timer = setTimeout(() => sessoes.delete(userId), SESSAO_EXPIRA_MS);

    timers.set(userId, timer);

}

function criarSessao(userId, dados) {

    const sessao = {
        ...dados,
        criadoEm: Date.now()
    };

    sessoes.set(userId, sessao);
    iniciarExpiracao(userId);

    return sessao;

}

function getSessao(userId) {

    return sessoes.get(userId) || null;

}

function encerrarSessao(userId) {

    const timer = timers.get(userId);

    if (timer) clearTimeout(timer);

    timers.delete(userId);
    sessoes.delete(userId);

}

/*
=========================
    HELPERS GERAIS
=========================
*/

function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

function parseSimNao(valor) {

    return ["sim", "s", "yes", "y", "true", "1"].includes(String(valor || "").trim().toLowerCase());

}

// Usado só para EXIBIÇÃO em confirmações/resumos — a IA sempre recebe o
// texto completo do tema, isso apenas evita mensagens gigantes no Discord.
function resumirTexto(texto, max = 300) {

    const limpo = String(texto || "").trim().replace(/\s+/g, " ");

    if (limpo.length <= max) return limpo;

    return `${limpo.slice(0, max).trim()}…`;

}

/*
=========================
    SANITIZAÇÃO DE NOMES
=========================
*/

function sanitizarDivisorCanal(valor) {

    const limpo = String(valor || "").replace(DIVISOR_INVALIDO_CANAL_REGEX, "").trim();

    return limpo || DIVISOR_PADRAO_CANAL;

}

function sanitizarDivisorCategoria(valor) {

    const limpo = String(valor || "").replace(DIVISOR_INVALIDO_CATEGORIA_REGEX, "").trim();

    return limpo || DIVISOR_PADRAO_CATEGORIA;

}

// Nome "slug" para CANAIS (minúsculo, hífen entre palavras)
function limparNomeCanal(nome) {

    return String(nome || "sem-nome")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 90) || "sem-nome";

}

// Nome para CATEGORIAS — mantém espaços e capitalização
function limparNomeCategoria(nome) {

    let n = String(nome || "Categoria")
        .replace(/`/g, "")
        .replace(/@(everyone|here)/gi, "@\u200b$1") // evita menção acidental
        .replace(/\s+/g, " ")
        .trim();

    if (!n) n = "Categoria";

    return n.slice(0, 100);

}

// Nome para CARGOS — mantém espaços e capitalização
function limparNomeCargo(nome) {

    let n = String(nome || "Cargo")
        .replace(/[`*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!n) n = "Cargo";

    if (/^@?(everyone|here)$/i.test(n)) n = `${n} `; // Discord bloqueia esses nomes exatos

    return n.slice(0, 100);

}

function emojiAleatorio() {

    return EMOJIS_DISPONIVEIS[Math.floor(Math.random() * EMOJIS_DISPONIVEIS.length)];

}

function adicionarEmojiCanal(nomeSlug, usarEmojis, divisoria) {

    if (!usarEmojis) return nomeSlug;

    return `${emojiAleatorio()}${divisoria}${nomeSlug}`;

}

function adicionarEmojiCategoria(nome, usarEmojis, divisoria) {

    if (!usarEmojis) return nome;

    return `${emojiAleatorio()} ${divisoria} ${nome}`;

}

function nomeUnico(nome, usados) {

    let final = nome;
    let i = 1;

    while (usados.has(final.toLowerCase())) {

        final = `${nome}-${i}`;
        i++;

    }

    usados.add(final.toLowerCase());

    return final;

}

// Extrai o primeiro objeto JSON válido de uma resposta de texto (removendo
// blocos <think> e cercas de markdown que alguns modelos incluem)
function extrairJson(texto) {

    if (!texto) return null;

    const limpo = String(texto)
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/```json|```/g, "");

    let chaves = 0;
    let inicio = null;
    let emString = false;
    let escapado = false;

    for (let i = 0; i < limpo.length; i++) {

        const c = limpo[i];

        if (emString) {

            if (escapado) escapado = false;
            else if (c === "\\") escapado = true;
            else if (c === "\"") emString = false;

            continue;

        }

        if (c === "\"") { emString = true; continue; }

        if (c === "{") {

            if (chaves === 0) inicio = i;
            chaves++;

        } else if (c === "}") {

            chaves--;

            if (chaves === 0 && inicio !== null) {

                try { return JSON.parse(limpo.slice(inicio, i + 1)); }
                catch { return null; }

            }

        }

    }

    return null;

}

/*
=========================
    PROMPT DA IA
=========================
*/

function montarPromptSistema(tema) {

    const permissoesValidas = Object.keys(PERMISSOES_DISPONIVEIS).join(", ");

    return [
        "Você é um especialista em arquitetura de servidores Discord profissionais.",
        "Gere uma estrutura COMPLETA e PROFISSIONAL de servidor com base na entrada do usuário abaixo.",
        "A entrada pode ser um tema curto (ex: \"Comunidade Gaming\") OU um briefing detalhado. Em ambos os " +
        "casos, interprete a intenção e siga as instruções e detalhes específicos mencionados (nomes " +
        "sugeridos, quantidade de canais, estilo, público-alvo, etc.), preenchendo o que não for " +
        "especificado com boas práticas de arquitetura de servidor.",
        "",
        "--- ENTRADA DO USUÁRIO ---",
        tema,
        "--- FIM DA ENTRADA ---",
        "",
        "Responda ESTRITAMENTE em JSON válido, sem markdown, sem texto fora do JSON, no formato exato:",
        "{",
        "  \"cargos\": [",
        "    { \"nome\": \"string\", \"cor\": \"#RRGGBB\", \"hoist\": true, \"mentionable\": false, \"permissoes\": [\"string\"] }",
        "  ],",
        "  \"categorias\": [",
        "    {",
        "      \"nome\": \"string\",",
        "      \"canais\": [",
        "        { \"nome\": \"string\", \"tipo\": \"texto|voz|anuncio|forum\", \"topico\": \"string opcional\", \"lento\": 0 }",
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
        "Regras obrigatórias:",
        "- Crie entre 5 e 9 categorias organizadas por função (ex: Informações, Comunidade, Voz, Eventos, Staff), a não ser que a entrada peça uma quantidade diferente.",
        "- Cada categoria deve ter entre 2 e 6 canais relevantes, com \"topico\" descrevendo o propósito do canal.",
        "- Inclua ao menos: um canal de regras, um de anúncios (tipo \"anuncio\"), canais de bate-papo variados e ao menos 2-3 canais de voz com nomes diferentes.",
        "- Crie uma categoria de Staff/Moderação com canais internos (ex: staff-chat, logs, denuncias) e um sistema de cargos de staff coerente.",
        "- \"lento\" é o slowmode em segundos (0 = desativado). Use algo entre 5 e 30 em canais de bate-papo muito movimentados, e 0 no restante.",
        "- Cargos devem seguir hierarquia lógica do mais alto ao mais baixo (ex: Fundador, Administrador, Moderador, Membro Verificado, Membro), cada um com cor hexadecimal distinta e \"hoist\": true para os cargos de destaque (staff).",
        `- "permissoes" de cada cargo deve ser um array usando SOMENTE estas chaves exatas (em inglês, sem tradução): ${permissoesValidas}. Cargos de membro comum devem ter "permissoes": [].`,
        "- Nomes de canais e cargos: apenas letras, números e espaços/hífen entre palavras (sem emojis, sem caracteres especiais, sem acentuação em canais).",
        "- NÃO inclua emojis em nenhum nome — eles são adicionados automaticamente pelo sistema depois.",
        "- Não repita nomes de categorias, canais ou cargos.",
        "- Não escreva texto explicativo, comentários, markdown ou qualquer coisa fora do JSON."
    ].join("\n");

}

async function gerarEstruturaIA(tema) {

    const response = await groq.chat.completions.create({

        model: MODEL,

        temperature: 0.4,

        max_tokens: MAX_TOKENS,

        messages: [
            { role: "system", content: montarPromptSistema(tema) },
            { role: "user", content: `Entrada: ${tema}` }
        ]

    });

    const respostaIA = response.choices?.[0]?.message?.content;

    if (!respostaIA) {

        throw new Error("A IA não respondeu. Verifique se GROQ_CRIAR_SERVIDOR_API_KEY está configurada corretamente.");

    }

    const estrutura = extrairJson(respostaIA);

    if (!estrutura || (!estrutura.categorias && !estrutura.cargos)) {

        console.error("[Criar Servidor IA] Resposta bruta que falhou ao interpretar:\n", respostaIA);
        throw new Error("A IA retornou uma resposta em formato inválido. Tente novamente.");

    }

    return {
        cargos: Array.isArray(estrutura.cargos) ? estrutura.cargos.slice(0, MAX_CARGOS) : [],
        categorias: Array.isArray(estrutura.categorias) ? estrutura.categorias.slice(0, MAX_CATEGORIAS) : []
    };

}

/*
=========================
    PERMISSÕES
=========================
*/

// Monta os permissionOverwrites de uma categoria ou canal, combinando:
//  - "restrita"          -> oculta de @everyone (áreas internas de staff)
//  - "ehAnuncio"         -> somente-leitura para @everyone (canais de anúncio)
//  - "segurancaReforcada" -> somente-leitura para @everyone em TODO o servidor
// Sempre libera os cargos de staff para o que for bloqueado de @everyone.
function construirPermissoes({ guildId, tipo, ehAnuncio, ehCategoria, restrita, segurancaReforcada, cargosStaff }) {

    const mapa = new Map();

    const registro = (id) => {

        if (!mapa.has(id)) mapa.set(id, { allow: new Set(), deny: new Set() });

        return mapa.get(id);

    };

    if (restrita) {

        registro(guildId).deny.add(PermissionFlagsBits.ViewChannel);

        for (const role of cargosStaff) registro(role.id).allow.add(PermissionFlagsBits.ViewChannel);

    }

    const aceitaEscritaOuTopico = ehCategoria
        || [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(tipo);

    if (segurancaReforcada && aceitaEscritaOuTopico) {

        const everyone = registro(guildId);

        everyone.deny.add(PermissionFlagsBits.SendMessages);
        everyone.deny.add(PermissionFlagsBits.CreatePublicThreads);
        everyone.deny.add(PermissionFlagsBits.CreatePrivateThreads);
        everyone.deny.add(PermissionFlagsBits.SendMessagesInThreads);

        for (const role of cargosStaff) {

            const p = registro(role.id);

            p.allow.add(PermissionFlagsBits.SendMessages);
            p.allow.add(PermissionFlagsBits.CreatePublicThreads);
            p.allow.add(PermissionFlagsBits.CreatePrivateThreads);
            p.allow.add(PermissionFlagsBits.SendMessagesInThreads);

        }

    } else if (ehAnuncio) {

        registro(guildId).deny.add(PermissionFlagsBits.SendMessages);

        for (const role of cargosStaff) registro(role.id).allow.add(PermissionFlagsBits.SendMessages);

    }

    return Array.from(mapa.entries()).map(([id, { allow, deny }]) => ({
        id,
        allow: Array.from(allow),
        deny: Array.from(deny)
    }));

}

/*
=========================
    APLICAÇÃO DA ESTRUTURA
=========================
*/

async function aplicarEstrutura(guild, sessao) {

    const { tema, divisoriaCategoria, divisoriaCanal, usarEmojis, segurancaReforcada } = sessao;
    const erros = [];

    // 1) Gera a estrutura via IA
    const estrutura = await gerarEstruturaIA(tema);
    const cargosIA = estrutura.cargos;
    const categoriasIA = estrutura.categorias;

    // 2) Remove canais e cargos antigos (mantém @everyone e cargos gerenciados/do bot)
    for (const canal of Array.from(guild.channels.cache.values())) {

        try { await canal.delete("Reset via /criar-servidor (IA)"); }
        catch (e) { erros.push(`Não foi possível excluir o canal "${canal.name}": ${e.message}`); }

        await sleep(DELAY_MS);

    }

    for (const cargo of Array.from(guild.roles.cache.values())) {

        if (cargo.id === guild.id || cargo.managed) continue;

        try { await cargo.delete("Reset via /criar-servidor (IA)"); }
        catch (e) { erros.push(`Não foi possível excluir o cargo "${cargo.name}": ${e.message}`); }

        await sleep(DELAY_MS);

    }

    const nomesCanaisUsados = new Set();
    const nomesCargosUsados = new Set();

    // 3) Cria os cargos primeiro (nomes limpos, sem emoji/divisória, com permissões reais)
    const cargosCriadosMap = new Map();
    let cargosCriados = 0;

    for (const cargo of cargosIA) {

        const nomeFinal = nomeUnico(limparNomeCargo(cargo?.nome), nomesCargosUsados);

        const permissoesCargo = Array.isArray(cargo?.permissoes)
            ? cargo.permissoes.map(p => PERMISSOES_DISPONIVEIS[p]).filter(Boolean)
            : [];

        try {

            const role = await guild.roles.create({
                name: nomeFinal,
                color: cargo?.cor || "#5865F2",
                hoist: !!cargo?.hoist,
                mentionable: !!cargo?.mentionable,
                permissions: permissoesCargo,
                reason: "Criado via /criar-servidor (IA)"
            });

            cargosCriadosMap.set((cargo?.nome || nomeFinal).toLowerCase(), role);
            cargosCriados++;

        } catch (e) {

            erros.push(`Não foi possível criar o cargo "${nomeFinal}": ${e.message}`);

        }

        await sleep(DELAY_MS);

    }

    // Identifica quais cargos criados são "de staff" para liberar acesso a áreas restritas
    const cargosStaff = Array.from(cargosCriadosMap.entries())
        .filter(([nomeOriginal]) => PALAVRAS_CARGO_STAFF.some(p => nomeOriginal.includes(p)))
        .map(([, role]) => role);

    // 4) Cria categorias e canais
    let categoriasCriadas = 0;
    let canaisCriados = 0;

    for (const categoria of categoriasIA) {

        const nomeCatBase = limparNomeCategoria(categoria?.nome);
        const nomeCatFinal = nomeUnico(adicionarEmojiCategoria(nomeCatBase, usarEmojis, divisoriaCategoria), nomesCanaisUsados);
        const restrita = PALAVRAS_RESTRITAS.some(p => nomeCatBase.toLowerCase().includes(p));

        let categoriaObj;

        try {

            const permissionOverwrites = construirPermissoes({
                guildId: guild.id, tipo: null, ehAnuncio: false, ehCategoria: true,
                restrita, segurancaReforcada, cargosStaff
            });

            categoriaObj = await guild.channels.create({
                name: nomeCatFinal,
                type: ChannelType.GuildCategory,
                permissionOverwrites,
                reason: "Criado via /criar-servidor (IA)"
            });

            categoriasCriadas++;

        } catch (e) {

            erros.push(`Não foi possível criar a categoria "${nomeCatFinal}": ${e.message}`);
            continue;

        }

        await sleep(DELAY_MS);

        const canaisIA = Array.isArray(categoria?.canais) ? categoria.canais.slice(0, MAX_CANAIS_POR_CATEGORIA) : [];

        for (const canal of canaisIA) {

            const nomeCanalBase = limparNomeCanal(canal?.nome);
            const nomeCanalFinal = nomeUnico(adicionarEmojiCanal(nomeCanalBase, usarEmojis, divisoriaCanal), nomesCanaisUsados);
            const tipo = TIPO_CANAL[String(canal?.tipo || "texto").toLowerCase()] ?? ChannelType.GuildText;
            const temTopico = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(tipo);
            const ehAnuncio = tipo === ChannelType.GuildAnnouncement;

            try {

                const permissionOverwrites = construirPermissoes({
                    guildId: guild.id, tipo, ehAnuncio, ehCategoria: false,
                    restrita, segurancaReforcada, cargosStaff
                });

                await guild.channels.create({
                    name: nomeCanalFinal,
                    type: tipo,
                    parent: categoriaObj.id,
                    topic: temTopico ? (canal?.topico || undefined) : undefined,
                    rateLimitPerUser: tipo === ChannelType.GuildText ? Math.min(Math.max(Number(canal?.lento) || 0, 0), 21600) : undefined,
                    permissionOverwrites,
                    reason: "Criado via /criar-servidor (IA)"
                });

                canaisCriados++;

            } catch (e) {

                erros.push(`Não foi possível criar o canal "${nomeCanalFinal}": ${e.message}`);

            }

            await sleep(DELAY_MS);

        }

    }

    return { cargosCriados, categoriasCriadas, canaisCriados, erros };

}

module.exports = {
    DIVISOR_PADRAO_CATEGORIA,
    DIVISOR_PADRAO_CANAL,
    SESSAO_EXPIRA_MS,
    sanitizarDivisorCanal,
    sanitizarDivisorCategoria,
    parseSimNao,
    resumirTexto,
    criarSessao,
    getSessao,
    encerrarSessao,
    aplicarEstrutura
};
