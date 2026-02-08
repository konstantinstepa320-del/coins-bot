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
    .setDescription(
      "Чтобы заработать баллы — нажми кнопку ниже\n\nИспользуй их в магазине или смотри баланс"
    )
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
      .setStyle(ButtonStyle.Secondary)
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

  /* ===== ВЫБОР ЗАДАНИЯ ===== */
  if (i.customId === "task_select") {

    const type = i.values[0];

    const tips = {
      arena: "Займи ТОП-1 на арене",
      capt: "Сделай скрин стоя на капте",
      mp: "Скрин участия/победы на МП",
      tainik: "Фото с найденным тайником",
      track: "Фото финиша на трассе"
    };

    const modal = new ModalBuilder()
      .setCustomId(`modal_${type}`)
      .setTitle(tips[type]);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("link")
          .setLabel("Ссылка на скрин")
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

  /* ===== МОДАЛКА ===== */
  if (i.isModalSubmit()) {

    const type = i.customId.replace("modal_", "");

    const rewards = {
      arena: 1,
      capt: 3,
      mp: 2,
      tainik: 2,
      track: 1
    };

    const reward = rewards[type];

    const link = i.fields.getTextInputValue("link");
    const nick = i.fields.getTextInputValue("nick");

    const embed = new EmbedBuilder()
      .setTitle("📩 Новая заявка")
      .setDescription(
        `**Игрок:** ${i.user}\n` +
        `**Ник:** ${nick}\n` +
        `**Активность:** ${type}\n` +
        `**Ссылка:** ${link}\n\n` +
        `**Награда:** 💎 ${reward}`
      );

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
        .setLabel("Блок")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`unblock_${i.user.id}`)
        .setLabel("Разблок")
        .setStyle(ButtonStyle.Secondary)
    );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "✅ Отправлено на проверку", ephemeral: true });
  }

  /* ===== ПРИНЯТЬ ===== */
  if (i.customId.startsWith("accept_")) {
    const [, id, reward] = i.customId.split("_");

    addPoints(id, Number(reward));

    const user = await client.users.fetch(id);
    user.send(`✅ +${reward} баллов начислено!`);

    return i.update({ content: "✅ Принято", components: [] });
  }

  /* ===== БАЛАНС ===== */
  if (i.customId === "balance") {
    return i.reply({
      content: `💎 Баланс: ${getPoints(i.user.id)} баллов`,
      ephemeral: true
    });
  }

  /* ===== МАГАЗИН ===== */
  if (i.customId === "shop") {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("remove_warn")
        .setLabel("Снять варн (70 💎)")
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({
      content: "🛒 Магазин",
      components: [row],
      ephemeral: true
    });
  }

  /* ===== СНЯТЬ ВАРН ===== */
  if (i.customId === "remove_warn") {

    if (getPoints(i.user.id) < 70)
      return i.reply({ content: "❌ Недостаточно баллов", ephemeral: true });

    addPoints(i.user.id, -70);

    return i.reply({
      content: "✅ Варн снят, 70 баллов списано",
      ephemeral: true
    });
  }

});

/* ========= LOGIN ========= */

client.login(process.env.TOKEN);
