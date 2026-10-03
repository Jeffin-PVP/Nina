const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ui = require("../utils/ui");

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

        // Cor da embed: aceita "#5865F2" / "5865F2"; se for inválida, usa a cor da marca
        const parsedColor = /^#?[0-9a-f]{6}$/i.test(color ?? "")
            ? parseInt(color.replace("#", ""), 16)
            : ui.COLORS.info;

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

                    .setColor(parsedColor)

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

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "mail",
                title: "Mensagem enviada",
                description: `Sua ${type === "embed" ? "embed" : "mensagem"} chegou na DM de ${user}.`,
                thumbnail: user.displayAvatarURL({ size: 128 }),
                fields: [
                    ui.field("user", "Destinatário", `${user}\n\`${user.id}\``),
                    ui.field("mail", "Formato", type === "embed" ? "Embed" : "Texto simples")
                ],
                source: interaction
            }), { ephemeral: true });

        } catch (err) {

            console.error(err);

            return ui.fail(
                interaction,
                "Não foi possível enviar a DM.\nO usuário provavelmente está com mensagens privadas desativadas ou bloqueou o bot.",
                "DM não enviada"
            );

        }

    }

};
