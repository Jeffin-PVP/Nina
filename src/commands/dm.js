const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("dm")

        .setDescription("Envia uma mensagem privada para um usuário.")

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )

        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá a mensagem.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("tipo")
                .setDescription("Tipo da mensagem.")
                .setRequired(true)
                .addChoices(
                    {
                        name: "Mensagem",
                        value: "message"
                    },
                    {
                        name: "Embed",
                        value: "embed"
                    }
                )
        )

        .addStringOption(option =>
            option
                .setName("mensagem")
                .setDescription("Conteúdo da mensagem.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("titulo")
                .setDescription("Título da embed.")
                .setRequired(false)
        )

        .addStringOption(option =>
            option
                .setName("cor")
                .setDescription("Cor da embed. Ex: #5865F2")
                .setRequired(false)
        )

        .addBooleanOption(option =>
            option
                .setName("mostrar_autor")
                .setDescription("Mostrar quem enviou a mensagem?")
                .setRequired(false)
        ),

    async execute(interaction) {

        const user =
            interaction.options.getUser("usuario");

        const type =
            interaction.options.getString("tipo");

        const message =
            interaction.options.getString("mensagem");

        const title =
            interaction.options.getString("titulo");

        const color =
            interaction.options.getString("cor");

        const showAuthor =
            interaction.options.getBoolean("mostrar_autor") ?? false;

        try {

            if (type === "message") {

                let content = message;

                if (showAuthor) {

                    content += `\n\n— ${interaction.user.tag}`;

                }

                await user.send(content);

            } else {

                const embed = new EmbedBuilder()

                    .setDescription(message)

                    .setColor(color || 0x5865F2)

                    .setTimestamp();

                if (title) {

                    embed.setTitle(title);

                }

                if (showAuthor) {

                    embed.setAuthor({

                        name: interaction.user.tag,

                        iconURL: interaction.user.displayAvatarURL()

                    });

                } else {

                    embed.setAuthor({

                        name: interaction.guild.name,

                        iconURL: interaction.guild.iconURL() || undefined

                    });

                }

                await user.send({

                    embeds: [embed]

                });

            }

            return interaction.reply({

                content:
                    `✅ Mensagem enviada para **${user.tag}**.`,

                flags: MessageFlags.Ephemeral

            });

        } catch (err) {

            console.error(err);

            return interaction.reply({

                content:
                    "❌ Não foi possível enviar a DM.\nO usuário provavelmente está com mensagens privadas desativadas ou bloqueou o bot.",

                flags: MessageFlags.Ephemeral

            });

        }

    }

};