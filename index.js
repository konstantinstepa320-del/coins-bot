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
const LEADER_ROLE = "Leader";

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* ========= CLIENT ========= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
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

function hasRole(member, name) {
  return member.roles.cache.some(r => r.name === name);
}

/* ========= READY ========= */

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* ========= !menu ========= */

client.on("messageCreate", async (msg) => {

  if (msg.author.bot) return;

  /* ===== ВЫДАЧА БАЛЛОВ (Leader only) ===== */
  if (msg.content.startsWith("!give")) {

    if (!hasRole(msg.member, LEADER_ROLE))
      return msg.reply("❌ Только Leader может выдавать баллы");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount))
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);

    return msg.reply(`✅ Выдано ${amount} 💎 пользователю ${user.username}`);
  }

  if (msg.content !== "!menu") return;

  const embed = new EmbedBuilder()
    .setTitle("💎 Система баллов")
    .setImage(IMAGE);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("earn_btn").setLabel("Заработать").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("balance_btn").setLabel("Баланс").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("upgrade_btn").setLabel("Повышение").setStyle(ButtonStyle.Success)
  );

  msg.reply({ embeds: [embed], components: [row] });
});

/* ========= INTERACTIONS ========= */

client.on("interactionCreate", async (i) => {

/* ================= ЗАРАБОТОК ================= */

if (i.isButton() && i.customId === "earn_btn") {

  const menu = new StringSelectMenuBuilder()
    .setCustomId("earn_select")
    .setPlaceholder("Выбери активность")
    .addOptions([
      { label: "Тайник +2", value: "2" },
      { label: "Капт +3", value: "3" },
      { label: "Заправка +1", value: "1" },
      { label: "Трасса +2", value: "2" },
      { label: "Топ 1 арена +1", value: "1" },
      { label: "Развозка +1", value: "1" },
      { label: "Снять варн (-79)", value: "-79" }
    ]);

  return i.reply({
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

/* выбор */
if (i.isStringSelectMenu() && i.customId === "earn_select") {

  const reward = i.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`earn_modal_${reward}`)
    .setTitle("Заявка");

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

/* отправка */
if (i.isModalSubmit() && i.customId.startsWith("earn_modal_")) {

  const reward = i.customId.split("_")[2];

  const embed = new EmbedBuilder()
    .setTitle("💎 Заявка")
    .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`accept_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("reject").setLabel("Отклонить").setStyle(ButtonStyle.Danger)
  );

  const ch = await client.channels.fetch(VERIFY_CHANNEL);
  ch.send({ embeds: [embed], components: [row] });

  return i.reply({ content: "✅ Отправлено", ephemeral: true });
}

/* принять */
if (i.isButton() && i.customId.startsWith("accept_")) {

  if (!hasRole(i.member, HIGH_ROLE))
    return i.reply({ content: "❌ Нет прав", ephemeral: true });

  const [, id, reward] = i.customId.split("_");

  addPoints(id, Number(reward));

  return i.update({ content: "✅ Готово", components: [] });
}

/* ================= БАЛАНС ================= */

if (i.isButton() && i.customId === "balance_btn") {
  return i.reply({
    content: `💎 Твой баланс: ${getPoints(i.user.id)}`,
    ephemeral: true
  });
}

/* ================= ПОВЫШЕНИЕ ================= */

if (i.isButton() && i.customId === "upgrade_btn") {

  const menu = new StringSelectMenuBuilder()
    .setCustomId("upgrade_select")
    .setPlaceholder("Выбери повышение")
    .addOptions([
      { label: "2→3 (-110)", value: "-110" },
      { label: "2→4 (-220)", value: "-220" }
    ]);

  return i.reply({
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

});

client.login(process.env.TOKEN);