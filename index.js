const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  StringSelectMenuBuilder 
} = require("discord.js");

const fs = require("fs");

/* ================= ЗАЩИТА ================= */
const ALLOWED_GUILD_ID = "1046807733501968404";

/* ================= НАСТРОЙКИ ================= */
const EARN_CHANNEL = "1469477344161959957";
const LEVEL_CHANNEL = "1474553271892054168";

const ROLE_LEADER_ID = "1056945517835341936";
const ROLE_HIGH_ID = "1295017864310423583";
const ROLE_REWARD_ID = "1295017864310423583";

const LEVELS = [
  { id: "LEVEL_2_ID", points: 50 },
  { id: "LEVEL_3_ID", points: 100 },
  { id: "LEVEL_4_ID", points: 200 },
];

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= АВТО ВЫХОД С ЧУЖОГО СЕРВЕРА ================= */
client.on("guildCreate", guild => {
  if (guild.id !== ALLOWED_GUILD_ID) {
    console.log(`❌ Бот добавлен на чужой сервер: ${guild.name}`);
    guild.leave();
  }
});

/* ================= БАЗА ================= */
let db = { points: {} };
if (fs.existsSync("db.json")) db = JSON.parse(fs.readFileSync("db.json"));

function save() { fs.writeFileSync("db.json", JSON.stringify(db, null, 2)); }
function addPoints(id, amount) { db.points[id] = (db.points[id] || 0) + amount; save(); }
function getPoints(id) { return db.points[id] || 0; }
function hasRole(member, roleId) { return member.roles.cache.has(roleId); }

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* ================= КОМАНДЫ ================= */
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID) return;

  if (msg.content === "!menu") {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn_btn")
        .setLabel("Заработать")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary)
    );

    return msg.reply({ embeds: [embed], components: [row] });
  }

  if (msg.content.startsWith("!give")) {
    if (!hasRole(msg.member, ROLE_LEADER_ID)) 
      return msg.reply("❌ Нет прав (Leader)");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount)) 
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎`);
  }
});

/* ================= ПОВЫШЕНИЕ ================= */
async function checkLevel(member) {
  const points = getPoints(member.id);
  for (let level of LEVELS) {
    if (points >= level.points && !hasRole(member, level.id)) {
      await member.roles.add(level.id).catch(() => null);
      await member.send("🎉 Поздравляем! Вы получили роль повышения!").catch(() => null);
    }
  }
}

/* ================= INTERACTIONS ================= */
client.on("interactionCreate", async i => {
  if (!i.guild || i.guild.id !== ALLOWED_GUILD_ID) return;

  try {

    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({ 
        content: `💎 Твой баланс: ${getPoints(i.user.id)}`, 
        ephemeral: true 
      });
    }

  } catch (err) {
    console.error("Ошибка:", err);
  }
});

/* ================= LOGIN ================= */
client.login(process.env.TOKEN);