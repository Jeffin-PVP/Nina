const ui = require("../../utils/ui");

module.exports = {

    async execute(interaction) {

        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("selfrole_")) return;

        const roleId = interaction.customId.replace("selfrole_", "");
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {

            return ui.caution(interaction, "Esse cargo não existe mais. Avise um administrador.", "Cargo não encontrado");

        }

        const botMember = interaction.guild.members.me;

        if (
            !botMember.permissions.has("ManageRoles") ||
            role.position >= botMember.roles.highest.position
        ) {

            return ui.caution(
                interaction,
                "Não consigo gerenciar esse cargo: a posição dele é maior ou igual à minha. Peça a um administrador para subir o meu cargo.",
                "Não consigo dar esse cargo"
            );

        }

        const has = interaction.member.roles.cache.has(roleId);

        if (has) {

            await interaction.member.roles.remove(role).catch(() => null);

            return ui.respond(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "role",
                title: "Cargo removido",
                description: `Você não tem mais o cargo ${role}.`,
                source: interaction
            }), { ephemeral: true });

        }

        await interaction.member.roles.add(role).catch(() => null);

        return ui.respond(interaction, ui.panel({
            color: ui.COLORS.success,
            emoji: "role",
            title: "Cargo adicionado",
            description: `Agora você tem o cargo ${role}.`,
            source: interaction
        }), { ephemeral: true });

    }

};
