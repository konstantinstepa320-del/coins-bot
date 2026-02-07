const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = "ТУТ_ТОКЕН_БОТА";

const LOG_CHANNEL = "1469477344161959957";
const REQUEST_CHANNEL = "1469555144826814474";
const HIGH_ROLE_NAME = "Hight";

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

const db = new sqlite3.Database("./db.sqlite");

db.run("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0, blocked INTEGER DEFAULT 0)");

function addCoins(id, amount){
  db.run("INSERT OR IGNORE INTO users(id) VALUES(?)", [id]);
  db.run("UPDATE users SET coins = coins + ? WHERE id=?", [amount,id]);
}

function getCoins(id){
  return new Promise(res=>{
    db.get("SELECT coins FROM users WHERE id=?", [id], (e,row)=>{
      res(row?.coins || 0);
    });
  });
}

client.once("ready", ()=>{
  console.log(`Бот запущен как ${client.user.tag}`);
});

client.on("messageCreate", async msg=>{
  if(msg.channel.id !== REQUEST_CHANNEL) return;
  if(msg.content !== "!меню") return;

  const embed = new EmbedBuilder()
    .setTitle("💰 Система Маккоинов")
    .setDescription("Выбери действие ниже")
    .setImage(IMAGE);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("capt").setLabel("Капт +3").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("track").setLabel("Трасса +2").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("mp").setLabel("МП +2").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("arena").setLabel("Арена +1").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("stash").setLabel("Тайник +2").setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("balance").setLabel("Баланс").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("shop").setLabel("Магазин").setStyle(ButtonStyle.Success)
  );

  msg.channel.send({ embeds:[embed], components:[row,row2] });
});

client.on("interactionCreate", async interaction=>{
  if(!interaction.isButton()) return;

  const userId = interaction.user.id;

  const rewards = {
    capt:3,
    track:2,
    mp:2,
    arena:1,
    stash:2
  };

  if(rewards[interaction.customId]){
    const logChannel = client.channels.cache.get(LOG_CHANNEL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ok_${userId}_${rewards[interaction.customId]}`).setLabel("Выдать").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`no`).setLabel("Отказать").setStyle(ButtonStyle.Danger)
    );

    logChannel.send({
      content:`${interaction.user} запросил +${rewards[interaction.customId]} маккоинов`
    ,components:[row]});

    interaction.reply({content:"✅ Заявка отправлена на проверку", ephemeral:true});
  }

  if(interaction.customId === "balance"){
    const coins = await getCoins(userId);
    interaction.reply({content:`💰 У тебя ${coins} маккоинов`, ephemeral:true});
  }

  if(interaction.customId === "shop"){
    const coins = await getCoins(userId);

    if(coins < 70){
      return interaction.reply({content:"❌ Нужно 70 маккоинов", ephemeral:true});
    }

    addCoins(userId,-70);
    interaction.reply({content:"✅ Варн снят, списано 70 маккоинов", ephemeral:true});
  }

  if(interaction.customId.startsWith("ok_")){
    if(!interaction.member.roles.cache.some(r=>r.name===HIGH_ROLE_NAME))
      return interaction.reply({content:"Нет доступа", ephemeral:true});

    const [,uid,amount] = interaction.customId.split("_");

    addCoins(uid,Number(amount));

    const member = await interaction.guild.members.fetch(uid);

    member.send(`🎉 Ты получил +${amount} маккоинов!`);

    interaction.update({content:"✅ Выдано", components:[]});
  }
});

client.login(TOKEN);
