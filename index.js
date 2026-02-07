// ===== Подключаем discord.js =====
const { Client, GatewayIntentBits } = require('discord.js');

// ===== Создаём клиента =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== Проверка TOKEN =====
if (!process.env.TOKEN) {
  console.log("❌ TOKEN не найден! Добавь его в Railway → Variables");
  process.exit(1);
}

// ===== Когда бот запустился =====
client.once('ready', () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
});

// ===== Пример команд =====
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }

  if (message.content === '!hello') {
    message.reply('Привет 👋');
  }
});

// ===== Логин =====
client.login(process.env.TOKEN);