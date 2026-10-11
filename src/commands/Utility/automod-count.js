const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../utils/ui");

const META_REGRAS = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("automod-count")
        .setDescription("Conta as regras nativas de AutoMod da Nina em todos os servidores."),

    async execute(interaction) {
        const ownerId = String(process.env.OWNER_ID || "").trim();

        // A contagem global revela informações sobre os servidores onde a Nina está.
        // Por isso, o comando fica restrito ao dono configurado no .env.
        if (!ownerId || interaction.user.id !== ownerId) {
            return ui.respond(
                interaction,
                ui.error(
                    ownerId
                        ? "Este comando é exclusivo do responsável pela Nina."
                        : "Configure OWNER_ID no .env com o ID da sua conta do Discord para usar a contagem global.",
                    "Acesso restrito",
                    interaction
                ),
                { ephemeral: true }
            );
        }

        await interaction.deferReply({ ephemeral: true });

        const client = interaction.client;
        const botId = client.user.id;
        const resultados = [];
        const falhas = [];
        let totalRegrasNina = 0;
        let totalRegrasNativas = 0;

        for (const guild of client.guilds.cache.values()) {
            try {
                const me = guild.members.me || await guild.members.fetchMe();

                if (!me.permissions.has("ManageGuild")) {
                    falhas.push({ name: guild.name, reason: "sem permissão Gerenciar Servidor" });
                    continue;
                }

                const rules = await guild.autoModerationRules.fetch();
                const regrasNina = rules.filter(rule => rule.creatorId === botId);

                totalRegrasNina += regrasNina.size;
                totalRegrasNativas += rules.size;
                resultados.push({
                    name: guild.name,
                    id: guild.id,
                    nina: regrasNina.size,
                    total: rules.size
                });
            } catch (error) {
                falhas.push({ name: guild.name, reason: error?.message || "erro ao consultar" });
                console.warn(`[AutoModCount] Não foi possível consultar ${guild.name} (${guild.id}):`, error?.message || error);
            }
        }

        resultados.sort((a, b) => b.nina - a.nina || a.name.localeCompare(b.name, "pt-BR"));

        const percentual = Math.min(100, Math.round((totalRegrasNina / META_REGRAS) * 100));
        const faltam = Math.max(0, META_REGRAS - totalRegrasNina);
        const listaServidores = resultados
            .filter(guild => guild.nina > 0)
            .slice(0, 15)
            .map(guild => `• **${ui.clip(guild.name, 70)}** — ${guild.nina} regra(s)`);

        const detalhesFalhas = falhas
            .slice(0, 8)
            .map(guild => `• **${ui.clip(guild.name, 60)}** — ${ui.clip(guild.reason, 100)}`);

        const fields = [
            ui.field("shield", "Regras criadas pela Nina", `**${totalRegrasNina} / ${META_REGRAS}**\n${ui.bar(totalRegrasNina, META_REGRAS, 18)}  **${percentual}%**`, false),
            ui.field("chart", "Todas as regras nativas encontradas", `${totalRegrasNativas}`, true),
            ui.field("info", "Servidores consultados", `${resultados.length}`, true),
            ui.field("info", "Progresso até 100", faltam === 0 ? "Meta numérica alcançada. Confira os requisitos atuais do Discord para o emblema." : `Faltam **${faltam}** regra(s) criadas pela Nina.`, false),
            ui.field("log", "Regras da Nina por servidor", listaServidores.length ? listaServidores.join("\n") : "Nenhuma regra criada pela Nina foi encontrada nos servidores consultados.", false)
        ];

        if (falhas.length) {
            fields.push(ui.field(
                "warn",
                `Servidores não consultados (${falhas.length})`,
                `${detalhesFalhas.join("\n") || "Não foi possível consultar esses servidores."}${falhas.length > 8 ? `\n• E mais ${falhas.length - 8} servidor(es).` : ""}`,
                false
            ));
        }

        const descricao = falhas.length
            ? "A contagem pode estar incompleta porque alguns servidores não puderam ser consultados. Conceda à Nina a permissão **Gerenciar Servidor** e execute novamente."
            : "Consulta concluída em todos os servidores acessíveis à Nina. O contador considera regras nativas cujo criador é a própria Nina; os filtros internos do bot não entram nessa contagem.";

        const embed = ui.panel({
            color: totalRegrasNina >= META_REGRAS ? ui.COLORS.success : ui.COLORS.brand,
            emoji: "shield",
            title: "Nina • Rastreador de AutoMod",
            description: descricao,
            fields,
            footer: `Atualizado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
            source: interaction
        });

        return interaction.editReply({ embeds: [embed] });
    }
};
