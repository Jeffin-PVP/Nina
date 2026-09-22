const { MessageFlags } = require("discord.js");
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

                return interaction.reply({
                    content: `⏳ Calma aí! Você pode usar \`/${interaction.commandName}\` de novo em **${(restanteMs / 1000).toFixed(1)}s**.`,
                    flags: MessageFlags.Ephemeral
                });

            }

        }

        return command.execute(interaction);

    }

}

module.exports = CommandManager;