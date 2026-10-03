const GiveawayRepository = require("../../database/repositories/GiveawayRepository");
const GiveawayManager = require("../../managers/GiveawayManager");
const ui = require("../../utils/ui");

module.exports = {

    async execute(interaction) {

        const giveawayId = Number(interaction.customId.split("_")[2]);

        const giveaway = await GiveawayRepository.get(giveawayId);

        if (!giveaway || giveaway.status !== "running") {

            return ui.caution(interaction, "Esse sorteio não está mais ativo.", "Sorteio encerrado");

        }

        if (giveaway.required_role_id && !interaction.member.roles.cache.has(giveaway.required_role_id)) {

            return ui.caution(
                interaction,
                `Você precisa do cargo <@&${giveaway.required_role_id}> para participar deste sorteio.`,
                "Cargo necessário"
            );

        }

        const jaParticipa = await GiveawayRepository.hasEntry(giveawayId, interaction.user.id);

        if (jaParticipa) {

            await GiveawayRepository.removeEntry(giveawayId, interaction.user.id);

            await ui.respond(interaction, ui.panel({
                color: ui.COLORS.neutral,
                emoji: "gift",
                title: "Você saiu do sorteio",
                description: `Sua participação em **${giveaway.prize}** foi removida. Clique em **Participar** de novo se mudar de ideia.`,
                source: interaction
            }), { ephemeral: true });

        } else {

            await GiveawayRepository.addEntry(giveawayId, interaction.user.id);

            await ui.respond(interaction, ui.panel({
                color: ui.COLORS.success,
                emoji: "gift",
                title: "Você entrou no sorteio!",
                description: `Boa sorte! Você está concorrendo a **${giveaway.prize}**.\nO resultado sai ${ui.ts(giveaway.ends_at)}.`,
                source: interaction
            }), { ephemeral: true });

        }

        const totalParticipantes = await GiveawayRepository.countEntries(giveawayId);
        const embedAtualizado = GiveawayManager.buildEmbedAtivo(giveaway, totalParticipantes);

        await interaction.message.edit({ embeds: [embedAtualizado] }).catch(() => {});

    }

};
