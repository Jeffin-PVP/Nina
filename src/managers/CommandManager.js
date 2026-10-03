const ui = require("../utils/ui");
const commands = require("../commands");
const CooldownManager = require("./CooldownManager");

class CommandManager {

    static get(name) {

        return commands[name];

    }

    static async execute(interaction) {

        const command =
            commands[interaction.commandName];

        if (!command) return;

        // Cooldown opcional: qualquer comando pode ter `cooldown: <segundos>`
        if (command.cooldown) {

            const restanteMs = CooldownManager.check(
                interaction.commandName,
                interaction.user.id,
                command.cooldown
            );

            if (restanteMs > 0) {

                return ui.respond(interaction, ui.panel({
                    color: ui.COLORS.warn,
                    emoji: "clock",
                    title: "Calma aí!",
                    description:
                        `${ui.mood("nervosa")} Você pode usar \`/${interaction.commandName}\` de novo ${ui.ts(Date.now() + restanteMs)} ` +
                        `(**${(restanteMs / 1000).toFixed(1)}s**).`,
                    source: interaction
                }), { ephemeral: true });

            }

        }

        return command.execute(interaction);

    }

}

module.exports = CommandManager;