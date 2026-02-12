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

const VERIFY_CHANNEL = "1469477344161959957";
const HIGH_ROLE = "Hight";

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

client.once("ready", () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);
});

/* ================= БАЗА ================= */

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

function isHigh(member) {
  return member.roles.cache.some(r => r.name === HIGH_ROLE);
}

/* ================= !menu ================= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система баллов")
    .setImage(IMAGE);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("earn").setLabel("Заработать").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("balance").setLabel("Баланс").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("upgrade").setLabel("Повышение").setStyle(ButtonStyle.Success)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (i) => {

  /* ================================================= */
  /* ================= ЗАРАБОТОК ===================== */
  /* ================================================= */

  if (i.isButton() && i.customId === "earn") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("earn_select")
      .setPlaceholder("Выбери активность")
      .addOptions([
        { label: "Арена +1", value: "1" },
        { label: "Капт +3", value: "3" },
        { label: "МП +2", value: "2" },
        { label: "Трасса +2", value: "2" }
      ]);

    return i.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  /* ---- МЕНЮ (ВАЖНО!) ---- */
  if (i.isStringSelectMenu() && i.customId === "earn_select") {

    const reward = i.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`earn_modal_${reward}`)
      .setTitle("Заявка на заработок");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("proof")
          .setLabel("Ссылка/скрин")
          .setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  /* ---- МОДАЛКА ---- */
  if (i.isModalSubmit() && i.customId.startsWith("earn_modal_")) {

    const reward = i.customId.split("_")[2];

    const embed = new EmbedBuilder()
      .setTitle("💎 Заработок")
      .setDescription(`Игрок: ${i.user}\nНаграда: +${reward}`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`earn_accept_${i.user.id}_${reward}`)
        .setLabel("Принять")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`earn_reject_${i.user.id}`)
        .setLabel("Отклонить")
        .setStyle(ButtonStyle.Danger)
    );

    const ch = await client.channels.fetch(VERIFY_CHANNEL);
    ch.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "✅ Отправлено на проверку", ephemeral: true });
  }

  /* ---- ПРИНЯТЬ ---- */
  if (i.isButton() && i.customId.startsWith("earn_accept_")) {

    if (!isHigh(i.member))
      return i.reply({ content: "❌ Нет доступа", ephemeral: true });

    const [, , id, reward] = i.customId.split("_");

    addPoints(id, Number(reward));

    return i.update({ content: `✅ +${reward} 💎 начислено`, components: [] });
  }

  /* ---- ОТКЛОНИТЬ ---- */
  if (i.isButton() && i.customId.startsWith("earn_reject_")) {

    if (!isHigh(i.member)) return;

    return i.update({ content: "❌ Отклонено", components: [] });
  }

  /* ================================================= */
  /* ================= БАЛАНС ======================== */
  /* ================================================= */

  if (i.isButton() && i.customId === "balance") {
    return i.reply({
      content: `💎 Баланс: ${getPoints(i.user.id)}`,
      ephemeral: true
    });
  }

  /* ================================================= */
  /* ================= ПОВЫШЕНИЕ ===================== */
  /* ================================================= */

  if (i.isButton() && i.customId === "upgrade") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("upgrade_select")
      .setPlaceholder("Выбери повышение")
      .addOptions([
        { label: "2→3 (110)", value: "110" },
        { label: "2→4 (220)", value: "220" }
      ]);

    return i.reply({
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

});

client.login(process.env.TOKEN);
