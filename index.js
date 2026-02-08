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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const VERIFY_CHANNEL = "1469477344161959957";
const IMAGE =
  "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

let db = { points: {}, blocked: [] };

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

/* ================= MENU ================= */

client.on("messageCreate", async (msg) => {
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система балов")
    .setDescription(
      "Чтобы заработать баллы — нажми кнопку ниже\n\nИспользуй их в магазине или смотри баланс"
    )
    .setImage(IMAGE)
    .setColor("#2b2d31");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("earn")
      .setLabel("Заработать")
      .setEmoji("💎")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("shop")
      .setLabel("Магазин")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("balance")
      .setLabel("Баланс")
      .setStyle(ButtonStyle.Secondary)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (i) => {

  /* ===== Заработать (СПИСОК) ===== */
  if (i.customId === "earn") {

    if (db.blocked.includes(i.user.id))
      return i.reply({ content: "🚫 Ты заблокирован", ephemeral: true });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("task_select")
      .setPlaceholder("Выберите нужное")
      .addOptions([
        { label: "Арена 💎", value: "arena" },
        { label: "Гонка 💎", value: "race" },
        { label: "Капт 💎", value: "capt" },
        { label: "Тайник 💎", value: "tainik" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    return i.reply({ components: [row], ephemeral: true });
  }

  /* ===== Выбор задания ===== */
  if (i.customId === "task_select") {
    const type = i.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`modal_${type}`)
      .setTitle("Отправить заявку");

    const link = new TextInputBuilder()
      .setCustomId("link")
      .setLabel("Ссылка на скрин/фото")
      .setStyle(TextInputStyle.Short);

    const nick = new TextInputBuilder()
      .setCustomId("nick")
      .setLabel("Ваш ник")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(link),
      new ActionRowBuilder().addComponents(nick)
    );

    return i.showModal(modal);
  }

  /* ===== Отправка заявки ===== */
  if (i.isModalSubmit()) {

    const type = i.customId.replace("modal_", "");
    const link = i.fields.getTextInputValue("link");
    const nick = i.fields.getTextInputValue("nick");

    const rewards = {
      arena: 1,
      race: 2,
      capt: 3,
      tainik: 2
    };

    const reward = rewards[type] || 1;

    const embed = new EmbedBuilder()
      .setTitle("📩 Новая заявка")
      .setDescription(
        `**Игрок:** ${i.user}\n` +
        `**Ник:** ${nick}\n` +
        `**Активность:** ${type}\n` +
        `**Ссылка:** ${link}\n\n` +
        `**Награда:** 💎 ${reward}`
      )
      .setColor("#2b2d31");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${i.user.id}_${reward}`)
        .setLabel("Принять")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`reject_${i.user.id}`)
        .setLabel("Отклонить")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`block_${i.user.id}`)
        .setLabel("Заблокировать")
        .setStyle(ButtonStyle.Secondary)
    );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "✅ Отправлено на проверку", ephemeral: true });
  }

  /* ===== Принять ===== */
  if (i.customId.startsWith("accept_")) {
    const [, id, reward] = i.customId.split("_");

    addPoints(id, Number(reward));

    const user = await client.users.fetch(id);
    user.send(`✅ Ваша заявка принята. +${reward} баллов`);

    return i.update({ content: "✅ Принято", components: [] });
  }

  /* ===== Отклонить ===== */
  if (i.customId.startsWith("reject_")) {
    return i.reply({ content: "Напиши причину отклонения", ephemeral: true });
  }

  /* ===== Блок ===== */
  if (i.customId.startsWith("block_")) {
    const id = i.customId.split("_")[1];

    if (!db.blocked.includes(id)) db.blocked.push(id);
    save();

    const user = await client.users.fetch(id);
    user.send("🚫 Вы были заблокированы");

    return i.update({ content: "🚫 Заблокирован", components: [] });
  }

  /* ===== Баланс ===== */
  if (i.customId === "balance") {
    return i.reply({
      content: `💎 У тебя ${getPoints(i.user.id)} баллов`,
      ephemeral: true
    });
  }

  /* ===== Магазин ===== */
  if (i.customId === "shop") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("remove_warn")
        .setLabel("Снять варн (70 💎)")
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({ content: "🛒 Магазин", components: [row], ephemeral: true });
  }

  /* ===== Купить снятие варна ===== */
  if (i.customId === "remove_warn") {

    if (getPoints(i.user.id) < 70)
      return i.reply({ content: "❌ Недостаточно баллов", ephemeral: true });

    addPoints(i.user.id, -70);

    return i.reply({
      content: "✅ Варн снят (баллы списаны)",
      ephemeral: true
    });
  }

});

client.login(process.env.TOKEN);
