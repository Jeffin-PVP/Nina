const {
    SlashCommandBuilder,
    PermissionFlagsBits,
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

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {

        /*
        =========================
            CRIAR SESSÃO
        =========================
        */

        const sessionId =
            ContainerManager.sessionId(
                interaction.guildId,
                interaction.user.id
            );

        ContainerManager.create(
            sessionId
        );

        const data =
            ContainerManager.get(
                sessionId
            );

        /*
        =========================
            ABRIR EDITOR
        =========================
        */

        await interaction.reply(
            ContainerManager.message(
                data,
                true
            )
        );

        const message =
            await interaction.fetchReply();

        /*
        =========================
            COLLECTOR
        =========================
        */

        const collector =
            message.createMessageComponentCollector({

                time: 30 * 60 * 1000,

                filter: component =>

                    component.user.id ===
                    interaction.user.id &&

                    component.customId.startsWith(
                        "container:"
                    )
            });

        collector.on(
            "collect",
            async component => {

                try {

                    await ContainerManager.handleButton(
                        component
                    );

                } catch (error) {

                    console.error(
                        "❌ [Container] Erro:",
                        error
                    );

                    try {

                        if (
                            !component.replied &&
                            !component.deferred
                        ) {

                            await component.reply({

                                content:
                                    `❌ Erro no editor: ${error.message}`,

                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                    } catch {}
                }
            }
        );

        /*
        =========================
            FINALIZAR SESSÃO
        =========================
        */

        collector.on(
            "end",
            () => {

                ContainerManager.remove(
                    sessionId
                );

            }
        );
    }
};