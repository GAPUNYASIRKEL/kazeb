require('dotenv').config(); // Mengimpor dotenv

const { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates // Intent untuk menangani voice channel
  ]
});

// Menggunakan token dari .env
const token = process.env.DISCORD_TOKEN;

let logChannelIDs = new Map();

client.on('ready', async () => {
  console.log(`${client.user.tag} is logged in!`);

  const commands = [
    new SlashCommandBuilder()
      .setName('setlogchannel')
      .setDescription('Menetapkan channel untuk log pesan yang dihapus dan diedit')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Pilih channel untuk log')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ].map(command => command.toJSON());

  await client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'setlogchannel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    if (channel.type === ChannelType.GuildText) {
      // Simpan log channel untuk server ini
      logChannelIDs.set(interaction.guild.id, channel.id);
      await interaction.reply(`✅ Channel log diatur ke ${channel.name} di server ini.`);
    } else {
      await interaction.reply('❌ Harap pilih channel teks untuk log!');
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const logChannelID = logChannelIDs.get(newState.guild.id);
  if (!logChannelID) return;

  const logChannel = await client.channels.fetch(logChannelID);
  if (!logChannel || !logChannel.isTextBased()) return;

  const member = newState.member;

  const avatarURL = member.user.avatarURL({ dynamic: true, size: 1024 }) || member.user.defaultAvatarURL;

  if (!oldState.channel && newState.channel) {
    const embed = new EmbedBuilder()
      .setTitle('🎧 Member Joined Voice Channel')
      .setColor('#00ff00')
      .setThumbnail(avatarURL)
      .addFields(
        { name: '📌 Member', value: `${member.user.tag}`, inline: true },
        { name: '📢 Channel', value: `${newState.channel.name}`, inline: true }
      )
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    logChannel.send({ embeds: [embed] });
  }

  if (oldState.channel && !newState.channel) {
    const embed = new EmbedBuilder()
      .setTitle('🎧 Member Left Voice Channel')
      .setColor('#ff0000')
      .setThumbnail(avatarURL)
      .addFields(
        { name: '📌 Member', value: `${member.user.tag}`, inline: true },
        { name: '📢 Channel', value: `${oldState.channel.name}`, inline: true }
      )
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    logChannel.send({ embeds: [embed] });
  }
});

const messageCache = new Map();
client.on('messageCreate', async (message) => {
  if (!message.author.bot) {
    messageCache.set(message.id, message);
  }
});

client.on('messageDelete', async (message) => {
  if (message.author.bot) return;

  const logChannelID = logChannelIDs.get(message.guild.id);
  if (!logChannelID) return;

  const logChannel = await client.channels.fetch(logChannelID);
  if (!logChannel || !logChannel.isTextBased()) return;

  let cachedMessage = messageCache.get(message.id);
  if (!cachedMessage) cachedMessage = message;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setColor('#ff0000')
    .addFields(
      { name: '📌 Author', value: `${cachedMessage.author.tag}`, inline: true },
      { name: '📢 Channel', value: `<#${cachedMessage.channel.id}>`, inline: true }
    )
    .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

  if (cachedMessage.content) {
    embed.addFields({ name: '💬 Content', value: cachedMessage.content });
  }

  if (cachedMessage.attachments.size > 0) {
    cachedMessage.attachments.forEach(attachment => {
      embed.addFields({ name: '📎 Attachment Deleted', value: `[View File](${attachment.url})` });
      embed.setImage(attachment.url);
    });
  }

  if (cachedMessage.stickers.size > 0) {
    cachedMessage.stickers.forEach(sticker => {
      let stickerUrl = `https://media.discordapp.net/stickers/${sticker.id}.png`;
      if (sticker.format === 3) {
        stickerUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.apng`;
      }
      embed.addFields({ name: '🎭 Sticker Deleted', value: `**${sticker.name}**\n[View Sticker](${stickerUrl})` });
      embed.setImage(stickerUrl);
    });
  }

  logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return;

  const logChannelID = logChannelIDs.get(oldMessage.guild.id);
  if (!logChannelID) return;

  const logChannel = await client.channels.fetch(logChannelID);
  if (!logChannel || !logChannel.isTextBased()) return;

  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Message Edited')
    .setColor('#ffaa00')
    .addFields(
      { name: '📌 Author', value: `${oldMessage.author.tag}`, inline: true },
      { name: '📢 Channel', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: '📝 Before', value: oldMessage.content || 'Tidak ada teks', inline: false },
      { name: '📝 After', value: newMessage.content || 'Tidak ada teks', inline: false }
    )
    .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

  logChannel.send({ embeds: [embed] });
});

// Menggunakan token dari .env
client.login(token);
