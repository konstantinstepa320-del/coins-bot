const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;

// ⚙️ ВСТАВЬ СВОИ ID
const MENU_CHANNEL = "ТУТ_ID_КАНАЛА_МЕНЮ";
const LOG_CHANNEL = "ТУТ_ID_ЛОГОВ";
const HIGH_ROLE = "Hight";

// ================= БАЗА =================
const db = new sqlite3.Database("./coins.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 coins INTEGER DEFAULT 0,
 warns INTEGER DEFAULT 0
)`);

function addCoins(id, amount) {
  db.run(`
  INSERT INTO users(id, coins) VALUES(?,?)
  ON CONFLICT(id) DO UPDATE SET coins = coins + ?`,
  [id, amount, amount]);
}

function removeCoins(id, amount) {
  db.run(`UPDATE users SET coins = coins - ? WHERE id=?`, [amount, id]);
}

function getUser(id) {
  return new Promise(res => {
    db.get(`SELECT * FROM users WHERE id=?`, [id], (e,row)=>{
      if(!row) res({coins:0,warns:0});
      else res(row);
    });
  });
}

// ================= НАГРАДЫ =================
const rewards = {
  capt: 3,
  race: 2,
  mp: 2,
  arena: 1,
  stash: 2
};

// ================= READY =================
client.once(Events.ClientReady, () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

// ================= КОМАНДА МЕНЮ =================
client.on(Events.MessageCreate, async msg => {
  if(msg.author.bot) return;

  if(msg.content === "!menu" && msg.channel.id === MENU_CHANNEL){

    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setDescription("Выберите нужный раздел ниже");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn")
        .setLabel("🎯 Заработать")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("shop")
        .setLabel("🛒 Магазин")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("warn")
        .setLabel("⚠ Снять варн")
        .setStyle(ButtonStyle.Danger)
    );

    msg.channel.send({ embeds:[embed], components:[row] });
  }

  if(msg.content === "!balance"){
    const user = await getUser(msg.author.id);
    msg.reply(`💰 Баланс: ${user.coins}`);
  }
});

// ================= КНОПКИ =================
client.on(Events.InteractionCreate, async interaction => {

  // ---------- КНОПКА ЗАРАБОТАТЬ ----------
  if(interaction.isButton() && interaction.customId === "earn"){

    const menu = new StringSelectMenuBuilder()
      .setCustomId("activity")
      .setPlaceholder("Выберите активность")
      .addOptions([
        {label:"Капт", value:"capt"},
        {label:"Трасса", value:"race"},
        {label:"МП", value:"mp"},
        {label:"Арена", value:"arena"},
        {label:"Тайник", value:"stash"}
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content:"Выберите тип",
      components:[row],
      ephemeral:true
    });
  }

  // ---------- МАГАЗИН ----------
  if(interaction.isButton() && interaction.customId === "shop"){
    const user = await getUser(interaction.user.id);

    return interaction.reply({
      content:`🛒 Баланс: ${user.coins}\nСнятие варна стоит 70`,
      ephemeral:true
    });
  }

  // ---------- СНЯТЬ ВАРН ----------
  if(interaction.isButton() && interaction.customId === "warn"){
    const user = await getUser(interaction.user.id);

    if(user.coins < 70)
      return interaction.reply({content:"❌ Недостаточно баллов", ephemeral:true});

    removeCoins(interaction.user.id,70);

    return interaction.reply({content:"✅ Варн снят (-70)", ephemeral:true});
  }

  // ---------- ВЫБОР АКТИВНОСТИ ----------
  if(interaction.isStringSelectMenu() && interaction.customId === "activity"){

    const type = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`form_${type}`)
      .setTitle("Отправка заявки");

    const link = new TextInputBuilder()
      .setCustomId("link")
      .setLabel("Ссылка")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const nick = new TextInputBuilder()
      .setCustomId("nick")
      .setLabel("Ник")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(link),
      new ActionRowBuilder().addComponents(nick)
    );

    return interaction.showModal(modal);
  }

  // ---------- ОТПРАВКА ФОРМЫ ----------
  if(interaction.isModalSubmit()){

    if(!interaction.customId.startsWith("form_")) return;

    const type = interaction.customId.split("_")[1];
    const reward = rewards[type];

    const link = interaction.fields.getTextInputValue("link");
    const nick = interaction.fields.getTextInputValue("nick");

    const log = await client.channels.fetch(LOG_CHANNEL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ok_${interaction.user.id}_${reward}`)
        .setLabel("Принять")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("no")
        .setLabel("Отклонить")
        .setStyle(ButtonStyle.Danger)
    );

    await log.send({
      content:
`📥 Новая заявка
👤 ${interaction.user.tag}
🎮 ${type}
🔗 ${link}
📝 ${nick}
💰 +${reward}`,
      components:[row]
    });

    return interaction.reply({content:"✅ Заявка отправлена", ephemeral:true});
  }

  // ---------- ПРИНЯТЬ ----------
  if(interaction.isButton() && interaction.customId.startsWith("ok_")){

    if(!interaction.member.roles.cache.some(r=>r.name===HIGH_ROLE))
      return interaction.reply({content:"❌ Нет прав", ephemeral:true});

    const [, userId, reward] = interaction.customId.split("_");

    addCoins(userId, Number(reward));

    const user = await client.users.fetch(userId);
    user.send(`🎉 Вам начислено ${reward} баллов`);

    interaction.update({content:"✅ Начислено", components:[]});
  }
});

// ================= LOGIN =================
client.login(TOKEN);
