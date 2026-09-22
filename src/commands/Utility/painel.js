const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("painel")

        .setDescription("Acesso ao painel de controle de gerenciamento do servidor."),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor("#5f9fff")
            .setTitle("🖥 Painel de Controle")
            .setDescription(
                `Acesse [https://nina.injectcloud.space/panel] para acessar o painel de controle do bot para gerenciar o bot/servidor **Somente nos servidores que você é dono ou administrador!**.\n`
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: "Nina • Desenvolvida por JeffinPVP" });


        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    }

};
