const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("role")

        .setDescription("Adiciona ou remove um cargo de um membro.")

        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        .addSubcommand(sub =>

            sub
                .setName("adicionar")
                .setDescription("Adiciona um cargo a um membro.")
                .addUserOption(o => o.setName("membro").setDescription("Membro.").setRequired(true))
                .addRoleOption(o => o.setName("cargo").setDescription("Cargo a adicionar.").setRequired(true))

        )

        .addSubcommand(sub =>

            sub
                .setName("remover")
                .setDescription("Remove um cargo de um membro.")
                .addUserOption(o => o.setName("membro").setDescription("Membro.").setRequired(true))
                .addRoleOption(o => o.setName("cargo").setDescription("Cargo a remover.").setRequired(true))

        ),

    async execute(interaction) {

        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const member = interaction.options.getMember("membro");
        const role = interaction.options.getRole("cargo");

        if (!member) {

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Membro não encontrado no servidor.")]
            });

        }

        const botMember = interaction.guild.members.me;

        if (role.managed || role.id === interaction.guild.id) {

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Esse cargo não pode ser gerenciado manualmente (é um cargo de integração ou o @everyone).")]
            });

        }

        if (role.position >= botMember.roles.highest.position) {

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Esse cargo está em uma posição igual ou superior ao meu cargo mais alto.")]
            });

        }

        try {

            if (sub === "adicionar") {

                if (member.roles.cache.has(role.id)) {

                    return interaction.editReply({
                        embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`⚠️ ${member} já tem o cargo ${role}.`)]
                    });

                }

                await member.roles.add(role, `Adicionado por ${interaction.user.tag}`);

                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(0x30D158).setDescription(`✅ Cargo ${role} adicionado a ${member}.`)]
                });

            }

            if (!member.roles.cache.has(role.id)) {

                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor("Yellow").setDescription(`⚠️ ${member} não tem o cargo ${role}.`)]
                });

            }

            await member.roles.remove(role, `Removido por ${interaction.user.tag}`);

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0x30D158).setDescription(`✅ Cargo ${role} removido de ${member}.`)]
            });

        } catch (error) {

            console.error(error);

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Não consegui alterar os cargos desse membro.")]
            });

        }

    }

};
