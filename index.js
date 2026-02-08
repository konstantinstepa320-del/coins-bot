const {
  Client,
  GatewayIntentBits,
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
  ]
});

const TOKEN = process.env.TOKEN;

const LOG_CHANNEL = "1469477344161959957";
const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";


// ===== БАЗА =====
const db = new sqlite3.Database("./db.sqlite");

db.run(`CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0
)`);

const addCoins=(id,a)=>db.run(`INSERT INTO users VALUES(?,?) ON CONFLICT(id) DO UPDATE SET coins=coins+?`,[id,a,a]);
const removeCoins=(id,a)=>db.run(`UPDATE users SET coins=coins-? WHERE id=?`,[a,id]);
const getCoins=id=>new Promise(r=>db.get(`SELECT coins FROM users WHERE id=?`,[id],(e,row)=>r(row?.coins||0)));

const rewards = {
  capt:3,
  race:2,
  mp:2,
  arena:1,
  stash:2
};

// ===== READY =====
client.once("ready",()=>console.log("✅ Бот онлайн"));


// ===== МЕНЮ =====
client.on("messageCreate", async msg=>{
  if(msg.author.bot) return;

  if(msg.content==="!menu"){

    const embed = new EmbedBuilder()
      .setImage(IMAGE)
      .setDescription("💎 **Система баллов**\nЧтобы заработать баллы — нажмите кнопку ниже");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("earn").setLabel("🎯 Заработать").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("shop").setLabel("🛒 Магазин").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("balance").setLabel("💰 Баланс").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("warn").setLabel("⚠ Снять варн").setStyle(ButtonStyle.Danger)
    );

    msg.channel.send({embeds:[embed],components:[row]});
  }
});


// ===== ИНТЕРАКЦИИ =====
client.on(Events.InteractionCreate, async i=>{

  // ===== Баланс =====
  if(i.isButton() && i.customId==="balance"){
    return i.reply({content:`💰 У тебя ${await getCoins(i.user.id)} баллов`,ephemeral:true});
  }

  // ===== Магазин =====
  if(i.isButton() && i.customId==="shop"){

    const menu = new StringSelectMenuBuilder()
      .setCustomId("shop_select")
      .setPlaceholder("Выбери покупку")
      .addOptions([
        {label:"Снять варн — 70 баллов", value:"warn"}
      ]);

    return i.reply({components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
  }

  // покупка
  if(i.isStringSelectMenu() && i.customId==="shop_select"){
    const coins = await getCoins(i.user.id);

    if(coins<70)
      return i.reply({content:"❌ Недостаточно баллов",ephemeral:true});

    removeCoins(i.user.id,70);
    return i.reply({content:"✅ Варн снят (-70)",ephemeral:true});
  }

  // ===== Заработать =====
  if(i.isButton() && i.customId==="earn"){

    const menu = new StringSelectMenuBuilder()
      .setCustomId("act")
      .setPlaceholder("Выбери активность")
      .addOptions([
        {label:"Капт — 3", value:"capt"},
        {label:"Трасса — 2", value:"race"},
        {label:"МП — 2", value:"mp"},
        {label:"Арена — 1", value:"arena"},
        {label:"Тайник — 2", value:"stash"}
      ]);

    return i.reply({components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
  }

  // форма
  if(i.isStringSelectMenu() && i.customId==="act"){
    const type=i.values[0];

    const modal=new ModalBuilder()
      .setCustomId(`form_${type}`)
      .setTitle("Заявка");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("l").setLabel("Ссылка").setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("n").setLabel("Ник").setStyle(TextInputStyle.Short)
      )
    );

    return i.showModal(modal);
  }

  // отправка заявки
  if(i.isModalSubmit()){

    const type=i.customId.split("_")[1];
    const reward=rewards[type];

    const log=await client.channels.fetch(LOG_CHANNEL);

    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ok_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success)
    );

    log.send({
      content:`👤 ${i.user.tag}\n🎮 ${type}\n🔗 ${i.fields.getTextInputValue("l")}\n📝 ${i.fields.getTextInputValue("n")}\n💰 +${reward}`,
      components:[row]
    });

    return i.reply({content:"✅ Заявка отправлена",ephemeral:true});
  }

  // принять
  if(i.isButton() && i.customId.startsWith("ok_")){

    const [,uid,reward]=i.customId.split("_");

    addCoins(uid,+reward);

    const user=await client.users.fetch(uid);
    user.send(`🎉 Вы получили ${reward} баллов`);

    i.update({content:"✅ Начислено",components:[]});
  }

});


client.login(TOKEN);
