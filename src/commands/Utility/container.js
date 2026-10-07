const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    InteractionContextType,
    MessageFlags
} = require("discord.js");

const ContainerManager =
    require("../../managers/ContainerManager");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("container")

        .setDescription(
            "Abre o editor de Components V2 da Nina."
        )

        .setContexts(InteractionContextType.Guild)

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )

        .addAttachmentOption(option =>
            option
                .setName("arquivo")
                .setDescription(
                    "Importa um container.json exportado antes (opcional)."
                )
                .setRequired(false)
        ),

    async execute(interaction) {

        const file = interaction.options.getAttachment("arquivo");

        let data = ContainerManager.defaultData();

        /*
        =========================
            IMPORTAR ARQUIVO
        =========================
        Baixar o anexo pode passar dos 3s da interação, então respondemos
        em modo "pensando" (só você vê). Se der erro, o aviso fica privado;
        se der certo, o editor é postado normalmente no canal.
        */

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        if (file) {

            try {

                data = await ContainerManager.importAttachment(file);

            } catch (error) {

                return interaction.editReply({
                    content:
                        `❌ Não consegui importar o container.\n\`${error.message}\``
                });

            }

        }

        /*
        =========================
            ABRIR EDITOR
        =========================
        */

        await interaction.deleteReply();

        const sent = await interaction.followUp(
            ContainerManager.message(data, true)
        );

        // A sessão é identificada pela mensagem do editor: os botões
        // (tratados em events/interactionCreate.js) a encontram por ela.
        ContainerManager.startSession(
            sent.id,
            interaction.user.id,
            data
        );

    }

};
