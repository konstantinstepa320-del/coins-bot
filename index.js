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
} = require("discord.js");

const fs = require("fs");

/* ================= НАСТРОЙКИ ================= */

const ALLOWED_GUILD_ID = "1046807733501968404";

const EARN_CHANNEL = "1479571004471640155";
const LEVEL_CHANNEL = "1480228317222277171";

const ROLE_LEADER_ID = "1056945517835341936";
const ROLE_HIGH_ID = "1295017864310423583";

const VACATION_ROLE = "1479988454484869271";

const MEIN_ROLE_ID = "1480229891789160479";
const MEIN_PLUS_ROLE_ID = "1479574658935423087";

const IMAGE =
  "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ================= ЦЕНЫ РАНГОВ ================= */

const RANK_COSTS = {
  "3": 89,
  "4": 178,
};

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================= БАЗА БАЛЛОВ ================= */

let db = { points: {}, earnLogs: {} };

if (fs.existsSync("db.json")) {
  db = JSON.parse(fs.readFileSync("db.json"));
}

function saveDB() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

function addPoints(id, amount) {
  db.points[id] = (db.points[id] || 0) + amount;
  saveDB();
}

function getPoints(id) {
  return db.points[id] || 0;
}

/* ================= БАЗА AFK ================= */

let afkdb = { roles: {} };

if (fs.existsSync("afkdb.json")) {
  afkdb = JSON.parse(fs.readFileSync("afkdb.json"));
}

function saveAFK() {
  fs.writeFileSync("afkdb.json", JSON.stringify(afkdb, null, 2));
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ Бот запущен ${client.user.tag}`);
});

/* ================= КОМАНДЫ ================= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID) return;

  /* GIVE */

  if (msg.content.startsWith("!give")) {
    if (!msg.member.roles.cache.has(ROLE_LEADER_ID))
      return msg.reply("❌ Нет прав");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount))
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);

    msg.reply(`✅ Выдано ${amount} 💎`);
  }

  /* МЕНЮ БАЛЛОВ */

  if (msg.content === "!menu") {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setDescription("Зарабатывай баллы и подавай заявку на повышение.")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn_btn")
        .setLabel("Зарабатывать")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("rankup_btn")
        .setLabel("Повышаться")
        .setStyle(ButtonStyle.Success)
    );

    msg.reply({ embeds: [embed], components: [row] });
  }

  /* AFK МЕНЮ */

  if (msg.content === "!afkmenu") {
    const embed = new EmbedBuilder()
      .setTitle("🌙 AFK / Отпуск система")
      .setDescription("Используй кнопки ниже")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("vacation")
        .setLabel("🏖 Взять отпуск")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("afk")
        .setLabel("🌙 Встать AFK")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("back")
        .setLabel("✅ Выйти AFK / Отпуск")
        .setStyle(ButtonStyle.Success)
    );

    msg.channel.send({
      embeds: [embed],
      components: [row],
    });
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (i) => {
  try {

    /* БАЛАНС */

    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({
        content: `💎 Баланс: ${getPoints(i.user.id)}`,
        ephemeral: true,
      });
    }

    /* EARN */

    if (i.isButton() && i.customId === "earn_btn") {
      if (i.channelId !== EARN_CHANNEL)
        return i.reply({
          content: `❌ Только в <#${EARN_CHANNEL}>`,
          ephemeral: true,
        });

      const embed = new EmbedBuilder()
        .setTitle("💰 Выбери способ заработка")
        .setDescription("Капт — 3💎\nТраса — 2💎\nАрена — 2💎");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("earn_capt")
          .setLabel("Капт")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("earn_trasa")
          .setLabel("Траса")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("earn_arena")
          .setLabel("Арена")
          .setStyle(ButtonStyle.Primary)
      );

      i.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    /* AFK */

    if (i.isButton() && i.customId === "afk") {
      const member = i.member;

      const roles = member.roles.cache
        .filter((r) => r.id !== i.guild.id)
        .map((r) => r.id);

      afkdb.roles[member.id] = roles;

      saveAFK();

      for (const role of roles) {
        await member.roles.remove(role).catch(() => {});
      }

      await member.roles.add(VACATION_ROLE);

      return i.reply({
        content: "🌙 Ты встал AFK",
        ephemeral: true,
      });
    }

    /* ВЕРНУТЬСЯ */

    if (i.isButton() && i.customId === "back") {
      const member = i.member;

      const savedRoles = afkdb.roles[member.id];

      if (!savedRoles)
        return i.reply({
          content: "❌ Ты не был AFK",
          ephemeral: true,
        });

      for (const role of savedRoles) {
        await member.roles.add(role).catch(() => {});
      }

      await member.roles.remove(VACATION_ROLE).catch(() => {});

      delete afkdb.roles[member.id];

      saveAFK();

      i.reply({
        content: "✅ Ты вышел из AFK",
        ephemeral: true,
      });
    }

  } catch (err) {
    console.log(err);
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);