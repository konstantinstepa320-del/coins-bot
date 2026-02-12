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

/* ========= НАСТРОЙКИ ========= */

const VERIFY_CHANNEL = "1469477344161959957";
const HIGH_ROLE = "Hight";

const IMAGE =
  "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ========= CLIENT ========= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

client.once("ready", () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
});

/* ========= БАЗА ========= */

let db = { points: {} };

if (fs.existsSync("db.json"))
  db = JSON.parse(fs.readFileSync("db.json"));

function save() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

function addPoints(id, n) {
  db.points[id] = (db.points[id] || 0) + n;
  save();
}

function getPoints(id) {
  return db.points[id] || 0;
}

function hasHigh(member) {
  return member.roles.cache.some(r => r.name === HIGH_ROLE);
}

/* ========= !menu ========= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система баллов")
    .setDescription("Выбери действие ниже")
    .setImage(IMAGE);

  const row = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("earn")
      .setLabel("Заработать")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("balance")
      .setLabel("Баланс")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("remove_warn")
      .setLabel("Снять варн")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("upgrade")
      .setLabel("Повышение")
      .setStyle(ButtonStyle.Success)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async (i) => {

  /* ===== БАЛАНС ===== */
  if (i.customId === "balance") {
    return i.reply({
      content: `💎 Баланс: ${getPoints(i.user.id)}`,
      ephemeral: true
    });
  }

  /* ===== СНЯТЬ ВАРН ===== */
  if (i.customId === "remove_warn") {

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Заявка на снятие варна")
      .setDescription(
        `Игрок: ${i.user}\nБаланс: 💎 ${getPoints(i.user.id)}`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`warn_accept_${i.user.id}`)
        .setLabel("Принять")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`warn_reject_${i.user.id}`)
        .setLabel("Отклонить")
        .setStyle(ButtonStyle.Danger)
    );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "✅ Заявка отправлена", ephemeral: true });
  }

  /* ===== ПРИНЯТЬ ВАРН ===== */
  if (i.customId.startsWith("warn_accept_")) {

    if (!hasHigh(i.member))
      return i.reply({ content: "❌ Нет доступа", ephemeral: true });

    const id = i.customId.split("_")[2];

    if (getPoints(id) < 70)
      return i.reply({ content: "❌ Недостаточно баллов", ephemeral: true });

    addPoints(id, -70);

    return i.update({ content: "✅ Варн снят (-70 💎)", components: [] });
  }

  /* ===== ОТКЛОНИТЬ ===== */
  if (i.customId.startsWith("warn_reject_")) {

    if (!hasHigh(i.member))
      return i.reply({ content: "❌ Нет доступа", ephemeral: true });

    return i.update({ content: "❌ Отклонено", components: [] });
  }

  /* ===== ПОВЫШЕНИЕ ===== */
  if (i.customId === "upgrade") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("upgrade_select")
      .setPlaceholder("Выбери повышение")
      .addOptions([
        { label: "2 → 3 (110 💎)", value: "23" },
        { label: "2 → 4 (220 💎)", value: "24" }
      ]);

    return i.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  /* ===== ВЫБОР РАНГА ===== */
  if (i.customId === "upgrade_select") {

    const type = i.values[0];
    const prices = { "23": 110, "24": 220 };

    const price = prices[type];

    if (getPoints(i.user.id) < price)
      return i.reply({ content: "❌ Недостаточно маккоинов", ephemeral: true });

    addPoints(i.user.id, -price);

    const modal = new ModalBuilder()
      .setCustomId(`upgrade_modal_${type}`)
      .setTitle("Заявка на повышение");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nick")
          .setLabel("Ник + статик")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("video")
          .setLabel("Скрин/видео тяга/спешка")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("proof")
          .setLabel("Ссылка/доказательства")
          .setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  /* ===== МОДАЛКА ПОВЫШЕНИЯ ===== */
  if (i.isModalSubmit() && i.customId.startsWith("upgrade_modal_")) {

    const embed = new EmbedBuilder()
      .setTitle("📈 Заявка на повышение")
      .setDescription(
        `Игрок: ${i.user}\n` +
        `Ник: ${i.fields.getTextInputValue("nick")}\n` +
        `Тяга/спешка: ${i.fields.getTextInputValue("video")}\n` +
        `Доказательства: ${i.fields.getTextInputValue("proof")}\n` +
        `Баланс после списания: 💎 ${getPoints(i.user.id)}`
      );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed] });

    return i.reply({ content: "✅ Заявка отправлена", ephemeral: true });
  }

});

client.login(process.env.TOKEN);
