const { randomBytes } = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const ui = require('../utils/ui');

const sessions = new Map();
const TTL = 10 * 60 * 1000;

function createSession(userId, guildId, data = {}) {
  const token = randomBytes(5).toString('hex');
  sessions.set(token, { userId, guildId, createdAt: Date.now(), ...data });
  return token;
}
function getSession(token, interaction) {
  const s = sessions.get(token);
  if (!s || Date.now() - s.createdAt > TTL) {
    sessions.delete(token);
    return null;
  }
  if (s.userId !== interaction.user.id || s.guildId !== interaction.guildId) return null;
  return s;
}
function selectionComponents(token) {
  return [
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`amongus:channel:${token}`)
        .setPlaceholder('Escolha o canal de anúncio')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`amongus:role:${token}`)
        .setPlaceholder('Escolha o cargo que será mencionado')
        .setMinValues(1).setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`amongus:publish:${token}`).setLabel('Publicar anúncio').setEmoji('📨').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`amongus:cancel:${token}`).setLabel('Cancelar').setEmoji('<:ui_cancel:1560326759059030188>️').setStyle(ButtonStyle.Secondary)
    )
  ];
}
function previewEmbed(data, interaction) {
  return new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle('👾 Sala de Among Us aberta!')
    .setDescription(data.notes || 'Entre na partida e venha jogar com a gente!')
    .addFields(
      { name: '🔑 Código da sala', value: `\`${data.code}\``, inline: true },
      { name: '🌎 Região', value: data.region, inline: true },
      { name: '🗺️ Mapa', value: data.map || 'Não informado', inline: true },
      { name: '👥 Jogadores', value: data.players ? `${data.players} vagas/jogadores` : 'Não informado', inline: true },
      { name: '🎮 Anfitrião', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: 'Nina • Among Us | Confira o código antes de entrar' })
    .setTimestamp();
}

async function openForm(interaction) {
  const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const token = createSession(interaction.user.id, interaction.guildId);
  const modal = new ModalBuilder().setCustomId(`amongus_modal:${token}`).setTitle('Criar sala de Among Us');
  const fields = [
    ['code', 'Código da sala', TextInputStyle.Short, 'Ex.: ABCDEF', true, 6],
    ['region', 'Região', TextInputStyle.Short, 'América do Norte, Europa ou Ásia', true, 40],
    ['map', 'Mapa', TextInputStyle.Short, 'The Skeld, Polus, Mira HQ, Airship...', false, 60],
    ['players', 'Jogadores / vagas', TextInputStyle.Short, 'Ex.: 10 jogadores, 3 vagas', false, 30],
    ['notes', 'Mensagem opcional', TextInputStyle.Paragraph, 'Regras, modo de jogo ou informações extras', false, 300]
  ];
  for (const [id, label, style, placeholder, required, maxLength] of fields) {
    const input = new TextInputBuilder().setCustomId(id).setStyle(style).setPlaceholder(placeholder).setRequired(required).setMaxLength(maxLength);
    modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
  }
  return interaction.showModal(modal);
}

async function handleModal(interaction) {
  const token = interaction.customId.split(':')[1];
  const session = getSession(token, interaction);
  if (!session) return ui.fail(interaction, 'Esse formulário expirou. Execute `/amongus` e tente novamente.', 'Sessão expirada');
  const code = interaction.fields.getTextInputValue('code').trim().toUpperCase().replace(/\s/g, '');
  const region = interaction.fields.getTextInputValue('region').trim();
  const map = interaction.fields.getTextInputValue('map').trim();
  const players = interaction.fields.getTextInputValue('players').trim();
  const notes = interaction.fields.getTextInputValue('notes').trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) return ui.caution(interaction, 'O código deve ter entre 4 e 10 letras ou números.', 'Código inválido');
  if (!region) return ui.caution(interaction, 'Informe a região da sala.', 'Região obrigatória');
  Object.assign(session, { code, region, map, players, notes, createdAt: Date.now() });
  const embed = previewEmbed(session, interaction).setTitle('Prévia do anúncio de Among Us');
  return interaction.reply({ content: 'Agora escolha onde publicar e qual cargo será mencionado. Você poderá conferir tudo antes do envio.', embeds: [embed], components: selectionComponents(token), ephemeral: true });
}

async function handleSelect(interaction) {
  const [, kind, token] = interaction.customId.split(':');
  const session = getSession(token, interaction);
  if (!session) return ui.fail(interaction, 'Esse anúncio expirou. Execute `/amongus` para começar de novo.', 'Sessão expirada');
  if (kind === 'channel') session.channelId = interaction.values[0];
  if (kind === 'role') session.roleId = interaction.values[0];
  session.createdAt = Date.now();
  const summary = `Canal: ${session.channelId ? `<#${session.channelId}>` : 'ainda não selecionado'}\nCargo: ${session.roleId ? `<@&${session.roleId}>` : 'ainda não selecionado'}`;
  return interaction.reply({ content: `**Seleção atualizada**\n${summary}`, ephemeral: true });
}

async function handleButton(interaction) {
  const [, action, token] = interaction.customId.split(':');
  if (action === 'create') return openForm(interaction);
  const session = getSession(token, interaction);
  if (!session) return ui.fail(interaction, 'Esse anúncio expirou. Execute `/amongus` para começar de novo.', 'Sessão expirada');
  if (action === 'cancel') {
    sessions.delete(token);
    return interaction.update({ content: 'Criação do anúncio cancelada.', embeds: [], components: [] });
  }
  if (action !== 'publish') return;
  if (!session.channelId || !session.roleId) return ui.caution(interaction, 'Selecione o canal e o cargo antes de publicar.', 'Faltam seleções');
  const guild = interaction.guild;
  const channel = await guild.channels.fetch(session.channelId).catch(() => null);
  const role = await guild.roles.fetch(session.roleId).catch(() => null);
  if (!channel?.isTextBased() || !role) return ui.fail(interaction, 'O canal ou o cargo selecionado não está mais disponível.', 'Seleção inválida');
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) return ui.caution(interaction, 'Escolha um canal de texto válido.', 'Canal inválido');
  const botMember = guild.members.me;
  const perms = channel.permissionsFor(botMember);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return ui.fail(interaction, 'Preciso das permissões Ver canal, Enviar mensagens e Incorporar links no canal selecionado.', 'Sem permissões');
  }
  const embed = previewEmbed(session, interaction);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`amongus:code:${session.code}`).setLabel('Ver código da sala').setEmoji('📋').setStyle(ButtonStyle.Secondary)
  );
  await channel.send({
    content: `<@&${role.id}>`, embeds: [embed], components: [row],
    allowedMentions: { parse: [], roles: [role.id], users: [], repliedUser: false }
  });
  sessions.delete(token);
  return interaction.update({ content: `✅ Anúncio publicado em ${channel}. O cargo ${role} foi mencionado.`, embeds: [], components: [] });
}

async function showCode(interaction) {
  const code = interaction.customId.split(':')[2];
  if (!/^[A-Z0-9]{4,10}$/.test(code || '')) return ui.caution(interaction, 'Não consegui ler o código desta sala.', 'Código indisponível');
  return interaction.reply({ content: `Código da sala: \`${code}\`\nClique no código para selecioná-lo e copiá-lo.`, ephemeral: true });
}

module.exports = { handleButton, handleModal, handleSelect, showCode };
