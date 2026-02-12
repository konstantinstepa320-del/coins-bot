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
  StringSelectMenuBuilder,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

/* ========= НАСТРОЙКИ ========= */

const VERIFY_CHANNEL = "1469477344161959957";
const HIGH_ROLE_NAME = "Hight"; // название роли

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

/* ========= ПРОВЕРКА РОЛИ ========= */

function hasHighRole(member) {
  return member.roles.cache.some(r => r.name === HIGH_ROLE_NAME);
}

/* ========= !menu ========= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система баллов")
    .setDescription("Выбери действие ниже");

  const row = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("earn")
      .setLabel("Заработать")
      .setEmoji("💎")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("balance")
      .setLabel("Баланс")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("remove_warn")
      .setLabel("Снять варн")
      .setEmoji("⚠️")
      .setStyle(ButtonStyle.Danger)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async (i) => {

  /* ================= ЗАРАБОТАТЬ ================= */

  if (i.customId === "earn") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("task_select")
      .setPlaceholder("Выбери активность")
      .addOptions([
        { label: "Арена 💎 1", value: "arena" },
        { label: "Капт 💎 3", value: "capt" },
        { label: "МП 💎 2", value: "mp" }
      ]);

    return i.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  /* ================= БАЛАНС ================= */

  if (i.customId === "balance") {
    return i.reply({
      content: `💎 Твой баланс: ${getPoints(i.user.id)}`,
      ephemeral: true
    });
  }

  /* ================= СНЯТЬ ВАРН ================= */

  if (i.customId === "remove_warn") {

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Заявка на снятие варна")
      .setDescription(
        `Игрок: ${i.user}\n` +
        `Баланс: 💎 ${getPoints(i.user.id)}\n\n` +
        `Стоимость: 70 💎`
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

    return i.reply({
      content: "✅ Заявка отправлена на проверку",
      ephemeral: true
    });
  }

  /* ================= ПРИНЯТЬ ВАРН ================= */

  if (i.customId.startsWith("warn_accept_")) {

    if (!hasHighRole(i.member))
      return i.reply({ content: "❌ Нет доступа", ephemeral: true });

    const id = i.customId.split("_")[2];

    if (getPoints(id) < 70)
      return i.reply({ content: "❌ У игрока недостаточно баллов", ephemeral: true });

    addPoints(id, -70);

    const user = await client.users.fetch(id);
    user.send("✅ Варн снят (-70 💎)");

    return i.update({ content: "✅ Одобрено", components: [] });
  }

  /* ================= ОТКЛОНИТЬ ================= */

  if (i.customId.startsWith("warn_reject_")) {

    if (!hasHighRole(i.member))
      return i.reply({ content: "❌ Нет доступа", ephemeral: true });

    const id = i.customId.split("_")[2];

    const user = await client.users.fetch(id);
    user.send("❌ В снятии варна отказано");

    return i.update({ content: "❌ Отклонено", components: [] });
  }

});

client.login(process.env.TOKEN);
