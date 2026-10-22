require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { iniciarReveyl } = require('./reveyl');

const ApiServer =
    require("./src/api/server");

const GiveawayManager =
    require("./src/managers/GiveawayManager");

const PresenceManager =
    require("./src/managers/PresenceManager");

const StatsHistoryManager =
    require("./src/managers/StatsHistoryManager");

const AnalyticsRepository =
    require("./src/database/repositories/AnalyticsRepository");

const ServerStatsManager =
    require("./src/managers/ServerStatsManager");

const GlobalBanManager =
    require("./src/managers/GlobalBanManager");

const TempVoiceManager =
    require("./src/managers/TempVoiceManager");

const VoiceRecordingManager =
    require("./src/managers/VoiceRecordingManager");

const Emojis =
    require("./src/utils/emojis");

const NativeAutomodSync =
    require("./src/managers/NativeAutomodSync");

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    Events,
    Options
} = require("discord.js");

const commands =
    require("./src/commands");

process.on("unhandledRejection", error => {
    console.error("❌ Promise rejeitada sem tratamento:", error);
});

process.on("uncaughtException", error => {
    console.error("❌ Exceção não capturada:", error);
});

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMembers,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.GuildMessageReactions,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.GuildVoiceStates,

        GatewayIntentBits.GuildPresences,

        // eventos das regras nativas de AutoMod (warn + log da Nina)
        GatewayIntentBits.AutoModerationExecution

    ],

    partials: [

        Partials.Channel,

        Partials.Message,

        Partials.Reaction,

        Partials.User

    ],

    // ===============================
    // ECONOMIA DE RAM
    // ===============================
    // O discord.js guarda em cache muita coisa que a Nina não usa
    // (reações, convites, eventos...). Aqui limitamos esses caches.
    makeCache: Options.cacheWithLimits({

        ...Options.DefaultMakeCacheSettings,

        // Só mantém as últimas mensagens de cada canal (usadas nos logs de
        // edição/exclusão); o sweeper abaixo limpa as antigas.
        MessageManager: 50,

        // Não usados pelo bot
        ReactionManager: 0,
        ReactionUserManager: 0,
        GuildScheduledEventManager: 0,
        StageInstanceManager: 0,
        GuildInviteManager: 0,
        GuildBanManager: 0,
        ThreadMemberManager: 0,
        DMMessageManager: 0,
        EntitlementManager: 0

        // Presences e VoiceStates ficam no padrão: os contadores Online/Em call usam

    }),

    sweepers: {

        ...Options.DefaultSweeperSettings,

        // A cada 10 min remove mensagens com mais de 1h do cache
        messages: {
            interval: 600,
            lifetime: 3600
        },

        // Threads arquivadas há mais de 1h
        threads: {
            interval: 3600,
            lifetime: 3600
        }

    }

});


// ===============================
// COMMANDS
// ===============================

client.commands = new Collection();

for (const command of Object.values(commands)) {

    client.commands.set(

        command.data.name,

        command

    );

}


// ===============================
// EVENTS
// ===============================

const eventsPath = path.join(

    __dirname,

    "src",

    "events"

);

if (fs.existsSync(eventsPath)) {

    const eventFiles = fs.readdirSync(eventsPath)

        .filter(file => file.endsWith(".js"));

    for (const file of eventFiles) {

        const event = require(

            path.join(

                eventsPath,

                file

            )

        );

        client.on(
            event.name,
            (...args) => {
                Promise.resolve()
                    .then(() => event.execute(...args))
                    .catch(error => {
                        console.error(
                            `[Evento:${event.name}] Erro não tratado:`,
                            error
                        );
                    });
            }
        );

        console.log(
            `✔ Evento carregado: ${event.name}`
        );

    }

}


// ===============================
// API / DASHBOARD
// ===============================
// Sobe ANTES do login no Discord: se o bot demorar pra conectar (ou o
// login falhar), a plataforma de hospedagem ainda enxerga algo respondendo
// na porta — em vez de reportar o app inteiro como fora do ar.

const api =
    new ApiServer(client);

api.start(process.env.PORT || 3000);


// ===============================
// READY
// ===============================

client.once(

    Events.ClientReady,

    () => {

        console.clear();

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            "🤖 Nina"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        console.log(
            `👤 Logado como: ${client.user.tag}`
        );

        GiveawayManager.start(client);

        PresenceManager.start(client);

        StatsHistoryManager.start(client);

        AnalyticsRepository.syncActiveVoiceSessions(client).catch(error => {
            console.error("[Analytics] Falha ao sincronizar sessões de voz existentes:", error);
        });

        ServerStatsManager.start(client);

        GlobalBanManager.start().catch(error => {
            console.error("❌ Falha ao carregar banimentos globais:", error);
        });

        // Remove registros/canais temporários que sobraram após reinício do bot.
        for (const guild of client.guilds.cache.values()) {
            TempVoiceManager.cleanupGuild(guild).catch(error => {
                console.error(`❌ Falha na limpeza do TempVoice em ${guild.id}:`, error);
            });
        }

        // Finaliza gravações que ficaram "em andamento" por causa de um reinício.
        VoiceRecordingManager.recoverInterrupted(client);

        Emojis.sync(client);

        // Cria/atualiza as regras nativas de AutoMod em todos os servidores
        NativeAutomodSync.init(client);

        console.log(
            `🆔 ID: ${client.user.id}`
        );

        console.log(
            `🌍 Servidores: ${client.guilds.cache.size}`
        );

        console.log(
            `📶 Ping: ${client.ws.ping}ms`
        );

        console.log(
            process.env.GROQ_API_KEY
                ? "🟢 IA: Configurada (GROQ_API_KEY presente)"
                : "🔴 IA: GROQ_API_KEY ausente — respostas de IA vão falhar"
        );

        console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

    }

);

client.on(Events.Error, (error) => {

    console.error("❌ Erro no client do Discord:", error);

});

client.login(
    process.env.TOKEN
).catch((error) => {

    console.error("❌ Falha ao logar no Discord (verifique TOKEN e intents no Developer Portal):", error.message);
    console.error("🌐 O dashboard continua no ar mesmo assim, em modo 'bot offline'.");

});


iniciarReveyl(client);