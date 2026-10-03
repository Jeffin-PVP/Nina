const { SlashCommandBuilder } = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Mostra informações sobre um membro.")
        .addUserOption(option =>
            option
                .setName("membro")
                .setDescription("Membro a consultar (padrão: você).")
                .setRequired(false)
        ),

    async execute(interaction) {

        const picked = interaction.options.getUser("membro") ?? interaction.user;

        // fetch(true) traz banner e cor de destaque
        const user = await picked.fetch(true).catch(() => picked);
        const member = interaction.options.getMember("membro") ?? (picked.id === interaction.user.id ? interaction.member : null);

        const roles = member?.roles?.cache
            ?.filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position) ?? null;

        const color =
            member?.displayColor
            || user.accentColor
            || ui.COLORS.brand;

        const embed = ui.titled(color, "user", user.displayName ?? user.username, null, interaction)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setDescription(
                `${user}${user.bot ? "  •  🤖 **Bot**" : ""}\n` +
                `${e("id")} \`${user.id}\``
            )
            .addFields({
                name: `${e("calendar")} Conta criada`,
                value: `${ui.ts(user.createdTimestamp, "D")}\n${ui.ts(user.createdTimestamp)}`,
                inline: true
            });

        if (member) {

            embed.addFields({
                name: `${e("sparkle")} Entrou no servidor`,
                value: member.joinedTimestamp
                    ? `${ui.ts(member.joinedTimestamp, "D")}\n${ui.ts(member.joinedTimestamp)}`
                    : "Desconhecido",
                inline: true
            });

            if (member.premiumSinceTimestamp) {

                embed.addFields({
                    name: `${e("boost")} Impulsionando`,
                    value: ui.ts(member.premiumSinceTimestamp),
                    inline: true
                });

            }

            if (member.nickname) {

                embed.addFields({
                    name: `${e("nick")} Apelido`,
                    value: member.nickname,
                    inline: true
                });

            }

            if (roles?.size) {

                embed.addFields(
                    {
                        name: `${e("crown")} Cargo mais alto`,
                        value: `${roles.first()}`,
                        inline: true
                    },
                    {
                        name: `${e("role")} Cargos (${roles.size})`,
                        value: roles.first(15).join(" ") + (roles.size > 15 ? ` +${roles.size - 15}` : "")
                    }
                );

            }

        }

        if (user.banner) {

            embed.setImage(user.bannerURL({ size: 1024 }));

        }

        return interaction.reply({ embeds: [embed] });

    }

};
