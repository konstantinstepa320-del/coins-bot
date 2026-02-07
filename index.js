const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;

const LOG_CHANNEL = "1469477344161959957";
const MENU_CHANNEL = "1469555144826814474";
const HIGH_ROLE = "Hight"; // название роли

// ================= DB =================
const db = new sqlite3.Database("./coins.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0,
  warns INTEGER DEFAULT 0
)`);

function addCoins(id, amount) {
  db.run(
    `INSERT INTO users(id, coins) VALUES(?, ?)
     ON CONFLICT(id) DO UPDATE SET coins = coins + ?`,
    [id, amount, amount]
  );
}

function getUser(id) {
  return new Promise(res => {
    db.get(`SELECT * FROM users WHERE id=?`, [id], (e, row) => {
      if (!row) res({ coins: 0, warns: 0 });
      else res(row);
    });
  });
}

function removeCoins(id, amount) {
  db.run(`UPDATE users SET coins = coins - ? WHERE id=?`, [amount, id]);
}

// ================= READY =================
client.once(Events.ClientReady, () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
});

// ================= МЕНЮ =================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (message.content === "!menu" && message.channel.id === MENU_CHANNEL) {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система повышения")
      .setDescription(`
Капт — 3  
Трасса — 2  
МП — 2  
Арена топ 1 — 1  
Тайник — 2
`)
      .setImage("https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("capt").setLabel("Капт").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("race").setLabel("Трасса").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("mp").setLabel("МП").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("arena").setLabel("Арена").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("stash").setLabel("Тайник").setStyle(ButtonStyle.Success)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }

  // баланс
  if (message.content === "!balance") {
    const user = await getUser(message.author.id);
    message.reply(`💰 У тебя ${user.coins} маккоинов`);
  }

  // магазин
  if (message.content === "!shop") {
    const user = await getUser(message.author.id);

    if (user.coins < 70)
      return message.reply("❌ Нужно 70 маккоинов");

    removeCoins(message.author.id, 70);
    message.reply("✅ Варн снят (-70)");
  }
});

// ================= КНОПКИ =================
const rewards = {
  capt: 3,
  race: 2,
  mp: 2,
  arena: 1,
  stash: 2
};

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const reward = rewards[interaction.customId];
  if (!reward) return;

  await interaction.reply({ content: "✅ Заявка отправлена администрации", ephemeral: true });

  const log = await client.channels.fetch(LOG_CHANNEL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ok_${interaction.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("no").setLabel("Отклонить").setStyle(ButtonStyle.Danger)
  );

  log.send({
    content: `Заявка от <@${interaction.user.id}> на +${reward} маккоинов`,
    components: [row]
  });
});

// ================= АДМИН ПРИНЯТИЕ =================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith("ok_")) return;

  const member = interaction.member;
  if (!member.roles.cache.some(r => r.name === HIGH_ROLE))
    return interaction.reply({ content: "❌ Нет прав", ephemeral: true });

  const [, userId, reward] = interaction.customId.split("_");

  addCoins(userId, Number(reward));

  const user = await client.users.fetch(userId);
  user.send(`🎉 Ты получил ${reward} маккоинов! Молодец!`);

  interaction.update({ content: "✅ Начислено", components: [] });
});

// ================= LOGIN =================
client.login(TOKEN);
