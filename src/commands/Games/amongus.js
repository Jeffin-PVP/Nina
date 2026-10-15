const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('amongus')
    .setDescription('Cria um anúncio para uma sala de Among Us.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle('👾 Central de salas — Among Us')
      .setDescription([
        'Crie um anúncio para chamar o pessoal para sua partida.',
        '',
        '**Como funciona**',
        '1. Clique em **Criar anúncio**.',
        '2. Informe o código, região, mapa e vagas.',
        '3. Escolha o canal e o cargo que receberá o ping.',
        '4. Confira e publique o anúncio.',
        '',
        'A Nina mencionará somente o cargo escolhido.'
      ].join('\n'))
      .setFooter({ text: 'Nina • Among Us' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('amongus:create')
        .setLabel('Criar anúncio')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};
