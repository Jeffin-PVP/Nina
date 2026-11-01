const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("enquete")
        .setDescription("Cria uma enquete rápida com até 5 opções.")
        .addStringOption(option => option.setName("titulo").setDescription("Título da enquete.").setRequired(true))
        .addStringOption(option => option.setName("opcoes").setDescription("Opções separadas por ; ex.: Sim;Não;Talvez").setRequired(true))
        .addIntegerOption(option => option.setName("duracao").setDescription("Duração em minutos.").setRequired(false).setMinValue(1).setMaxValue(10080)),

    async execute(interaction) {
        const title = interaction.options.getString("titulo", true);
        const rawOptions = interaction.options.getString("opcoes", true).split(";").map(item => item.trim()).filter(Boolean);
        const duration = interaction.options.getInteger("duracao") ?? 60;

        if (rawOptions.length < 2 || rawOptions.length > 5) {
            return interaction.reply({ content: "Use de 2 a 5 opções separadas por ponto e vírgula.", ephemeral: true });
        }

        const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
        const description = rawOptions.map((option, index) => `${reactions[index]} ${option}`).join("\n");

        const message = await interaction.reply({
            content: `📊 **${title}**\n\n${description}\n\n⏱️ Duração: ${duration} minutos`,
            fetchReply: true
        });

        for (let index = 0; index < rawOptions.length; index++) {
            await message.react(reactions[index]).catch(() => null);
        }

        if (duration > 0) {
            setTimeout(async () => {
                try {
                    const refreshed = await message.fetch();
                    const summary = rawOptions.map((option, index) => {
                        const emoji = reactions[index];
                        const count = refreshed.reactions.cache.get(emoji)?.count ?? 0;
                        return `${emoji} ${option}: ${count}`;
                    }).join("\n");

                    await refreshed.reply({ content: `✅ Resultado da enquete **${title}**\n\n${summary}` });
                } catch {
                    // ignora falhas em finalização
                }
            }, duration * 60 * 1000);
        }
    }
};
