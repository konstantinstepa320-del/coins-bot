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

/* ================= НАСТРОЙКИ ================= */

const VERIFY_CHANNEL = "1469477344161959957"; // канал проверки
const ROLE_HIGH = "Hight";
const ROLE_LEADER = "Leader";

const IMAGE =
  "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= БАЗА ================= */

let db = { points: {} };

if (fs.existsSync("db.json")) {
  db = JSON.parse(fs.readFileSync("db.json"));
}

function save() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

function addPoints(id, amount) {
  db.points[id] = (db.points[id] || 0) + amount;
  save();
}

function getPoints(id) {
  return db.points[id] || 0;
}

function hasRole(member, roleName) {
  return member.roles.cache.some(r => r.name === roleName);
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* ================= КОМАНДЫ ================= */

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

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
    if (!hasRole(msg.member, ROLE_LEADER))
      return msg.reply("❌ Только Leader может выдавать баллы");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount))
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎`);
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  try {

    /* ===== КНОПКА ЗАРАБОТАТЬ ===== */

    if (i.isButton() && i.customId === "earn_btn") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выбери активность")
        .addOptions([
          { label: "Тайник +2", value: "2" },
          { label: "Капт +3", value: "3" },
          { label: "Заправка +1", value: "1" },
          { label: "Снять варн (-79)", value: "-79" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      return i.reply({ components: [row], ephemeral: true });
    }

    /* ===== ВЫБОР АКТИВНОСТИ ===== */

    if (i.isStringSelectMenu() && i.customId === "earn_select") {

      const reward = i.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`earn_${reward}`)
        .setTitle("Подтверждение");

      const proofInput = new TextInputBuilder()
        .setCustomId("proof")
        .setLabel("Ссылка / доказательство")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(proofInput)
      );

      return i.showModal(modal);
    }

    /* ===== ОТПРАВКА НА ПРОВЕРКУ ===== */

    if (i.isModalSubmit() && i.customId.startsWith("earn_")) {

      const reward = i.customId.split("_")[1];

      await i.deferReply({ ephemeral: true });

      const channel = await client.channels.fetch(VERIFY_CHANNEL).catch(() => null);
      if (!channel) return i.editReply("❌ Канал проверки не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_${i.user.id}_${reward}`)
          .setLabel("Принять")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("reject_btn")
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });

      return i.editReply("✅ Отправлено на проверку");
    }

    /* ===== ПРИНЯТЬ ===== */

    if (i.isButton() && i.customId.startsWith("accept_")) {

      if (!hasRole(i.member, ROLE_HIGH))
        return i.reply({ content: "❌ Нет прав", ephemeral: true });

      const parts = i.customId.split("_");
      const userId = parts[1];
      const reward = Number(parts[2]);

      addPoints(userId, reward);

      return i.update({
        content: "✅ Баллы начислены",
        components: []
      });
    }

    /* ===== ОТКЛОНИТЬ ===== */

    if (i.isButton() && i.customId === "reject_btn") {
      return i.update({
        content: "❌ Заявка отклонена",
        components: []
      });
    }

    /* ===== БАЛАНС ===== */

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