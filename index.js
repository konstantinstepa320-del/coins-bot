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
  Events
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const LOG_CHANNEL = "1469555144826814474";
const HIGH_ROLE = "Hight";

// ===== БАЗА =====
const db = new sqlite3.Database("./db.sqlite");
db.run(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0)`);

const addCoins = (id,a)=>db.run(`INSERT INTO users VALUES(?,?) ON CONFLICT(id) DO UPDATE SET coins=coins+?`,[id,a,a]);
const getCoins = id => new Promise(r=>db.get(`SELECT coins FROM users WHERE id=?`,[id],(e,row)=>r(row?.coins||0)));

const rewards = {capt:3,race:2,mp:2,arena:1,stash:2};

// ===== READY =====
client.once("ready",()=>console.log("✅ Бот онлайн"));

// ===== КОМАНДЫ =====
client.on("messageCreate", async msg=>{
  if(msg.author.bot) return;

  if(msg.content==="!menu"){
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("earn").setLabel("🎯 Заработать").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("shop").setLabel("🛒 Магазин").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("warn").setLabel("⚠ Снять варн").setStyle(ButtonStyle.Danger)
    );

    msg.channel.send({content:"💎 Система баллов",components:[row]});
  }

  if(msg.content==="!balance"){
    msg.reply(`💰 Баланс: ${await getCoins(msg.author.id)}`);
  }
});

// ===== ИНТЕРАКЦИИ =====
client.on(Events.InteractionCreate, async i=>{

  if(i.isButton() && i.customId==="earn"){
    const menu = new StringSelectMenuBuilder()
      .setCustomId("act")
      .setPlaceholder("Выбери")
      .addOptions([
        {label:"Капт",value:"capt"},
        {label:"Трасса",value:"race"},
        {label:"МП",value:"mp"},
        {label:"Арена",value:"arena"},
        {label:"Тайник",value:"stash"}
      ]);

    return i.reply({components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
  }

  if(i.isButton() && i.customId==="shop")
    return i.reply({content:`Снять варн = 70 баллов\nБаланс: ${await getCoins(i.user.id)}`,ephemeral:true});

  if(i.isButton() && i.customId==="warn"){
    const coins = await getCoins(i.user.id);
    if(coins<70) return i.reply({content:"❌ Мало баллов",ephemeral:true});
    db.run(`UPDATE users SET coins=coins-70 WHERE id=?`,[i.user.id]);
    return i.reply({content:"✅ Варн снят (-70)",ephemeral:true});
  }

  if(i.isStringSelectMenu()){
    const type=i.values[0];

    const modal=new ModalBuilder().setCustomId(`form_${type}`).setTitle("Заявка");

    const link=new TextInputBuilder().setCustomId("l").setLabel("Ссылка").setStyle(TextInputStyle.Short);
    const nick=new TextInputBuilder().setCustomId("n").setLabel("Ник").setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(link),
      new ActionRowBuilder().addComponents(nick)
    );

    return i.showModal(modal);
  }

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

    return i.reply({content:"✅ Отправлено",ephemeral:true});
  }

  if(i.isButton() && i.customId.startsWith("ok_")){
    if(!i.member.roles.cache.some(r=>r.name===HIGH_ROLE))
      return i.reply({content:"❌ Нет прав",ephemeral:true});

    const [,uid,reward]=i.customId.split("_");
    addCoins(uid,+reward);

    const user=await client.users.fetch(uid);
    user.send(`🎉 Тебе начислено ${reward} баллов`);

    i.update({content:"✅ Выдано",components:[]});
  }

});

client.login(TOKEN);
