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

const IMAGE =
  "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ========= CLIENT ========= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.once("ready", () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
});

/* ========= БАЗА ========= */

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

/* ========= !menu ========= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система баллов")
    .setDescription("Нажми кнопку ниже чтобы заработать или открыть магазин")
    .setImage(IMAGE);

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
      .setStyle(ButtonStyle.Secondary),

    /* ===== НОВАЯ КНОПКА ===== */
    new ButtonBuilder()
      .setCustomId("upgrade")
      .setLabel("Повышение")
      .setEmoji("📈")
      .setStyle(ButtonStyle.Primary)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async (i) => {

  /* ===== ЗАРАБОТАТЬ ===== */
  if (i.customId === "earn") {

    if (db.blocked.includes(i.user.id))
      return i.reply({ content: "🚫 Ты заблокирован", ephemeral: true });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("task_select")
      .setPlaceholder("Выбери активность")
      .addOptions([
        { label: "Арена 💎 1", value: "arena" },
        { label: "Капт 💎 3", value: "capt" },
        { label: "МП 💎 2", value: "mp" },
        { label: "Тайник 💎 2", value: "tainik" },
        { label: "Трасса 💎 1", value: "track" }
      ]);

    return i.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  /* ===== МОДАЛКА АКТИВНОСТИ ===== */
  if (i.customId === "task_select") {

    const type = i.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`modal_${type}`)
      .setTitle("Отправить заявку");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("link")
          .setLabel("Ссылка на фото/скрин")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nick")
          .setLabel("Ваш ник")
          .setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  /* ===== ПОВЫШЕНИЕ ===== */

  if (i.customId === "upgrade") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("upgrade_select")
      .setPlaceholder("Выбери повышение")
      .addOptions([
        { label: "2 → 3 (98 💎)", value: "23" },
        { label: "3 → 4 (289 💎)", value: "34" },
        { label: "4 → 5-6 (решение ХР)", value: "45" }
      ]);

    return i.reply({
      content: "⚠️ Для повышения нужно быть в фаме минимум 2-3 дня",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (i.customId === "upgrade_select") {

    const type = i.values[0];

    const prices = { "23": 98, "34": 289, "45": 0 };
    const price = prices[type];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`upgrade_confirm_${type}`)
        .setLabel("Подтвердить")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("upgrade_cancel")
        .setLabel("Отмена")
        .setStyle(ButtonStyle.Danger)
    );

    return i.reply({
      content:
        price > 0
          ? `⚠️ Потратить ${price} 💎 для повышения?`
          : "⚠️ Повышение по решению ХР. Продолжить?",
      components: [row],
      ephemeral: true
    });
  }

  if (i.customId.startsWith("upgrade_confirm_")) {

    const type = i.customId.split("_")[2];

    const prices = { "23": 98, "34": 289, "45": 0 };
    const price = prices[type];

    if (price > 0 && getPoints(i.user.id) < price)
      return i.reply({ content: "❌ Недостаточно маккоинов", ephemeral: true });

    if (price > 0) addPoints(i.user.id, -price);

    const modal = new ModalBuilder()
      .setCustomId(`upgrade_modal_${type}`)
      .setTitle("Заявка на повышение");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("Ник").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("recoil").setLabel("Откат").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("proof").setLabel("Ссылка/скрин").setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  /* ===== МОДАЛКИ ===== */
  if (i.isModalSubmit()) {

    /* ---- повышение ---- */
    if (i.customId.startsWith("upgrade_modal_")) {

      const type = i.customId.split("_")[2];

      const embed = new EmbedBuilder()
        .setTitle("📈 Заявка на повышение")
        .setDescription(
          `**Игрок:** ${i.user}\n` +
          `**Ник:** ${i.fields.getTextInputValue("name")}\n` +
          `**Откат:** ${i.fields.getTextInputValue("recoil")}\n` +
          `**Доказательства:** ${i.fields.getTextInputValue("proof")}`
        );

      const ch = await client.channels.fetch(VERIFY_CHANNEL);
      ch.send({ embeds: [embed] });

      return i.reply({ content: "✅ Заявка отправлена", ephemeral: true });
    }

    /* ---- обычные заявки ---- */
    const type = i.customId.replace("modal_", "");

    const rewards = {
      arena: 1,
      capt: 3,
      mp: 2,
      tainik: 2,
      track: 1
    };

    const reward = rewards[type];

    const embed = new EmbedBuilder()
      .setTitle("📩 Новая заявка")
      .setDescription(
        `**Игрок:** ${i.user}\n` +
        `**Ник:** ${i.fields.getTextInputValue("nick")}\n` +
        `**Активность:** ${type}\n` +
        `**Ссылка:** ${i.fields.getTextInputValue("link")}\n\n` +
        `**Награда:** 💎 ${reward}`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_${i.user.id}`).setLabel("Отклонить").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`block_${i.user.id}`).setLabel("Блок").setStyle(ButtonStyle.Secondary)
    );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "✅ Отправлено на проверку", ephemeral: true });
  }

});
client.login(process.env.TOKEN);
