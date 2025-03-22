const { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates // Intent untuk menangani voice channel
  ]
});

// Gunakan Map untuk menyimpan logChannelID per server
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

// Menangani event voiceStateUpdate (untuk log siapa yang masuk dan keluar voice channel)
client.on('voiceStateUpdate', async (oldState, newState) => {
  const logChannelID = logChannelIDs.get(newState.guild.id);
  if (!logChannelID) return;

  const logChannel = await client.channels.fetch(logChannelID);
  if (!logChannel || !logChannel.isTextBased()) return;

  const member = newState.member;

  // Pastikan URL avatar valid dengan dynamic: true dan ukuran besar (1024px)
  const avatarURL = member.user.avatarURL({ dynamic: true, size: 1024 }) || member.user.defaultAvatarURL;

  if (!oldState.channel && newState.channel) {
    // Jika anggota baru bergabung dengan voice channel
    const embed = new EmbedBuilder()
      .setTitle('🎧 Member Joined Voice Channel')
      .setColor('#00ff00')
      .setThumbnail(avatarURL) // Menambahkan avatar
      .addFields(
        { name: '📌 Member', value: `${member.user.tag}`, inline: true },
        { name: '📢 Channel', value: `${newState.channel.name}`, inline: true }
      )
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    logChannel.send({ embeds: [embed] });
  }

  if (oldState.channel && !newState.channel) {
    // Jika anggota keluar dari voice channel
    const embed = new EmbedBuilder()
      .setTitle('🎧 Member Left Voice Channel')
      .setColor('#ff0000')
      .setThumbnail(avatarURL) // Menambahkan avatar
      .addFields(
        { name: '📌 Member', value: `${member.user.tag}`, inline: true },
        { name: '📢 Channel', value: `${oldState.channel.name}`, inline: true }
      )
      .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

    logChannel.send({ embeds: [embed] });
  }
});

// Simpan pesan sebelum dihapus ke dalam cache
const messageCache = new Map();
client.on('messageCreate', async (message) => {
  if (!message.author.bot) {
    messageCache.set(message.id, message);
  }
});

// Handle messageDelete event
client.on('messageDelete', async (message) => {
  if (message.author.bot) return;

  // Ambil logChannelID untuk server ini
  const logChannelID = logChannelIDs.get(message.guild.id);
  if (!logChannelID) return; // Jika tidak ada channel log yang diset, tidak melakukan apa-apa

  const logChannel = await client.channels.fetch(logChannelID);
  if (!logChannel || !logChannel.isTextBased()) return;

  let cachedMessage = messageCache.get(message.id);
  if (!cachedMessage) cachedMessage = message; // Jika tidak ada di cache, gunakan data dari event

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

  // Cek jika ada gambar/file yang dihapus
  if (cachedMessage.attachments.size > 0) {
    cachedMessage.attachments.forEach(attachment => {
      embed.addFields({ name: '📎 Attachment Deleted', value: `[View File](${attachment.url})` });
      embed.setImage(attachment.url);
    });
  }

  // Cek jika ada stiker yang dihapus
  if (cachedMessage.stickers.size > 0) {
    cachedMessage.stickers.forEach(sticker => {
      let stickerUrl = `https://media.discordapp.net/stickers/${sticker.id}.png`;
      if (sticker.format === 3) { // Format 3 = APNG (stiker bergerak)
        stickerUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.apng`;
      }
      embed.addFields({ name: '🎭 Sticker Deleted', value: `**${sticker.name}**\n[View Sticker](${stickerUrl})` });
      embed.setImage(stickerUrl);
    });
  }

  logChannel.send({ embeds: [embed] });
});

// Handle messageUpdate event
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author.bot) return;

  // Ambil logChannelID untuk server ini
  const logChannelID = logChannelIDs.get(oldMessage.guild.id);
  if (!logChannelID) return; // Jika tidak ada channel log yang diset, tidak melakukan apa-apa

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

client.login(token);