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

db.run(`
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,
 coins INTEGER DEFAULT 0,
 blocked INTEGER DEFAULT 0
)`);

const addCoins=(id,a)=>db.run(`INSERT INTO users VALUES(?,?,0) ON CONFLICT(id) DO UPDATE SET coins=coins+?`,[id,a,a]);
const removeCoins=(id,a)=>db.run(`UPDATE users SET coins=coins-? WHERE id=?`,[a,id]);
const setBlock=(id,b)=>db.run(`UPDATE users SET blocked=? WHERE id=?`,[b,id]);

const getUser=id=>new Promise(r=>db.get(`SELECT * FROM users WHERE id=?`,[id],(e,row)=>r(row||{coins:0,blocked:0})));

const rewards={
 capt:3,
 race:2,
 mp:2,
 arena:1,
 stash:2
};


// ===== READY =====
client.once("ready",()=>console.log("✅ Бот онлайн"));


// ===== ГЛАВНОЕ МЕНЮ =====
client.on("messageCreate", async msg=>{
  if(msg.author.bot) return;

  if(msg.content==="!menu"){

    const embed = new EmbedBuilder()
      .setImage(IMAGE)
      .setDescription("💎 **Система баллов**\nЧтобы заработать баллы — нажмите кнопку ниже");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("earn").setLabel("Маккоин").setEmoji("🪙").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("shop").setLabel("Магазин").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("balance").setLabel("Баланс").setStyle(ButtonStyle.Secondary)
    );

    msg.channel.send({embeds:[embed],components:[row]});
  }
});


// ===== ИНТЕРАКЦИИ =====
client.on(Events.InteractionCreate, async i=>{

  // ===== Баланс =====
  if(i.isButton() && i.customId==="balance"){
    const u=await getUser(i.user.id);
    return i.reply({content:`💰 У тебя ${u.coins} баллов`,ephemeral:true});
  }

  // ===== Магазин =====
  if(i.isButton() && i.customId==="shop"){
    const menu=new StringSelectMenuBuilder()
      .setCustomId("shop_select")
      .addOptions([{label:"Снять варн — 70",value:"warn"}]);

    return i.reply({components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
  }

  if(i.isStringSelectMenu() && i.customId==="shop_select"){
    const u=await getUser(i.user.id);
    if(u.coins<70) return i.reply({content:"❌ Мало баллов",ephemeral:true});
    removeCoins(i.user.id,70);
    return i.reply({content:"✅ Варн снят (-70)",ephemeral:true});
  }

  // ===== Заработать =====
  if(i.isButton() && i.customId==="earn"){

    const u=await getUser(i.user.id);
    if(u.blocked)
      return i.reply({content:"🚫 Вы заблокированы",ephemeral:true});

    const menu=new StringSelectMenuBuilder()
      .setCustomId("act")
      .addOptions([
        {label:"Капт — 3 ✨",value:"capt"},
        {label:"Трасса — 2 ✨",value:"race"},
        {label:"МП — 2 ✨",value:"mp"},
        {label:"Арена — 1 ✨",value:"arena"},
        {label:"Тайник — 2 ✨",value:"stash"}
      ]);

    return i.reply({components:[new ActionRowBuilder().addComponents(menu)],ephemeral:true});
  }

  // ===== ФОРМА =====
  if(i.isStringSelectMenu() && i.customId==="act"){
    const type=i.values[0];

    const modal=new ModalBuilder().setCustomId(`form_${type}`).setTitle("Заявка");

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("l").setLabel("Ссылка").setStyle(TextInputStyle.Short)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("n").setLabel("Ник").setStyle(TextInputStyle.Short))
    );

    return i.showModal(modal);
  }

  // ===== ОТПРАВКА В ЛОГ =====
  if(i.isModalSubmit()){

    const type=i.customId.split("_")[1];
    const reward=rewards[type];

    const embed=new EmbedBuilder()
      .setTitle("📥 Новая заявка")
      .addFields(
        {name:"Игрок",value:i.user.tag},
        {name:"Активность",value:type},
        {name:"Ссылка",value:i.fields.getTextInputValue("l")},
        {name:"Ник",value:i.fields.getTextInputValue("n")},
        {name:"Награда",value:`🪙 ${reward}`}
      );

    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ok_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`no_${i.user.id}`).setLabel("Отклонить").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`block_${i.user.id}`).setLabel("🚫").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`unblock_${i.user.id}`).setLabel("🔓").setStyle(ButtonStyle.Secondary)
    );

    const log=await client.channels.fetch(LOG_CHANNEL);
    log.send({embeds:[embed],components:[row]});

    return i.reply({content:"✅ Заявка отправлена",ephemeral:true});
  }

  // ===== КНОПКИ МОДЕРАЦИИ =====
  if(i.isButton()){

    const [action,uid,reward]=i.customId.split("_");
    const user=await client.users.fetch(uid);

    if(action==="ok"){
      addCoins(uid,+reward);
      user.send(`🪙 Вам начислено ${reward} баллов`);
      return i.update({content:"✅ Принято",components:[]});
    }

    if(action==="no"){
      user.send("❌ Ваша заявка отклонена");
      return i.update({content:"❌ Отклонено",components:[]});
    }

    if(action==="block"){
      setBlock(uid,1);
      user.send("🚫 Вы были заблокированы");
      return i.reply({content:"Игрок заблокирован",ephemeral:true});
    }

    if(action==="unblock"){
      setBlock(uid,0);
      user.send("🔓 Вас разблокировали");
      return i.reply({content:"Игрок разблокирован",ephemeral:true});
    }
  }

});

client.login(TOKEN);
