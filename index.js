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
} = require("discord.js");
const fs = require("fs");

/* =============== ЗАЩИТА =============== */
const ALLOWED_GUILD_ID = "1046807733501968404";
const EARN_CHANNEL = "1469477344161959957";
const LEVEL_CHANNEL = "1474553271892054168";

const ROLE_LEADER_ID = "1056945517835341936";
const ROLE_HIGH_ID = "1295017864310423583";

// ТВОИ ID РОЛЕЙ
const MEIN_ROLE_ID = "1287462717237756057";        // 3 ранг mein
const MEIN_PLUS_ROLE_ID = "1450119053350801591";   // 4 ранг mein+
const TEST_ROLE_ID = "1287463578818969662";        // роль test

const RANK_COSTS = {
  "3": 89,
  "4": 178,
};

const IMAGE = "https://cdn.discordapp.com/attachments/737990746086441041/1469395625849257994/3330ded1-da51-47f9-a7d7-dee6d1bdc918.png";

/* =============== CLIENT =============== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

/* =============== БАЗА =============== */
let db = { points: {}, earnLogs: {} };
if (fs.existsSync("db.json")) db = JSON.parse(fs.readFileSync("db.json"));

function save() {
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}
function addPoints(id, amount) {
  db.points[id] = (db.points[id] || 0) + amount;
  save();
}
function getPoints(id) {
  return db.points[id] || 0;
}
function logEarn(id, type, nick, proof) {
  const timestamp = Date.now();
  db.earnLogs[timestamp] = { userId: id, type, nick, proof, time: new Date().toLocaleString() };
  save();
}
function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

/* =============== АВТО ВЫХОД =============== */
client.on("guildCreate", guild => {
  if (guild.id !== ALLOWED_GUILD_ID) {
    console.log(`❌ Бот добавлен на чужой сервер: ${guild.name}`);
    guild.leave();
  }
});

/* =============== READY =============== */
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} запущен`);
});

/* =============== КОМАНДЫ =============== */
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.guild || msg.guild.id !== ALLOWED_GUILD_ID) return;

  if (msg.content.startsWith("!give")) {
    if (!hasRole(msg.member, ROLE_LEADER_ID))
      return msg.reply("❌ Нет прав (Leader)");

    const user = msg.mentions.users.first();
    const amount = parseInt(msg.content.split(" ")[2]);

    if (!user || isNaN(amount))
      return msg.reply("Используй: !give @user 50");

    addPoints(user.id, amount);
    return msg.reply(`✅ Выдано ${amount} 💎`);
  }

  if (msg.content === "!menu") {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setDescription("Зарабатывай баллы и подавай заявку на повышение.")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn_btn")
        .setLabel("Зарабатывать")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("rankup_btn")
        .setLabel("Повышаться")
        .setStyle(ButtonStyle.Success),
    );

    return msg.reply({ embeds: [embed], components: [row] });
  }
});

/* =============== INTERACTIONS =============== */
client.on("interactionCreate", async i => {
  if (!i.guild || i.guild.id !== ALLOWED_GUILD_ID) return;

  try {
    // БАЛАНС
    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({
        content: `💎 Твой баланс: ${getPoints(i.user.id)}`,
        ephemeral: true,
      });
    }

    // МЕНЮ ЗАРАБОТКА
    if (i.isButton() && i.customId === "earn_btn") {
      if (i.channelId !== EARN_CHANNEL) {
        return i.reply({
          content: `❌ Зарабатывать можно только в <#${EARN_CHANNEL}>`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("💰 Выбери способ заработка")
        .setDescription("**Капт** — 3 💎\n**Траса** — 2 💎\n**Топ 1 на арене** — 2 💎\n**Развоз грина** — 1 💎\n**Тайник** — 2 💎\n**Заправка машин** — 2 💎");

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("earn_capt").setLabel("Капт (3💎)").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("earn_trasa").setLabel("Траса (2💎)").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("earn_arena").setLabel("Арена (2💎)").setStyle(ButtonStyle.Primary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("earn_grin").setLabel("Грин (1💎)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("earn_taynik").setLabel("Тайник (2💎)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("earn_zapravka").setLabel("Заправка (2💎)").setStyle(ButtonStyle.Secondary),
      );

      return i.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }

    // ОБРАБОТКА ЗАРАБОТКА
    const earnTypes = {
      "earn_capt": { name: "Капт", points: 3 },
      "earn_trasa": { name: "Траса", points: 2 },
      "earn_arena": { name: "Топ 1 на арене", points: 2 },
      "earn_grin": { name: "Развоз грина", points: 1 },
      "earn_taynik": { name: "Тайник", points: 2 },
      "earn_zapravka": { name: "Заправка машин", points: 2 },
    };

    if (earnTypes[i.customId]) {
      if (i.channelId !== EARN_CHANNEL) {
        return i.reply({ content: `❌ Только в <#${EARN_CHANNEL}>!`, ephemeral: true });
      }

      const type = earnTypes[i.customId];
      
      const modal = new ModalBuilder()
        .setCustomId(`earn_${i.customId}`)
        .setTitle(`${type.name} — подтверждение`);

      const nickInput = new TextInputBuilder()
        .setCustomId("earn_nick")
        .setLabel("Ник в игре")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const proofInput = new TextInputBuilder()
        .setCustomId("earn_proof")
        .setLabel("Ссылка на видео тяги/спешик")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("https://...");

      modal.addComponents(
        new ActionRowBuilder().addComponents(nickInput),
        new ActionRowBuilder().addComponents(proofInput),
      );

      return i.showModal(modal);
    }

    // ПОДТВЕРЖДЕНИЕ ЗАРАБОТКА
    if (i.isModalSubmit() && i.customId.startsWith("earn_")) {
      const earnType = i.customId.replace("earn_", "");
      const type = earnTypes[earnType];
      const nick = i.fields.getTextInputValue("earn_nick");
      const proof = i.fields.getTextInputValue("earn_proof");

      // ЛОГИРУЕМ ЗАЯВКУ НА ЗАРАБОТОК
      logEarn(i.user.id, type.name, nick, proof);

      const channel = await i.guild.channels.fetch(LEVEL_CHANNEL);
      const embed = new EmbedBuilder()
        .setTitle("💰 Заявка на заработок")
        .addFields(
          { name: "Игрок", value: `${i.user} (\`${i.user.id}\`)`, inline: true },
          { name: "Ник", value: nick, inline: true },
          { name: "Тип", value: type.name, inline: true },
          { name: "Баллы", value: `${type.points} 💎`, inline: true },
          { name: "Доказательство", value: `[Ссылка](${proof})`, inline: false },
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`earn_accept_${i.user.id}_${type.points}_${Date.now()}`)
          .setLabel("✅ Выдать")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`earn_decline_${i.user.id}_${Date.now()}`)
          .setLabel("❌ Отклонить")
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({ embeds: [embed], components: [row] });
      return i.reply({ content: "✅ Заявка на заработок отправлена на проверку!", ephemeral: true });
    }

    // ПРИНЯТЬ ЗАРАБОТОК
    if (i.isButton() && i.customId.startsWith("earn_accept_")) {
      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({ content: "❌ Нет прав!", ephemeral: true });

      const [, , userId, pointsStr, timestampStr] = i.customId.split("_");
      const points = Number(pointsStr);

      addPoints(userId, points);
      
      const member = await i.guild.members.fetch(userId);
      await member.send(`✅ Тебе выдали ${points} 💎 за заработок!`);
      
      await i.message.edit({ components: [] });
      return i.reply({ content: `✅ Выдано ${points} 💎`, ephemeral: true });
    }

    // ОТКЛОНИТЬ ЗАРАБОТОК
    if (i.isButton() && i.customId.startsWith("earn_decline_")) {
      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({ content: "❌ Нет прав!", ephemeral: true });

      const [, , userId] = i.customId.split("_");
      const member = await i.guild.members.fetch(userId);
      await member.send("❌ Твоя заявка на заработок отклонена.");
      
      await i.message.edit({ components: [] });
      return i.reply({ content: "✅ Отклонено!", ephemeral: true });
    }

    // МОДАЛКА ПОВЫШЕНИЯ (старая логика)
    if (i.isButton() && i.customId === "rankup_btn") {
      const modal = new ModalBuilder()
        .setCustomId("rankup_modal")
        .setTitle("Заявка на повышение");

      const nickInput = new TextInputBuilder()
        .setCustomId("rankup_nick")
        .setLabel("Ник в игре")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const proofInput = new TextInputBuilder()
        .setCustomId("rankup_proof")
        .setLabel("Откат / скрин специк/тяг")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const rankInput = new TextInputBuilder()
        .setCustomId("rankup_target")
        .setLabel("На какой ранг (3 или 4)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nickInput),
        new ActionRowBuilder().addComponents(proofInput),
        new ActionRowBuilder().addComponents(rankInput),
      );

      return i.showModal(modal);
    }

    // Остальная логика повышения (без изменений)...
    if (i.isModalSubmit() && i.customId === "rankup_modal") {
      const nick = i.fields.getTextInputValue("rankup_nick");
      const proof = i.fields.getTextInputValue("rankup_proof");
      const targetRank = i.fields.getTextInputValue("rankup_target").trim();

      const cost = RANK_COSTS[targetRank];
      if (!cost) {
        return i.reply({ content: "❌ Пиши 3 или 4.", ephemeral: true });
      }

      const userPoints = getPoints(i.user.id);
      if (userPoints < cost) {
        return i.reply({ content: `❌ Нужно ${cost} 💎`, ephemeral: true });
      }

      const channel = await i.guild.channels.fetch(LEVEL_CHANNEL);
      const embed = new EmbedBuilder()
        .setTitle("📝 Заявка на повышение")
        .addFields(
          { name: "Игрок", value: `${i.user} (\`${i.user.id}\`)`, inline: false },
          { name: "Ник", value: nick, inline: false },
          { name: "Ранг", value: targetRank, inline: true },
          { name: "Баланс", value: `${userPoints} 💎`, inline: true },
          { name: "Цена", value: `${cost} 💎`, inline: true },
          { name: "Доказательства", value: proof, inline: false },
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rankup_accept_${i.user.id}_${cost}_${targetRank}`)
          .setLabel("✅ Принять")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`rankup_decline_${i.user.id}`)
          .setLabel("❌ Отклонить")
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({ embeds: [embed], components: [row] });
      return i.reply({ content: "✅ Заявка отправлена!", ephemeral: true });
    }

    // ПРИНЯТЬ ПОВЫШЕНИЕ
    if (i.isButton() && i.customId.startsWith("rankup_accept_")) {
      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({ content: "❌ Нет прав!", ephemeral: true });

      const [, , userId, costStr, rank] = i.customId.split("_");
      const cost = Number(costStr);
      const member = await i.guild.members.fetch(userId);

      const currentPoints = getPoints(userId);
      if (currentPoints < cost) {
        return i.reply({ content: `❌ Недостаточно баллов!`, ephemeral: true });
      }

      addPoints(userId, -cost);

      if (member.roles.cache.has(TEST_ROLE_ID)) {
        await member.roles.remove(TEST_ROLE_ID);
      }

      if (rank === "3") {
        await member.roles.add(MEIN_ROLE_ID);
      } else if (rank === "4") {
        await member.roles.add(MEIN_PLUS_ROLE_ID);
      }

      await member.send(`🎉 Заявка на ${rank} ранг принята! Списано ${cost} 💎`);
      await i.message.edit({ components: [] });
      return i.reply({ content: "✅ Принято!", ephemeral: true });
    }

  } catch (err) {
    console.error("Ошибка:", err);
  }
});

/* =============== LOGIN =============== */
client.login(process.env.TOKEN);
