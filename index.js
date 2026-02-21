const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require("discord.js");
const fs = require("fs");

const EARN_CHANNEL = "1469477344161959957";  
const LEVEL_CHANNEL = "1474553271892054168";  

const ROLE_LEADER_ID = "1056945517835341936";
const ROLE_HIGH_ID = "1295017864310423583";  
const ROLE_REWARD_ID = "1295017864310423583";  

const LEVELS = [
  { id: "LEVEL_2_ID", points: 50 },
  { id: "LEVEL_3_ID", points: 100 },
  { id: "LEVEL_4_ID", points: 200 },
];

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let db = { points: {} };
if (fs.existsSync("db.json")) db = JSON.parse(fs.readFileSync("db.json"));
function save() { fs.writeFileSync("db.json", JSON.stringify(db, null, 2)); }
function addPoints(id, amount) { db.points[id] = (db.points[id] || 0) + amount; save(); }
function getPoints(id) { return db.points[id] || 0; }
function hasRole(member, roleId) { return member.roles.cache.has(roleId); }

client.once("ready", () => console.log(`✅ ${client.user.tag} запущен`));

client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (msg.content === "!menu") {
    const embed = new EmbedBuilder().setTitle("💎 Система баллов").setImage(IMAGE);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("earn_btn").setLabel("Заработать").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("balance_btn").setLabel("Баланс").setStyle(ButtonStyle.Secondary)
    );
    return msg.reply({ embeds: [embed], components: [row] });
  }

  if (msg.content.startsWith("!give")) {
    if (!hasRole(msg.member, ROLE_LEADER_ID)) return msg.reply("❌ Нет прав (Leader)");
    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);
    if (!user || isNaN(amount)) return msg.reply("Используй: !give @user 50");
    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎`);
  }
});

async function checkLevel(member) {
  const points = getPoints(member.id);
  for (let level of LEVELS) {
    if (points >= level.points && !hasRole(member, level.id)) {
      await member.roles.add(level.id).catch(() => null);
      await member.send("🎉 Поздравляем! Вы получили роль повышения!").catch(() => null);
    }
  }
}

client.on("interactionCreate", async i => {
  try {
    if (i.isButton() && i.customId === "earn_btn") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("earn_select")
        .setPlaceholder("Выбери активность")
        .addOptions([
          { label: "Заправка машины +2", value: "2" },
          { label: "Капт +3", value: "3" },
          { label: "Развозка Грина +1", value: "1" },
          { label: "Топ 1 на арене +2", value: "2" },
          { label: "Тайники +3", value: "3" },
          { label: "Выезд на трассу +1", value: "1" }
        ]);
      return i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === "earn_select") {
      const reward = i.values[0];
      const modal = new ModalBuilder().setCustomId(`earn_${reward}`).setTitle("Подтверждение");
      const input = new TextInputBuilder()
        .setCustomId("proof")
        .setLabel("Ссылка на видео (спешик/тяга)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("earn_")) {
      const reward = Number(i.customId.split("_")[1]);
      await i.deferReply({ ephemeral: true });
      const channel = await client.channels.fetch(EARN_CHANNEL).catch(() => null);
      if (!channel) return i.editReply("❌ Канал не найден");

      const embed = new EmbedBuilder()
        .setTitle("💎 Заявка на баллы")
        .setDescription(`Игрок: ${i.user}\nБаллы: ${reward}\nВидео: ${i.fields.getTextInputValue("proof")}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${i.user.id}_${reward}`).setLabel("Принять").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${i.user.id}`).setLabel("Отклонить").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });
      return i.editReply("✅ Отправлено на проверку");
    }

    if (i.isButton() && i.customId.startsWith("accept_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав (High)", ephemeral: true });
      const [_, userId, reward] = i.customId.split("_");
      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (!member) return i.reply({ content: "❌ Пользователь не найден", ephemeral: true });

      addPoints(userId, Number(reward));
      await member.roles.add(ROLE_REWARD_ID).catch(() => null);
      await member.send(`🎉 Ваша заявка одобрена!\n💎 Начислено: ${reward}\n📊 Новый баланс: ${getPoints(userId)}`).catch(() => null);
      await checkLevel(member);
      return i.update({ content: "✅ Баллы начислены, роль выдана", components: [] });
    }

    if (i.isButton() && i.customId.startsWith("reject_")) {
      if (!hasRole(i.member, ROLE_HIGH_ID)) return i.reply({ content: "❌ Нет прав (High)", ephemeral: true });

      const userId = i.customId.split("_")[1];
      const modal = new ModalBuilder().setCustomId(`reject_modal_${userId}`).setTitle("Причина отклонения");
      const input = new TextInputBuilder().setCustomId("reason").setLabel("Причина отклонения").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId.startsWith("reject_modal_")) {
      const userId = i.customId.split("_")[2];
      const reason = i.fields.getTextInputValue("reason");
      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) await member.send(`❌ Ваша заявка отклонена.\nПричина: ${reason}`).catch(() => null);
      return i.update({ content: `❌ Заявка отклонена\nПричина: ${reason}`, components: [] });
    }

    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({ content: `💎 Твой баланс: ${getPoints(i.user.id)}`, ephemeral: true });
    }

  } catch (err) {
    console.error("Ошибка:", err);
  }
});

client.login(process.env.TOKEN);