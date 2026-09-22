const { MessageFlags } = require("discord.js");
module.exports = {

    async execute(interaction) {

        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("selfrole_")) return;

        const roleId = interaction.customId.replace("selfrole_", "");
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {

            return interaction.reply({
                content: "⚠️ Esse cargo não existe mais.",
                flags: MessageFlags.Ephemeral
            });

        }

        const botMember = interaction.guild.members.me;

        if (
            !botMember.permissions.has("ManageRoles") ||
            role.position >= botMember.roles.highest.position
        ) {

            return interaction.reply({
                content: "⚠️ Não consigo gerenciar esse cargo (posição dele é maior ou igual à minha).",
                flags: MessageFlags.Ephemeral
            });

        }

        const has = interaction.member.roles.cache.has(roleId);

        if (has) {

            await interaction.member.roles.remove(role).catch(() => null);

            return interaction.reply({
                content: `➖ Cargo **${role.name}** removido.`,
                flags: MessageFlags.Ephemeral
            });

        }

        await interaction.member.roles.add(role).catch(() => null);

        return interaction.reply({
            content: `➕ Cargo **${role.name}** adicionado.`,
            flags: MessageFlags.Ephemeral
        });

    }

};
