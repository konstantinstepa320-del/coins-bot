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

/* =============== НАСТРОЙКИ =============== */
const EARN_CHANNEL = "1469477344161959957";      // если понадобится
const LEVEL_CHANNEL = "1474553271892054168";     // сюда падают заявки

const ROLE_LEADER_ID = "1056945517835341936";    // лидер
const ROLE_HIGH_ID = "1295017864310423583";      // высшее руководство

// роли рангов
const MEIN_ROLE_ID = "ID_РОЛИ_MEIN";             // 3 ранг (mein)
const MEIN_PLUS_ROLE_ID = "ID_РОЛИ_MEIN_PLUS";   // 4 ранг (mein+)
const TEST_ROLE_ID = "ID_РОЛИ_TEST";             // временная роль test

// при желании можешь использовать это для автоповышения
const LEVELS = [
  { id: "LEVEL_2_ID", points: 50 },
  { id: "LEVEL_3_ID", points: 100 },
  { id: "LEVEL_4_ID", points: 200 },
];

// стоимость рангов
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
let db = { points: {} };
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
function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

/* =============== АВТО ВЫХОД С ЧУЖОГО СЕРВЕРА =============== */
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

  // команда для ручной выдачи баллов
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

  // главное меню
  if (msg.content === "!menu") {
    const embed = new EmbedBuilder()
      .setTitle("💎 Система баллов")
      .setDescription("Зарабатывай баллы и подавай заявку на повышение.")
      .setImage(IMAGE);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("earn_btn")
        .setLabel("Заработать")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("balance_btn")
        .setLabel("Баланс")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("rankup_btn")
        .setLabel("Повыситься")
        .setStyle(ButtonStyle.Success),
    );

    return msg.reply({ embeds: [embed], components: [row] });
  }
});

/* =============== ПРОВЕРКА УРОВНЕЙ (опционально) =============== */
async function checkLevel(member) {
  const points = getPoints(member.id);
  for (let level of LEVELS) {
    if (points >= level.points && !hasRole(member, level.id)) {
      await member.roles.add(level.id).catch(() => null);
      await member
        .send("🎉 Поздравляем! Вы получили роль повышения!")
        .catch(() => null);
    }
  }
}

/* =============== INTERACTIONS =============== */
client.on("interactionCreate", async i => {
  if (!i.guild || i.guild.id !== ALLOWED_GUILD_ID) return;

  try {
    /* ----- БАЛАНС ----- */
    if (i.isButton() && i.customId === "balance_btn") {
      return i.reply({
        content: `💎 Твой баланс: ${getPoints(i.user.id)}`,
        ephemeral: true,
      });
    }

    /* ----- ОТКРЫТЬ МОДАЛКУ ПОВЫШЕНИЯ ----- */
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
        .setLabel("Откат / скрин специк/тяг и т.д.")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const rankInput = new TextInputBuilder()
        .setCustomId("rankup_target")
        .setLabel("На какой ранг (3, 4 и т.д.)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nickInput),
        new ActionRowBuilder().addComponents(proofInput),
        new ActionRowBuilder().addComponents(rankInput),
      );

      return i.showModal(modal);
    }

    /* ----- ПОЛУЧИЛИ ЗАЯВКУ ИЗ МОДАЛКИ ----- */
    if (i.isModalSubmit() && i.customId === "rankup_modal") {
      const nick = i.fields.getTextInputValue("rankup_nick");
      const proof = i.fields.getTextInputValue("rankup_proof");
      const targetRank = i.fields.getTextInputValue("rankup_target").trim();

      const cost = RANK_COSTS[targetRank];
      if (!cost) {
        return i.reply({
          content: "❌ Такой ранг не настроен. Доступны, например, 3 или 4.",
          ephemeral: true,
        });
      }

      const userPoints = getPoints(i.user.id);
      if (userPoints < cost) {
        return i.reply({
          content: `❌ Для этого ранга нужно ${cost} 💎, у тебя только ${userPoints}.`,
          ephemeral: true,
        });
      }

      const channel = await i.guild.channels.fetch(LEVEL_CHANNEL).catch(() => null);
      if (!channel) {
        return i.reply({
          content: "❌ Канал для заявок не найден. Сообщи администрации.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📝 Заявка на повышение")
        .addFields(
          { name: "Игрок", value: `${i.user} (\`${i.user.id}\`)`, inline: false },
          { name: "Ник", value: nick, inline: false },
          { name: "Желаемый ранг", value: targetRank, inline: true },
          { name: "Баланс игрока", value: `${userPoints} 💎`, inline: true },
          { name: "Стоимость", value: `${cost} 💎`, inline: true },
          { name: "Откат / доказательства", value: proof || "Не указано", inline: false },
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

      return i.reply({
        content: "✅ Заявка отправлена лидерам на проверку.",
        ephemeral: true,
      });
    }

    /* ----- ПРИНЯТЬ ЗАЯВКУ ----- */
    if (i.isButton() && i.customId.startsWith("rankup_accept_")) {
      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({
          content: "❌ У тебя нет прав принимать заявки.",
          ephemeral: true,
        });

      const [, , userId, costStr, rank] = i.customId.split("_");
      const cost = Number(costStr);

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (!member)
        return i.reply({ content: "❌ Игрок не найден.", ephemeral: true });

      const currentPoints = getPoints(userId);
      if (currentPoints < cost) {
        return i.reply({
          content: `❌ У игрока уже нет нужного количества баллов (нужно ${cost}, сейчас ${currentPoints}).`,
          ephemeral: true,
        });
      }

      // списываем баллы
      addPoints(userId, -cost);

      // удаляем роль test, если она есть
      if (TEST_ROLE_ID && member.roles.cache.has(TEST_ROLE_ID)) {
        await member.roles.remove(TEST_ROLE_ID).catch(() => null);
      }

      // выдаём роль за ранг
      if (rank === "3" && MEIN_ROLE_ID) {
        await member.roles.add(MEIN_ROLE_ID).catch(() => null);
      }
      if (rank === "4" && MEIN_PLUS_ROLE_ID) {
        await member.roles.add(MEIN_PLUS_ROLE_ID).catch(() => null);
      }

      await member
        .send(`🎉 Твоя заявка на ${rank} ранг принята, списано ${cost} 💎!`)
        .catch(() => null);

      await i.message.edit({ components: [] }).catch(() => null);

      return i.reply({ content: "✅ Заявка принята.", ephemeral: true });
    }

    /* ----- ОТКЛОНИТЬ ЗАЯВКУ: МОДАЛКА ПРИЧИНЫ ----- */
    if (i.isButton() && i.customId.startsWith("rankup_decline_")) {
      if (!hasRole(i.member, ROLE_LEADER_ID) && !hasRole(i.member, ROLE_HIGH_ID))
        return i.reply({
          content: "❌ У тебя нет прав отклонять заявки.",
          ephemeral: true,
        });

      const [, , userId] = i.customId.split("_");

      const modal = new ModalBuilder()
        .setCustomId(`rankup_decline_modal_${userId}`)
        .setTitle("Причина отказа");

      const reasonInput = new TextInputBuilder()
        .setCustomId("rankup_decline_reason")
        .setLabel("Напишите причину отказа")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

      i.client._lastDeclineMessageId = i.message.id;
      i.client._lastDeclineChannelId = i.channel.id;

      return i.showModal(modal);
    }

    /* ----- ОТПРАВКА ПРИЧИНЫ ОТКАЗА ----- */
    if (i.isModalSubmit() && i.customId.startsWith("rankup_decline_modal_")) {
      const userId = i.customId.split("_").pop();
      const reason = i.fields.getTextInputValue("rankup_decline_reason");

      const member = await i.guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member
          .send(`❌ Твоя заявка на повышение отклонена.\nПричина: ${reason}`)
          .catch(() => null);
      }

      try {
        const ch = await i.guild.channels.fetch(
          i.client._lastDeclineChannelId
        );
        const msg = await ch.messages.fetch(i.client._lastDeclineMessageId);
        await msg.edit({ components: [] });
      } catch (e) {
        // игнор, если не получилось
      }

      return i.reply({
        content: "✅ Причина отправлена игроку.",
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("Ошибка:", err);
  }
});

/* =============== LOGIN =============== */
client.login(process.env.TOKEN);
