const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= CONFIG ================= */

const LOG_CHANNEL = "1469555144826814474";     // заявки
const CHECK_CHANNEL = "1469477344161959957";   // проверки

const COIN = "🪙";

/* ========================================== */

let balances = {};
let blocked = new Set();

const rewards = {
  arena: 1,
  race: 2,
  capt: 3,
  tainik: 2
};

/* ================= СТАРТ ================= */

client.once("ready", () => {
  console.log("Бот запущен ✅");
});

/* ================= ГЛАВНОЕ МЕНЮ ================= */

client.on("messageCreate", async msg => {
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("Система балов")
    .setDescription(
      "Чтобы заработать баллы — нажми кнопку ниже\n\n" +
      "Используй их в магазине или смотри баланс"
    )
    .setImage("https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png");

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
      .setCustomId("bal")
      .setLabel("Баланс")
      .setStyle(ButtonStyle.Secondary)
  );

  msg.channel.send({ embeds: [embed], components: [row] });
});

/* ================= ИНТЕРАКЦИИ ================= */

client.on("interactionCreate", async i => {

  /* ===== Баланс ===== */
  if (i.customId === "bal") {
    return i.reply({
      content: `${COIN} У тебя ${balances[i.user.id] || 0} баллов`,
      ephemeral: true
    });
  }

  /* ===== Магазин ===== */
  if (i.customId === "shop") {
    const embed = new EmbedBuilder()
      .setTitle("🛒 Магазин")
      .setDescription("Скоро появятся товары");

    return i.reply({ embeds: [embed], ephemeral: true });
  }

  /* ===== Заработать ===== */
  if (i.customId === "earn") {

    if (blocked.has(i.user.id))
      return i.reply({ content: "🚫 Ты заблокирован", ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("task_arena").setLabel("Арена 💎").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("task_race").setLabel("Гонка 💎").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("task_capt").setLabel("Капт 💎").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("task_tainik").setLabel("Тайник 💎").setStyle(ButtonStyle.Secondary)
    );

    return i.reply({ content: "Выбери активность:", components: [row], ephemeral: true });
  }

  /* ===== ОТКРЫТИЕ ФОРМЫ ===== */
  if (i.customId.startsWith("task_")) {

    const type = i.customId.split("_")[1];

    const modal = new ModalBuilder()
      .setCustomId(`form_${type}`)
      .setTitle("Отправка заявки");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("link")
          .setLabel("Ссылка на фото")
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nick")
          .setLabel("Ник")
          .setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  /* ===== ОТПРАВКА ЗАЯВКИ ===== */
  if (i.isModalSubmit() && i.customId.startsWith("form_")) {

    const type = i.customId.split("_")[1];
    const reward = rewards[type];

    const link = i.fields.getTextInputValue("link");
    const nick = i.fields.getTextInputValue("nick");

    const embed = new EmbedBuilder()
      .setTitle("📥 Новая заявка")
      .addFields(
        { name: "👤 Игрок", value: i.user.tag },
        { name: "🎯 Активность", value: type },
        { name: "🖼 Ссылка", value: `[Открыть](${link})` },
        { name: "📝 Ник", value: nick },
        { name: `${COIN} Награда`, value: reward.toString() }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ok_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny_${i.user.id}`).setLabel("Отклонить").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`block_${i.user.id}`).setLabel("Блок").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`unblock_${i.user.id}`).setLabel("Разблок").setStyle(ButtonStyle.Secondary)
    );

    const ch = await client.channels.fetch(CHECK_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    i.reply({ content: "Заявка отправлена ✅", ephemeral: true });
  }

  /* ===== ПРИНЯТЬ ===== */
  if (i.customId.startsWith("ok_")) {
    const [_, id, reward] = i.customId.split("_");

    balances[id] = (balances[id] || 0) + Number(reward);

    const user = await client.users.fetch(id);
    user.send(`${COIN} Ты получил ${reward} баллов`);

    return i.update({ content: "✅ Принято", components: [] });
  }

  /* ===== ОТКЛОНИТЬ / БЛОК ===== */
  if (i.customId.startsWith("deny_") || i.customId.startsWith("block_")) {

    const id = i.customId.split("_")[1];
    const isBlock = i.customId.startsWith("block_");

    const modal = new ModalBuilder()
      .setCustomId(`reason_${id}_${isBlock}`)
      .setTitle("Укажи причину");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("r")
          .setLabel("Причина")
          .setStyle(TextInputStyle.Paragraph)
      )
    );

    return i.showModal(modal);
  }

  /* ===== ПРИЧИНА ===== */
  if (i.isModalSubmit() && i.customId.startsWith("reason_")) {

    const [_, id, isBlock] = i.customId.split("_");
    const reason = i.fields.getTextInputValue("r");

    if (isBlock === "true") blocked.add(id);

    const user = await client.users.fetch(id);
    user.send(`❌ Причина: ${reason}`);

    return i.reply({ content: "Готово", ephemeral: true });
  }

  /* ===== РАЗБЛОК ===== */
  if (i.customId.startsWith("unblock_")) {
    const id = i.customId.split("_")[1];
    blocked.delete(id);
    return i.reply({ content: "🔓 Разблокирован", ephemeral: true });
  }

});

/* ================= ЗАПУСК ================= */

client.login(process.env.TOKEN);
