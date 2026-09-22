const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("ajuda")

        .setDescription("Mostra todos os comandos do bot, organizados por categoria.")

        .addStringOption(o =>
            o.setName("comando")
                .setDescription("Nome de um comando específico para ver detalhes.")
                .setRequired(false)
        ),

    async execute(interaction) {

        const commands = interaction.client.commands;
        const nomeComando = interaction.options.getString("comando")?.replace(/^\//, "").trim();

        /*
        =========================
            DETALHE DE UM COMANDO
        =========================
        */

        if (nomeComando) {

            const command = commands.get(nomeComando);

            if (!command) {

                return interaction.reply({
                    content: `⚠️ Não encontrei nenhum comando chamado \`${nomeComando}\`.`,
                    flags: MessageFlags.Ephemeral
                });

            }

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(`/${command.data.name}`)
                .setDescription(command.data.description || "Sem descrição.")
                .addFields({ name: "Categoria", value: command.category || "📌 Geral", inline: true });

            if (command.cooldown) {

                embed.addFields({ name: "Cooldown", value: `${command.cooldown}s`, inline: true });

            }

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        }

        /*
        =========================
            LISTA COMPLETA
        =========================
        */

        const porCategoria = new Map();

        for (const command of commands.values()) {

            const categoria = command.category || "📌 Geral";

            if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);

            porCategoria.get(categoria).push(command.data.name);

        }

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("📚 Comandos da Nina")
            .setDescription(
                `Use \`/ajuda comando:<nome>\` para ver detalhes de um comando específico.\n` +
                `**Total:** ${commands.size} comandos.`
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: "Nina • Desenvolvida por JeffinPVP" });

        for (const [categoria, nomes] of [...porCategoria.entries()].sort(([a], [b]) => a.localeCompare(b))) {

            const lista = nomes.sort().map(n => `\`/${n}\``).join(", ");

            embed.addFields({
                name: categoria,
                value: lista.length > 1000 ? `${lista.slice(0, 1000)}…` : lista
            });

        }

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    }

};
