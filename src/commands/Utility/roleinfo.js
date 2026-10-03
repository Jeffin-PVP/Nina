const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const ui = require("../../utils/ui");
const { e } = require("../../utils/emojis");

const yesNo = value => value ? `${e("ok")} Sim` : `${e("error")} Não`;

module.exports = {

    data: new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Mostra informações sobre um cargo.")
        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo a consultar.")
                .setRequired(true)
        ),

    async execute(interaction) {

        const role = interaction.options.getRole("cargo");

        const embed = ui.titled(role.color || ui.COLORS.brand, "role", role.name, null, interaction)
            .addFields(
                { name: `${e("id")} ID`, value: `\`${role.id}\``, inline: true },
                { name: `${e("sparkle")} Cor`, value: `\`${role.hexColor}\``, inline: true },
                { name: `${e("crown")} Posição`, value: `${role.position}`, inline: true },
                { name: `${e("user")} Membros`, value: ui.num(role.members.size), inline: true },
                { name: `${e("calendar")} Criado`, value: ui.ts(role.createdTimestamp, "D"), inline: true },
                { name: `${e("shield")} Administrador`, value: yesNo(role.permissions.has(PermissionFlagsBits.Administrator)), inline: true },
                { name: "Mencionável", value: yesNo(role.mentionable), inline: true },
                { name: "Separado na lista", value: yesNo(role.hoist), inline: true },
                { name: "Integração", value: yesNo(role.managed), inline: true }
            );

        const icon = role.iconURL?.({ size: 128 });

        if (icon) embed.setThumbnail(icon);

        return interaction.reply({ embeds: [embed] });

    }

};
